import { extractText, getDocumentProxy } from 'unpdf';

export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf);
  return text.map((t) => t.replaceAll('\0', '')); // Postgres text cannot store NUL bytes
}

const BODY_START = /^FULL PRESCRIBING INFORMATION\s*$/m;

/**
 * FDA labels open with a two-column Highlights block and a contents list that repeats
 * every heading; both extract as noise. Blank everything before the body starts.
 * Pages stay in place so page numbers still match the PDF.
 */
export function skipFrontMatter(pages: string[]): string[] {
  const start = pages.findIndex((p) => BODY_START.test(p));
  if (start === -1) return pages; // not an FDA label: keep everything
  return pages.map((p, i) => {
    if (i < start) return '';
    if (i > start) return p;
    return p.slice(p.search(BODY_START)).replace(BODY_START, '');
  });
}
