import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from 'ai';
import { z } from 'zod';
import { loadHistory, saveTurn, writeTrace, type TraceInput } from '@/lib/chat-store';
import { MAX_QUESTION_CHARS } from '@/lib/constants';
import { listLabels } from '@/lib/documents';
import { log } from '@/lib/log';
import { ownerCookie, readOwner } from '@/lib/owner';
import { checkCitations, classifyAnswer, type Outcome } from '@/lib/rag/citations';
import { isLibraryQuestion, libraryAnswer } from '@/lib/rag/library';
import { answerModel } from '@/lib/rag/models';
import { buildMessages, NOT_FOUND, SYSTEM_PROMPT, type Turn } from '@/lib/rag/prompt';
import { retrieve, toSourceRefs } from '@/lib/rag/retrieve';
import type { Hit } from '@/lib/rag/search';
import type { ChatMessage, SourceRef } from '@/lib/types';

const MAX_BODY = 32 * 1024;
const MAX_OUTPUT_TOKENS = 4000; // a safety net; the prompt keeps answers short (most use under 1500)

// The client sends only the new question; the history comes from the database.
const Body = z.object({
  id: z.string().min(1).max(100),
  messages: z
    .array(
      z.object({
        role: z.string(),
        parts: z
          .array(z.object({ type: z.string(), text: z.string().max(4 * MAX_QUESTION_CHARS).optional() }))
          .max(20),
      }),
    )
    .min(1)
    .max(1),
});

type Usage = { inputTokens?: number; outputTokens?: number };

export async function POST(req: Request) {
  const length = Number(req.headers.get('content-length'));
  if (!length) return Response.json({ error: 'Content-Length is required' }, { status: 411 });
  if (length > MAX_BODY) return Response.json({ error: 'Request is too large' }, { status: 413 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });

  const last = parsed.data.messages[0];
  const question = last.parts.map((p) => (p.type === 'text' ? p.text ?? '' : '')).join('').trim();
  if (last.role !== 'user' || !question) return Response.json({ error: 'Empty question' }, { status: 400 });
  if (question.length > MAX_QUESTION_CHARS) {
    return Response.json({ error: `Question is longer than ${MAX_QUESTION_CHARS} characters` }, { status: 400 });
  }

  // first question from this browser: make an owner id and hand it back as a cookie
  const known = readOwner(req);
  const owner = known ?? crypto.randomUUID();
  const headers: HeadersInit = known ? {} : { 'set-cookie': ownerCookie(owner, req) };

  const conversationId = parsed.data.id;
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const rlog = log.child({ requestId, conversationId });

  let searchQuery = question;
  let mode: TraceInput['mode'] = 'hybrid_rerank';
  let sources: SourceRef[] = [];

  // Every request leaves a trace, including the ones that fail or are stopped.
  const trace = async (outcome: Outcome, extra: { model?: string; usage?: Usage } = {}) => {
    const latencyMs = Date.now() - started;
    rlog.info({ outcome, latencyMs, searchQuery, topScore: sources[0]?.score, usage: extra.usage }, 'chat done');
    await writeTrace({
      owner,
      requestId,
      conversationId,
      question,
      searchQuery,
      mode,
      retrieved: sources.map(({ n, documentId, page, heading, score }) => ({ n, documentId, page, heading, score })),
      model: extra.model ?? null,
      inputTokens: extra.usage?.inputTokens ?? null,
      outputTokens: extra.usage?.outputTokens ?? null,
      latencyMs,
      outcome,
    }).catch((err) => rlog.error({ err }, 'trace write failed'));
  };
  const failed = async (err: unknown, outcome: 'error' | 'aborted') => {
    if (outcome === 'error') rlog.error({ err }, 'chat failed');
    await trace(outcome);
  };

  // "Which labels do you have?" is answered from the documents table: search can't, and a model would guess.
  async function answerFromLibrary() {
    let answer: string;
    try {
      answer = libraryAnswer(await listLabels());
    } catch (err) {
      await failed(err, 'error');
      return Response.json({ error: 'Could not read the label list. Please try again.' }, { status: 500, headers });
    }
    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: 'lib' });
        writer.write({ type: 'text-delta', id: 'lib', delta: answer });
        writer.write({ type: 'text-end', id: 'lib' });
        writer.write({ type: 'finish' });
        await saveTurn(owner, conversationId, question, answer);
        await trace('library');
      },
    });
    return createUIMessageStreamResponse({ stream, headers });
  }
  if (isLibraryQuestion(question)) return answerFromLibrary();

  let history: Turn[];
  let hits: Hit[];
  let notFound: boolean;
  try {
    history = await loadHistory(owner, conversationId);
    ({ searchQuery, hits, notFound, mode } = await retrieve(history, question, req.signal));
  } catch (err) {
    await failed(err, req.signal.aborted ? 'aborted' : 'error');
    return Response.json(
      { error: 'Something went wrong while searching the labels. Please try again.' },
      { status: 500, headers },
    );
  }
  sources = toSourceRefs(hits);

  const finish = async (answer: string, outcome: Outcome, extra?: { model?: string; usage?: Usage }) => {
    await saveTurn(owner, conversationId, question, answer);
    await trace(outcome, extra);
  };

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'data-sources', id: 'sources', data: { items: notFound ? [] : sources } });

      if (notFound) {
        // Guard: nothing relevant retrieved, so don't let the model improvise.
        writer.write({ type: 'text-start', id: 'nf' });
        writer.write({ type: 'text-delta', id: 'nf', delta: NOT_FOUND });
        writer.write({ type: 'text-end', id: 'nf' });
        writer.write({ type: 'finish' });
        await finish(NOT_FOUND, 'not_found');
        return;
      }

      let errored = false; // a provider error can still end the stream with partial text: don't save that as an answer
      const result = streamText({
        model: answerModel,
        system: SYSTEM_PROMPT,
        messages: buildMessages(history, question, hits),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: req.signal,
        timeout: { totalMs: 90_000, chunkMs: 20_000 },
        onEnd: async ({ text, totalUsage, finishReason }) => {
          if (errored) return;
          const refused = text.trim() === NOT_FOUND;
          const { cited, invalid, unverified } = checkCitations(text, sources.map((s) => s.content));
          const cutOff = finishReason === 'length';
          const uncited = !refused && cited.length === 0;
          writer.write({ type: 'data-citations', id: 'citations', data: { invalid, unverified, cutOff, uncited } });
          const outcome = classifyAnswer({ refused, invalid, cutOff, uncited, unverified });
          await finish(text, outcome, { model: answerModel.modelId, usage: totalUsage });
        },
        onAbort: () => failed(null, 'aborted'),
        onError: ({ error }) => {
          errored = true;
          return failed(error, 'error');
        },
      });
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
    },
    onError: (error) => {
      rlog.error({ err: error }, 'chat stream failed');
      return 'Something went wrong while answering. Please try again.';
    },
  });

  return createUIMessageStreamResponse({ stream, headers });
}
