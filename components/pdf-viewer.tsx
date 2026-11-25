'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';

// must live in the same module that renders <Document> (react-pdf requirement)
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// customTextRenderer returns HTML; uploaded PDFs are untrusted, so escape their text.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function PdfViewer({ documentId, page, passage }: { documentId: number; page: number; passage: string }) {
  const [current, setCurrent] = useState(page);
  const [shown, setShown] = useState({ page, documentId });
  const [total, setTotal] = useState<number>();
  const [width, setWidth] = useState<number>();
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

  // Highlight text-layer items that appear in the cited passage, on the cited page only.
  // shortcut: matches per text item, so very short items are skipped; a span-level fuzzy match would be more exact.
  const target = norm(passage);
  const highlight = useCallback(
    ({ str }: { str: string }) => {
      const n = norm(str);
      return current === page && n.length > 12 && target.includes(n) ? `<mark>${esc(str)}</mark>` : esc(str);
    },
    [current, page, target],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-ink-2">
        <span className="tabular-nums">
          Page {current}
          {total ? ` of ${total}` : ''}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => setCurrent((c) => c - 1)}
            className="rounded p-1 hover:bg-rail disabled:opacity-40"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={!!total && current >= total}
            onClick={() => setCurrent((c) => c + 1)}
            className="rounded p-1 hover:bg-rail disabled:opacity-40"
          >
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div ref={box} className="min-h-0 flex-1 overflow-y-auto bg-rail p-3">
        <Document
          file={`/api/documents/${documentId}/file`}
          onLoadSuccess={(d) => setTotal(d.numPages)}
          loading={<div className="h-[70vh] animate-pulse rounded bg-panel" />}
          error={<p className="p-4 text-sm text-danger">Could not load this PDF.</p>}
        >
          {width && (
            <Page
              className="pdf-page mx-auto shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
              pageNumber={current}
              width={width}
              renderAnnotationLayer={false}
              customTextRenderer={highlight}
              onRenderTextLayerSuccess={() => {
                // scroll only this box (scrollIntoView would also scroll the window)
                const el = box.current;
                const mark = el?.querySelector('mark');
                if (!el || !mark) return;
                const top = mark.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
                el.scrollTo({ top: top - el.clientHeight / 3, behavior: 'smooth' });
              }}
              loading={<div className="h-[70vh] animate-pulse rounded bg-panel" />}
            />
          )}
        </Document>
      </div>
    </div>
  );
}
