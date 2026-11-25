'use client';

import { ExternalLink, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { SourceRef } from '@/lib/types';

const PdfViewer = dynamic(() => import('./pdf-viewer'), {
  ssr: false,
  loading: () => <div className="m-3 flex-1 animate-pulse rounded bg-rail" />,
});

const iconBtn =
  'flex size-11 shrink-0 items-center justify-center rounded text-ink-2 hover:bg-rail hover:text-ink lg:size-8';

export function SourcePanel({ source, onClose }: { source: SourceRef; onClose: () => void }) {
  const [full, setFull] = useState(false);
  const [shownFor, setShownFor] = useState(source);
  const close = useRef<HTMLButtonElement>(null);

  // collapse the passage again when another citation opens
  if (shownFor !== source) {
    setShownFor(source);
    setFull(false);
  }

  useEffect(() => close.current?.focus(), [source]);

  // bullets of two-column lists extract as lone "•" lines; hide them in the preview
  const passage = source.content.replace(/^\s*•\s*$\n?/gm, '');

  return (
    <section
      role="dialog"
      aria-label={`Source ${source.n}: ${source.title}`}
      className="flex h-full min-h-0 flex-col border-l border-line bg-panel"
    >
      <header className="flex items-start gap-2 border-b border-line py-1.5 pr-1.5 pl-4 lg:py-3 lg:pr-3">
        <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded bg-cite-soft font-mono text-xs font-medium text-cite lg:mt-0.5">
          {source.n}
        </span>
        <div className="min-w-0 flex-1 py-1.5 lg:py-0">
          <h2 className="truncate text-sm font-semibold">{source.title}</h2>
          <p className="text-xs text-ink-3">
            <span className="line-clamp-2">{source.heading ?? 'Prescribing information'}</span>
            <span className="font-mono text-[11px]">p. {source.page}</span>
          </p>
        </div>
        <a
          href={`/api/documents/${source.documentId}/file#page=${source.page}`}
          target="_blank"
          rel="noreferrer"
          className={iconBtn}
          aria-label="Open the full PDF in a new tab"
          title="Open the full PDF"
        >
          <ExternalLink className="size-4" strokeWidth={1.75} />
        </a>
        <button ref={close} type="button" onClick={onClose} className={iconBtn} aria-label="Close source">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="shrink-0 border-b border-line px-4 py-3">
        <p className="mb-1.5 text-xs font-medium text-ink-3">Passage sent to the model</p>
        <p
          className={`border-l-2 border-mark-edge pl-3 text-[13.5px] leading-relaxed whitespace-pre-line text-ink ${
            full ? 'max-h-[40vh] overflow-y-auto' : 'max-h-32 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]'
          }`}
        >
          {passage}
        </p>
        <button
          type="button"
          onClick={() => setFull((f) => !f)}
          className="mt-1 min-h-11 text-xs font-medium text-ink-2 hover:text-ink hover:underline lg:min-h-0"
        >
          {full ? 'Show less' : 'Show full passage'}
        </button>
      </div>

      <PdfViewer documentId={source.documentId} page={source.page} passage={source.content} />
    </section>
  );
}
