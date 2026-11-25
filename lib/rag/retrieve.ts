import { generateText } from 'ai';
import { fastModel } from './models';
import type { Turn } from './prompt';
import { search, type Hit, type Mode } from './search';

// Rerank relevance below this means nothing relevant was found: answer "not found" without calling the LLM.
// Tuned on the eval set (see evals/results.md). Only applies to reranked results.
export const RELEVANCE_FLOOR = 0.3;

/** Turns a follow-up ("and for kids?") into a standalone search query using recent turns. */
export async function rewriteQuery(history: Turn[], question: string): Promise<string> {
  if (!history.length) return question;
  const transcript = history.map((t) => `${t.role}: ${t.content.slice(0, 600)}`).join('\n');
  const { text } = await generateText({
    model: fastModel,
    system:
      'Rewrite the last user question as one standalone search query about drug labels. ' +
      'Resolve pronouns and references from the conversation (drug names, conditions). ' +
      'Return only the query, no quotes or explanation.',
    prompt: `${transcript}\nuser: ${question}`,
  });
  return text.trim() || question;
}

export async function retrieve(history: Turn[], question: string, mode?: Mode) {
  const searchQuery = await rewriteQuery(history, question);
  const hits: Hit[] = await search(searchQuery, mode);
  const top = hits[0];
  const notFound = !top || (top.reranked && top.score < RELEVANCE_FLOOR);
  return { searchQuery, hits, notFound };
}
