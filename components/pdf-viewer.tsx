'use client';

import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { passageRun } from './highlight';

// must live in the same module that renders <Document> (react-pdf requirement)
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// customTextRenderer returns HTML; uploaded PDFs are untrusted, so escape their text.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ZOOMS = [1, 1.25, 1.6, 2, 2.5];
// a label page drawn at phone width has ~5 px text; start phones at 200% (client-only module, window exists)
const startZoom = () => (window.innerWidth < 640 ? 2 : 1);

const iconBtn =
  'flex size-11 items-center justify-center rounded text-ink-2 hover:bg-rail hover:text-ink disabled:opacity-40 lg:size-8';

export default function PdfViewer({ documentId, page, passage }: { documentId: number; page: number; passage: string }) {
  const [current, setCurrent] = useState(page);
  const [shown, setShown] = useState({ page, documentId });
  const [total, setTotal] = useState<number>();
  const [width, setWidth] = useState<number>();
  const [zoom, setZoom] = useState<number | null>(null);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const box = useRef<HTMLDivElement>(null);

  // a new citation jumps to its page (state adjusted during render, no effect needed)
  if (shown.page !== page || shown.documentId !== documentId) {
    setShown({ page, documentId });
    setCurrent(page);
  }

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const z = zoom ?? startZoom();
  const zi = ZOOMS.indexOf(z);

  const highlight = useCallback(
    ({ str, itemIndex }: { str: string; itemIndex: number }) =>
      current === page && marked.has(itemIndex) ? `<mark>${esc(str)}</mark>` : esc(str),
    [current, page, marked],
  );

  // scroll only this box (scrollIntoView would also scroll the window), centring the first mark both ways
  const scrollToMark = () => {
    const el = box.current;
    const mark = el?.querySelector('mark');
    if (!el || !mark) return;
    const m = mark.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    el.scrollTo({
      top: m.top - b.top + el.scrollTop - el.clientHeight / 3,
      left: m.left - b.left + el.scrollLeft - 16,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1 font-mono text-[11px] text-ink-3 lg:px-3">
        <span className="px-2 tabular-nums">
          Page {current}
          {total ? ` of ${total}` : ''}
        </span>
        {current !== page && (
          <button
            type="button"
            onClick={() => setCurrent(page)}
            className="min-h-11 rounded px-2 font-medium text-ink-2 hover:bg-rail hover:text-ink lg:min-h-8"
          >
            Back to cited page {page}
          </button>
        )}
        <div className="ml-auto flex items-center">
          <button type="button" aria-label="Zoom out" disabled={zi <= 0} onClick={() => setZoom(ZOOMS[zi - 1])} className={iconBtn}>
            <ZoomOut className="size-4" strokeWidth={1.75} />
          </button>
          <span className="w-10 text-center tabular-nums">{Math.round(z * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zi >= ZOOMS.length - 1}
            onClick={() => setZoom(ZOOMS[zi + 1])}
            className={iconBtn}
          >
            <ZoomIn className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => setCurrent((c) => c - 1)}
            className={iconBtn}
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={!!total && current >= total}
            onClick={() => setCurrent((c) => c + 1)}
            className={iconBtn}
          >
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div ref={box} className="min-h-0 flex-1 overflow-auto bg-rail p-3">
        <Document
          file={`/api/documents/${documentId}/file`}
          onLoadSuccess={(d) => setTotal(d.numPages)}
          loading={<div className="h-[70vh] animate-pulse rounded bg-panel" />}
          error={<p className="p-4 text-sm text-danger">Could not load this PDF.</p>}
        >
          {width && (
            <Page
              className="pdf-page mx-auto w-fit shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
              pageNumber={current}
              width={Math.floor((width - 24) * z)}
              renderAnnotationLayer={false}
              onGetTextSuccess={({ items }) =>
                setMarked(passageRun(items.map((it) => ('str' in it ? it.str : '')), passage))
              }
              customTextRenderer={highlight}
              onRenderTextLayerSuccess={scrollToMark}
              loading={<div className="h-[70vh] animate-pulse rounded bg-panel" />}
            />
          )}
        </Document>
      </div>
    </div>
  );
}
