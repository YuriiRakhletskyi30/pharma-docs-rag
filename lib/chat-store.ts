import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { messages, traces } from '@/lib/db/schema';
import type { Outcome } from '@/lib/rag/citations';
import type { Turn } from '@/lib/rag/prompt';

export const HISTORY_TURNS = 6; // a turn is a question and its answer

const chat = (owner: string, conversationId: string) =>
  and(eq(messages.owner, owner), eq(messages.conversationId, conversationId));

export async function loadHistory(owner: string, conversationId: string): Promise<Turn[]> {
  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(chat(owner, conversationId))
    .orderBy(desc(messages.id))
    .limit(HISTORY_TURNS * 2);
  return rows.reverse();
}

/** The question and its answer are saved together, so a stopped or failed turn leaves no half pair. */
export async function saveTurn(owner: string, conversationId: string, question: string, answer: string) {
  await db.insert(messages).values([
    { owner, conversationId, role: 'user', content: question },
    { owner, conversationId, role: 'assistant', content: answer },
  ]);
}

/** Removes the chat and its traces (they hold the question text too). */
export async function deleteConversation(owner: string, conversationId: string) {
  await db.delete(messages).where(chat(owner, conversationId));
  await db.delete(traces).where(and(eq(traces.owner, owner), eq(traces.conversationId, conversationId)));
}

export type TraceInput = Omit<typeof traces.$inferInsert, 'id' | 'createdAt' | 'outcome'> & { outcome: Outcome };

export async function writeTrace(t: TraceInput) {
  await db.insert(traces).values(t);
}
