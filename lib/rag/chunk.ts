export type Chunk = { page: number; heading: string | null; content: string };

// "7 DRUG INTERACTIONS", "2.4 Temporary Interruption for Surgery", or the boxed "WARNING: ...".
// FDA label sections run 1-17; text must start uppercase so "2.5 mg twice daily" is not a heading.
const HEADING = /^(?:(?:[1-9]|1[0-7])(?:\.\d{1,2})?\s+(?!NDC)[A-Z][A-Za-z]|WARNING:)/;

const MAX_CHARS = 1800; // ~450 tokens
const MIN_CHARS = 300;
const OVERLAP_LINES = 2;

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

    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
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
        chunkHeading = heading;
      }
      lines.push(line);
    }
    flush();
  });

  return chunks;
}
