import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hit } from '@/lib/rag/search';

// The route with its edges replaced: no database, no search, a scripted model.
const store = vi.hoisted(() => ({
  loadHistory: vi.fn(async () => [] as { role: 'user' | 'assistant'; content: string }[]),
  saveTurn: vi.fn(async () => {}),
  writeTrace: vi.fn(async () => {}),
}));
vi.mock('@/lib/chat-store', () => store);

const search = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock('@/lib/rag/retrieve', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rag/retrieve')>()),
  retrieve: search.retrieve,
}));

const docs = vi.hoisted(() => ({
  listLabels: vi.fn(async () => [
    { title: 'Brilinta (ticagrelor)', uploaded: false },
    { title: 'Eliquis (apixaban)', uploaded: false },
  ]),
}));
vi.mock('@/lib/documents', () => docs);

const models = vi.hoisted(() => ({ answerModel: null as unknown, fastModel: null as unknown }));
vi.mock('@/lib/rag/models', () => models);

const { POST } = await import('@/app/api/chat/route');
const { NOT_FOUND } = await import('@/lib/rag/prompt');

const hit: Hit = {
  id: 1,
  documentId: 3,
  title: 'Eliquis (apixaban)',
  page: 24,
  heading: '8.6 Renal Impairment',
  content: 'No dose adjustment is recommended for patients with renal impairment alone.',
  score: 0.9,
  reranked: true,
  uploaded: false,
};

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

/** A model that streams `text` and stops with `reason`, or fails mid-stream when `fail` is set. */
function modelSaying(text: string, reason: 'stop' | 'length' = 'stop', fail = false) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text },
          ...(fail
            ? [{ type: 'error', error: new Error('provider down') }]
            : [
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: { unified: reason, raw: reason }, usage },
              ]),
        ] as never[],
      }),
    }),
  });
}

function ask(question: string, init: { cookie?: string; signal?: AbortSignal } = {}) {
  const body = JSON.stringify({ id: 'chat-1', messages: [{ role: 'user', parts: [{ type: 'text', text: question }] }] });
  const headers: Record<string, string> = { 'content-type': 'application/json', 'content-length': String(body.length) };
  if (init.cookie) headers.cookie = init.cookie;
  return POST(new Request('http://localhost/api/chat', { method: 'POST', body, headers, signal: init.signal }));
}

const lastOutcome = () => (store.writeTrace.mock.calls.at(-1) as unknown as [{ outcome: string }])[0].outcome;

beforeEach(() => {
  vi.clearAllMocks();
  search.retrieve.mockResolvedValue({ searchQuery: 'q', hits: [hit], notFound: false, mode: 'hybrid_rerank' });
});

describe('POST /api/chat', () => {
  it('answers, saves the question with its answer, and traces "answered"', async () => {
    models.answerModel = modelSaying('No adjustment [1 "No dose adjustment is recommended for patients"].');
    const res = await ask('Apixaban in renal impairment?');
    await res.text();
    await vi.waitFor(() => expect(store.writeTrace).toHaveBeenCalled());
    expect(store.saveTurn).toHaveBeenCalledWith(expect.any(String), 'chat-1', 'Apixaban in renal impairment?', expect.any(String));
    expect(lastOutcome()).toBe('answered');
  });

  it('answers "not found" without calling the model when nothing relevant was retrieved', async () => {
    search.retrieve.mockResolvedValue({ searchQuery: 'q', hits: [], notFound: true, mode: 'hybrid_rerank' });
    const model = modelSaying('should not be used');
    models.answerModel = model;
    const res = await ask('Metformin dose?');
    expect(await res.text()).toContain(NOT_FOUND);
    await vi.waitFor(() => expect(lastOutcome()).toBe('not_found'));
    expect(model.doStreamCalls).toHaveLength(0);
    expect(store.saveTurn).toHaveBeenCalledWith(expect.any(String), 'chat-1', 'Metformin dose?', NOT_FOUND);
  });

  it('answers "which labels do you have?" from the label list, without search or the model', async () => {
    const model = modelSaying('should not be used');
    models.answerModel = model;
    const text = await (await ask('which drugs are listed?')).text();
    expect(text).toContain('2 prescribing labels are loaded');
    expect(text).toContain('Eliquis (apixaban)');
    await vi.waitFor(() => expect(lastOutcome()).toBe('library'));
    expect(search.retrieve).not.toHaveBeenCalled();
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it('flags an answer cut off by the token limit', async () => {
    models.answerModel = modelSaying('The list goes on [1 "No dose adjustment is recommended for patients"]', 'length');
    await (await ask('All interactions?')).text();
    await vi.waitFor(() => expect(lastOutcome()).toBe('answered_cut_off'));
  });

  it('saves nothing to the history when the model fails mid-answer', async () => {
    models.answerModel = modelSaying('Half an ans', 'stop', true);
    await (await ask('Dose?')).text();
    await vi.waitFor(() => expect(lastOutcome()).toBe('error'));
    expect(store.saveTurn).not.toHaveBeenCalled();
  });

  it('gives a new browser an owner cookie, and reuses a known one', async () => {
    models.answerModel = modelSaying('Ok [1 "No dose adjustment is recommended for patients"].');
    const first = await ask('Dose?');
    await first.text();
    expect(first.headers.get('set-cookie')).toMatch(/^dlqa_owner=[0-9a-f-]{36}; Path=\/api; HttpOnly; SameSite=Lax/);

    const owner = '0b0e4d47-9a51-4c38-9c5e-2f5f9c1d6a11';
    const again = await ask('Dose?', { cookie: `dlqa_owner=${owner}` });
    await again.text();
    expect(again.headers.get('set-cookie')).toBeNull();
    expect(store.loadHistory).toHaveBeenLastCalledWith(owner, 'chat-1');
  });

  it('rejects requests without a length, oversized, or with more than the new question', async () => {
    const big = 'x'.repeat(40_000);
    const tooBig = await POST(
      new Request('http://localhost/api/chat', { method: 'POST', body: big, headers: { 'content-length': String(big.length) } }),
    );
    expect(tooBig.status).toBe(413);

    const body = JSON.stringify({ id: 'c', messages: [{ role: 'user', parts: [] }, { role: 'user', parts: [] }] });
    const two = await POST(
      new Request('http://localhost/api/chat', { method: 'POST', body, headers: { 'content-length': String(body.length) } }),
    );
    expect(two.status).toBe(400);
    expect(search.retrieve).not.toHaveBeenCalled();
  });
});
