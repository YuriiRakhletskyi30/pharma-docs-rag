'use client';

import { FileText, LoaderCircle, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

export type DocItem = { id: number; title: string; pages: number; chunks: number };

export function Sidebar({ docs, onUploaded }: { docs: DocItem[] | null; onUploaded: () => void }) {
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
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-[15px] font-semibold tracking-tight">Drug Label Q&amp;A</h1>
        <p className="mt-1 text-[13px] leading-snug text-ink-2">
          Answers come only from these FDA prescribing labels, cited to the page.
        </p>
      </div>

      <div className="flex items-baseline justify-between px-5 pb-2">
        <h2 className="text-xs font-medium text-ink-2">Labels</h2>
        <span className="text-xs tabular-nums text-ink-3">{docs?.length ?? ''}</span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {docs === null &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="mx-2 my-2 h-8 animate-pulse rounded-md bg-line/60" />
          ))}
        {docs?.length === 0 && (
          <li className="px-2 py-3 text-[13px] text-ink-2">No labels yet. Upload a PDF to start.</li>
        )}
        {docs?.map((d) => (
          <li key={d.id}>
            <a
              href={`/api/documents/${d.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-panel/70"
              title="Open the full PDF"
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-ink-3 group-hover:text-accent" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] leading-5">{d.title}</span>
                <span className="block text-xs tabular-nums text-ink-3">
                  {d.pages} pages · {d.chunks} passages
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="border-t border-line p-4">
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
          className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-[13px] font-medium hover:border-ink-3 disabled:cursor-wait disabled:opacity-70"
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
          {!state.error && !state.done && <span className="text-ink-3">PDF with selectable text, up to 20 MB.</span>}
        </p>
      </div>
    </aside>
  );
}
