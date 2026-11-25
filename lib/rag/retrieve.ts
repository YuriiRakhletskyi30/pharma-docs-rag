import { generateText } from 'ai';
import { fastModel } from './models';
import { stripCitations } from './citations';
import type { Turn } from './prompt';
import type { SourceRef } from '@/lib/types';
import { effectiveMode, search, type Hit } from './search';

// Rerank relevance below this means nothing relevant was found: answer "not found" without calling the LLM.
// Tuned on the eval set (see evals/results.md). Only applies to reranked results.
export const RELEVANCE_FLOOR = 0.4;

/** Turns a follow-up ("and for kids?") into a standalone search query using recent turns. */
// Each outside call (Haiku rewrite, Voyage embed and rerank) gets 15 s, and stops early when the client goes away.
const CALL_TIMEOUT_MS = 15_000;
const limit = (signal?: AbortSignal) =>
  signal ? AbortSignal.any([signal, AbortSignal.timeout(CALL_TIMEOUT_MS)]) : AbortSignal.timeout(CALL_TIMEOUT_MS);

export async function rewriteQuery(history: Turn[], question: string, signal?: AbortSignal): Promise<string> {
  if (!history.length) return question;
  const transcript = history.map((t) => `${t.role}: ${stripCitations(t.content).slice(0, 600)}`).join('\n');
  const { text } = await generateText({
    model: fastModel,
    system:
      'Rewrite the last user question as one standalone search query about drug labels. ' +
      'Resolve pronouns and references from the conversation (drug names, conditions). ' +
      'Return only the query, no quotes or explanation.',
    prompt: `${transcript}\nuser: ${question}`,
    maxOutputTokens: 100,
    abortSignal: limit(signal),
  });
  return text.trim() || question;
}

/** Nothing relevant: no hits, or the best reranked score is under the floor. Keyword-only scores are never floored. */
export const isNotFound = (hits: Hit[]) => !hits[0] || (hits[0].reranked && hits[0].score < RELEVANCE_FLOOR);

export async function retrieve(history: Turn[], question: string, signal?: AbortSignal) {
  const searchQuery = await rewriteQuery(history, question, signal);
  const hits = await search(searchQuery, 'hybrid_rerank', limit(signal));
  return { searchQuery, hits, notFound: isNotFound(hits), mode: effectiveMode('hybrid_rerank') };
}

/** What the browser gets for each source: numbered from 1 in the order the model sees them. */
export const toSourceRefs = (hits: Hit[]): SourceRef[] =>
  hits.map((h, i) => ({
    n: i + 1,
    documentId: h.documentId,
    title: h.title,
    page: h.page,
    heading: h.heading,
    content: h.content,
    score: h.score,
    uploaded: h.uploaded,
  }));
