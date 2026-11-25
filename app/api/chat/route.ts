import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from 'ai';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { hasVoyage } from '@/lib/env';
import { messages, traces } from '@/lib/db/schema';
import { log } from '@/lib/log';
import { checkCitations } from '@/lib/rag/citations';
import { answerModel } from '@/lib/rag/models';
import { buildMessages, NOT_FOUND, SYSTEM_PROMPT, type Turn } from '@/lib/rag/prompt';
import { retrieve } from '@/lib/rag/retrieve';
import type { ChatMessage, SourceRef } from '@/lib/types';

const MAX_QUESTION = 1000;
const HISTORY_TURNS = 6;

const Body = z.object({
  id: z.string().min(1).max(100),
  messages: z
    .array(z.object({ role: z.string(), parts: z.array(z.object({ type: z.string(), text: z.string().optional() })) }))
    .min(1),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });

  const conversationId = parsed.data.id;
  const last = parsed.data.messages.at(-1)!;
  const question = last.parts.map((p) => (p.type === 'text' ? p.text ?? '' : '')).join('').trim();
  if (last.role !== 'user' || !question) return Response.json({ error: 'Empty question' }, { status: 400 });
  if (question.length > MAX_QUESTION) {
    return Response.json({ error: `Question is longer than ${MAX_QUESTION} characters` }, { status: 400 });
  }

  const requestId = crypto.randomUUID();
  const started = Date.now();
  const rlog = log.child({ requestId, conversationId });

  const history: Turn[] = (
    await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.id))
      .limit(HISTORY_TURNS)
  ).reverse();
  await db.insert(messages).values({ conversationId, role: 'user', content: question });

  const { searchQuery, hits, notFound } = await retrieve(history, question);
  const sources: SourceRef[] = hits.map((h, i) => ({
    n: i + 1,
    documentId: h.documentId,
    title: h.title,
    page: h.page,
    heading: h.heading,
    content: h.content,
    score: h.score,
  }));

  const finish = async (answer: string, outcome: string, usage?: { inputTokens?: number; outputTokens?: number }) => {
    const latencyMs = Date.now() - started;
    await db.insert(messages).values({ conversationId, role: 'assistant', content: answer });
    await db.insert(traces).values({
      requestId,
      conversationId,
      question,
      searchQuery,
      mode: hasVoyage ? 'hybrid_rerank' : 'fulltext',
      retrieved: sources.map(({ n, documentId, page, heading, score }) => ({ n, documentId, page, heading, score })),
      model: outcome === 'answered' ? answerModel.modelId : null,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      latencyMs,
      outcome,
    });
    rlog.info({ outcome, latencyMs, searchQuery, topScore: hits[0]?.score, usage }, 'chat answered');
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

      const result = streamText({
        model: answerModel,
        system: SYSTEM_PROMPT,
        messages: buildMessages(history, question, hits),
        onEnd: async ({ text, totalUsage }) => {
          const { invalid } = checkCitations(text, sources.length);
          writer.write({ type: 'data-citations', id: 'citations', data: { invalid } });
          await finish(text, invalid.length ? 'answered_invalid_citations' : 'answered', totalUsage);
        },
      });
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
    },
    onError: (error) => {
      rlog.error({ err: error }, 'chat failed');
      return 'Something went wrong while answering. Please try again.';
    },
  });

  return createUIMessageStreamResponse({ stream });
}
