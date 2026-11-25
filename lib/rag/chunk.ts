export type Chunk = { page: number; heading: string | null; content: string };

// "7 DRUG INTERACTIONS", "2.4 Temporary Interruption for Surgery", or the boxed "WARNING: ...".
// FDA label sections run 1-17; text must start uppercase so "2.5 mg twice daily" is not a heading.
const HEADING = /^(?:(?:[1-9]|1[0-7])(?:\.\d{1,2})?\s+(?!NDC)[A-Z][A-Za-z]|WARNING:)/;

const MAX_CHARS = 1800; // ~450 tokens
const MIN_CHARS = 300;
const OVERLAP_LINES = 2;
const MAX_LINE = 600; // longer lines (PDFs without line breaks) are cut at word boundaries, so MAX_CHARS holds

function splitLong(line: string): string[] {
  const out: string[] = [];
  let rest = line;
  while (rest.length > MAX_LINE) {
    const cut = rest.lastIndexOf(' ', MAX_LINE);
    const at = cut > MAX_LINE / 2 ? cut : MAX_LINE;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Splits page texts into chunks that never cross a page (so a citation points to one page).
 * A new chunk starts at a section heading or when the size cap is hit (with a small line overlap).
 * Each chunk carries the heading in effect where it starts.
 */
export function chunkPages(pages: string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let heading: string | null = null;

  pages.forEach((text, i) => {
    const page = i + 1;
    let lines: string[] = [];
    let chunkHeading = heading;

    const flush = () => {
      const content = lines.join('\n').trim();
      if (content) chunks.push({ page, heading: chunkHeading, content });
    };

    const all = text.split('\n').flatMap((raw) => (raw.trim() ? splitLong(raw.trim()) : []));
    for (const line of all) {
      const size = lines.join('\n').length;

      if (HEADING.test(line)) {
        if (size >= MIN_CHARS) {
          flush();
          lines = [];
        }
        heading = line;
        if (lines.length === 0) chunkHeading = heading;
      } else if (size + line.length > MAX_CHARS) {
        flush();
        lines = lines.slice(-OVERLAP_LINES);
        // drop overlap that would push the new chunk over the cap
        while (lines.length && lines.join('\n').length + 1 + line.length > MAX_CHARS) lines.shift();
        chunkHeading = heading;
      }
      lines.push(line);
    }
    flush();
  });

  return chunks;
}
