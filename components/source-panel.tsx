'use client';

import { ExternalLink, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { SourceRef } from '@/lib/types';

const PdfViewer = dynamic(() => import('./pdf-viewer'), {
  ssr: false,
  loading: () => <div className="m-3 flex-1 animate-pulse rounded bg-rail" />,
});

export function SourcePanel({ source, onClose }: { source: SourceRef; onClose: () => void }) {
  return (
    <section aria-label="Cited source" className="flex h-full min-h-0 flex-col border-l border-line bg-panel">
      <header className="flex items-start gap-3 border-b border-line px-4 py-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-accent text-xs font-semibold tabular-nums text-white">
          {source.n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{source.title}</h2>
          <p className="truncate text-xs text-ink-2">
            {source.heading ?? 'Prescribing information'} · page {source.page}
          </p>
        </div>
        <a
          href={`/api/documents/${source.documentId}/file#page=${source.page}`}
          target="_blank"
          rel="noreferrer"
          className="rounded p-1 text-ink-2 hover:bg-rail hover:text-ink"
          aria-label="Open the full PDF in a new tab"
          title="Open the full PDF"
        >
          <ExternalLink className="size-4" strokeWidth={1.75} />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-ink-2 hover:bg-rail hover:text-ink"
          aria-label="Close source"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="max-h-44 shrink-0 overflow-y-auto border-b border-line px-4 py-3">
        <p className="mb-1.5 text-xs font-medium text-ink-2">Passage sent to the model</p>
        <p className="text-[13px] leading-relaxed whitespace-pre-line text-ink">
          {/* bullets of two-column lists extract as lone "•" lines; hide them in the preview */}
          {source.content.replace(/^\s*•\s*$\n?/gm, '')}
        </p>
      </div>

      <PdfViewer documentId={source.documentId} page={source.page} passage={source.content} />
    </section>
  );
}
