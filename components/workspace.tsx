'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowUp, Info, PanelLeft, RotateCcw, Square, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, SourceRef } from '@/lib/types';
import { Message } from './message';
import { Sidebar, type DocItem } from './sidebar';
import { SourcePanel } from './source-panel';

const EXAMPLES = [
  'What is the apixaban dose for atrial fibrillation patients with renal impairment?',
  'Which drugs interact with warfarin through CYP2C9?',
  'Compare how dabigatran and rivaroxaban should be stopped before surgery.',
  'What is the maximum aspirin dose with ticagrelor?',
];

export function Workspace() {
  const [docs, setDocs] = useState<DocItem[] | null>(null);
  const [semanticSearch, setSemanticSearch] = useState(true);
  const [selected, setSelected] = useState<SourceRef | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [input, setInput] = useState('');
  // undefined: useChat makes the first id; a random id here would run during prerender
  const [chatId, setChatId] = useState<string>();
  const end = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error, regenerate } = useChat<ChatMessage>({
    id: chatId,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const busy = status === 'submitted' || status === 'streaming';

  const loadDocs = useCallback(async () => {
    const res = await fetch('/api/documents');
    const json = await res.json();
    setDocs(json.documents);
    setSemanticSearch(json.semanticSearch);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    sendMessage({ text: q });
    setInput('');
  };

  const newChat = () => {
    setChatId(crypto.randomUUID());
    setSelected(null);
  };

  return (
    <div
      className={`grid h-full grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)] ${
        selected ? 'xl:grid-cols-[264px_minmax(0,1fr)_minmax(440px,42%)]' : ''
      }`}
    >
      {/* label rail: fixed drawer below lg */}
      <div
        className={`${railOpen ? 'fixed inset-y-0 left-0 z-30 w-[280px] shadow-xl' : 'hidden'} lg:static lg:block lg:w-auto lg:shadow-none`}
      >
        <Sidebar docs={docs} onUploaded={loadDocs} />
      </div>
      {railOpen && (
        <button
          aria-label="Close labels"
          className="fixed inset-0 z-20 bg-ink/20 lg:hidden"
          onClick={() => setRailOpen(false)}
        />
      )}

      <main className="flex h-full min-h-0 min-w-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
          <button
            type="button"
            className="rounded p-1.5 text-ink-2 hover:bg-rail lg:hidden"
            aria-label="Show labels"
            onClick={() => setRailOpen(true)}
          >
            <PanelLeft className="size-4" strokeWidth={1.75} />
          </button>
          <p className="hidden text-[13px] text-ink-2 sm:block">
            {semanticSearch ? 'Hybrid search: meaning + keywords, reranked' : 'Keyword search only'}
          </p>
          <button
            type="button"
            onClick={newChat}
            disabled={!messages.length}
            className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-ink-2 hover:bg-rail hover:text-ink disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">New conversation</span>
          </button>
        </header>

        {!semanticSearch && (
          <div className="flex items-start gap-2 border-b border-line bg-warn-soft px-4 py-2 text-[13px] text-warn-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span>
              No VOYAGE_API_KEY set: search matches keywords only, without meaning-based retrieval or reranking. Add the
              key to .env and restart for full quality.
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-7 px-5 py-8">
            {messages.length === 0 && (
              <div className="pt-[8vh]">
                <h2 className="text-2xl font-semibold tracking-tight text-balance">
                  Ask the prescribing information.
                </h2>
                <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
                  Every answer is built from label passages and cites them. Click a number to see the passage and the
                  page it came from. If the labels don&apos;t cover a question, it says so.
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {EXAMPLES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      className="rounded-lg border border-line bg-panel px-4 py-3 text-left text-[14px] leading-snug text-ink hover:border-accent"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <Message key={m.id} message={m} selected={selected} onCite={setSelected} />
            ))}

            {status === 'submitted' && (
              <p className="flex items-center gap-2 text-[14px] text-ink-2" role="status">
                <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                Searching the labels…
              </p>
            )}

            {error && (
              <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-[14px] text-danger">
                The answer failed to load.
                <button type="button" className="font-medium underline underline-offset-2" onClick={() => regenerate()}>
                  Try again
                </button>
              </div>
            )}
            <div ref={end} />
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="shrink-0 px-5 pb-4"
        >
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-xl border border-line bg-panel p-2 focus-within:border-accent">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Ask about dosing, interactions, warnings…"
                aria-label="Question"
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-ink-3 focus-visible:outline-none [field-sizing:content]"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Stop answering"
                  className="flex size-9 items-center justify-center rounded-lg bg-ink text-white hover:bg-ink-2"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Ask"
                  className="flex size-9 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-strong disabled:bg-line disabled:text-ink-3"
                >
                  <ArrowUp className="size-4" strokeWidth={2} />
                </button>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
              <Info className="size-3.5" strokeWidth={1.75} />
              Answers quote the drug label. Not medical advice.
            </p>
          </div>
        </form>
      </main>

      {selected && (
        <div className="fixed inset-0 z-40 xl:static xl:z-auto">
          <SourcePanel source={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
