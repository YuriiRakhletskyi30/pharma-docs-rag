'use client';

import { ChevronRight, FileText, LoaderCircle, SquarePen, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState, type Ref } from 'react';
import { MAX_UPLOAD_MB } from '@/lib/constants';
import type { SavedChat } from './history';

export type DocItem = { id: number; title: string; pages: number; chunks: number; uploaded: boolean };

type Props = {
  chats: SavedChat[];
  /** the chat on screen, once it has a message */
  activeId?: string;
  onOpenChat: (c: SavedChat) => void;
  onDeleteChat: (c: SavedChat) => void;
  onNewChat: () => void;
  docs: DocItem[] | null;
  docsError: boolean;
  onRetryDocs: () => void;
  /** the server accepts uploads (ALLOW_UPLOADS) */
  uploads: boolean;
  onUploaded: () => void;
  /** set when shown as the phone drawer */
  onClose?: () => void;
  closeRef?: Ref<HTMLButtonElement>;
};

const when = (t: number) => {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export function Sidebar(props: Props) {
  const { chats, activeId, onOpenChat, onDeleteChat, onNewChat, docs, docsError, onRetryDocs, uploads, onUploaded, onClose, closeRef } =
    props;
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; error?: string; done?: string }>({ busy: false });

  async function upload(file: File) {
    setState({ busy: true });
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/documents', { method: 'POST', body }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res?.ok) {
      setState({ busy: false, error: json?.error ?? 'Upload failed. Check the connection and try again.' });
      return;
    }
    setState({ busy: false, done: `Added "${json.title}" (${json.chunks} passages).` });
    onUploaded();
  }

  return (
    <aside className="flex h-full flex-col border-r border-line bg-rail">
      <div className="relative px-5 pt-5 pb-3">
        {onClose && (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close chats and labels"
            className="absolute top-2 right-2 flex size-11 items-center justify-center rounded text-ink-2 hover:bg-panel/70 hover:text-ink lg:hidden"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        )}
        <h1 className="text-[15px] font-semibold tracking-tight">Drug Label Q&amp;A</h1>
        <p className="mt-1 pr-8 text-[13px] leading-snug text-ink-2 lg:pr-0">
          Answers come only from FDA prescribing labels, cited to the page.
        </p>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-[13.5px] font-medium text-ink hover:bg-panel lg:min-h-9"
        >
          <SquarePen className="size-4 text-ink-2" strokeWidth={1.75} />
          New chat
        </button>
      </div>

      <h2 className="px-5 pt-1 pb-1.5 text-xs font-medium text-ink-3">Chats</h2>
      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {chats.length === 0 && (
          <li className="px-2 py-1 text-[13px] leading-snug text-ink-3">
            Your questions show up here. They stay in this browser only.
          </li>
        )}
        {chats.map((c) => {
          const active = c.id === activeId;
          return (
            <li key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => onOpenChat(c)}
                aria-current={active || undefined}
                className={`flex min-h-11 w-full flex-col justify-center rounded-md py-1.5 pr-10 pl-2 text-left lg:min-h-0 ${
                  active ? 'bg-panel' : 'hover:bg-panel/70'
                }`}
              >
                <span className={`line-clamp-2 text-[13.5px] leading-snug ${active ? 'text-ink' : 'text-ink-2'}`}>
                  {c.title}
                </span>
                <span className="font-mono text-[11px] text-ink-3">{when(c.updatedAt)}</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteChat(c)}
                aria-label={`Delete chat: ${c.title}`}
                className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded text-ink-3 hover:text-danger focus-visible:opacity-100 lg:size-8 lg:opacity-0 lg:group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ul>

      {/* labels are reference material: one line until opened */}
      <details className="group/labels shrink-0 border-t border-line">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 text-xs font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 transition-transform group-open/labels:rotate-90" strokeWidth={1.75} />
          Labels
          <span className="ml-auto font-mono text-[11px] text-ink-3">{docs?.length ?? ''}</span>
        </summary>
        <ul className="max-h-[40vh] overflow-y-auto px-3 pb-2">
          {docs === null &&
            Array.from({ length: 4 }, (_, i) => <li key={i} className="mx-2 my-2 h-7 animate-pulse rounded-md bg-line/60" />)}
          {docsError && (
            <li className="px-2 py-2 text-[13px] text-danger">
              Could not load the labels.{' '}
              <button type="button" onClick={onRetryDocs} className="min-h-11 font-medium underline underline-offset-2 lg:min-h-0">
                Try again
              </button>
            </li>
          )}
          {!docsError && docs?.length === 0 && (
            <li className="px-2 py-2 text-[13px] text-ink-2">
              No labels yet. {uploads ? 'Upload a PDF to start.' : 'Run the seed script to load them.'}
            </li>
          )}
          {docs?.map((d) => (
            <li key={d.id}>
              <a
                href={`/api/documents/${d.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="group flex min-h-11 items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-panel lg:min-h-0"
                title="Open the full PDF"
              >
                <FileText className="mt-0.5 size-3.5 shrink-0 text-ink-3 group-hover:text-ink" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] leading-5 text-ink-2 group-hover:text-ink">{d.title}</span>
                  <span className="block font-mono text-[11px] text-ink-3">
                    {d.pages} pages · {d.chunks} passages
                    {d.uploaded && <span className="text-warn-ink"> · uploaded</span>}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        {uploads && (
          <div className="px-4 pb-4">
            <input
              ref={input}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) upload(f);
              }}
            />
            <button
              type="button"
              disabled={state.busy}
              onClick={() => input.current?.click()}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-[13px] font-medium hover:border-ink-3 disabled:cursor-wait disabled:opacity-70 lg:min-h-0"
            >
              {state.busy ? (
                <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Upload className="size-4" strokeWidth={1.75} />
              )}
              {state.busy ? 'Reading PDF…' : 'Upload a label PDF'}
            </button>
            <p role="status" className="mt-2 min-h-4 text-xs leading-snug">
              {state.error && <span className="text-danger">{state.error}</span>}
              {state.done && <span className="text-ink-2">{state.done}</span>}
              {!state.error && !state.done && (
                <span className="text-ink-3">PDF with selectable text, up to {MAX_UPLOAD_MB} MB. Every user will see it as a source.</span>
              )}
            </p>
          </div>
        )}
      </details>
    </aside>
  );
}
