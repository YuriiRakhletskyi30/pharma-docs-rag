export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const MAX_GAP = 2; // non-matching short items allowed inside a run (page furniture, footnote marks)

/**
 * Which PDF text items to highlight for a cited passage.
 * Label wording repeats across sections, so instead of marking every item that occurs in the passage,
 * keep only the longest unbroken run of matching items (by matched characters).
 */
export function passageRun(items: string[], passage: string): Set<number> {
  const target = norm(passage);
  let best = { start: -1, end: -1, chars: 0 };
  let cur = { start: -1, end: -1, chars: 0 };
  let gap = 0;

  items.forEach((str, i) => {
    const n = norm(str);
    if (!n) return; // whitespace-only items neither extend nor break a run
    const hit = n.length >= 3 && target.includes(n);
    if (hit) {
      if (cur.start === -1) cur = { start: i, end: i, chars: 0 };
      cur.end = i;
      cur.chars += n.length;
      gap = 0;
      if (cur.chars > best.chars) best = { ...cur };
    } else if (cur.start !== -1 && n.length < 12 && ++gap <= MAX_GAP) {
      // short non-matching item inside a run: tolerate
    } else {
      cur = { start: -1, end: -1, chars: 0 };
      gap = 0;
    }
  });

  const marked = new Set<number>();
  for (let i = best.start; i >= 0 && i <= best.end; i++) if (norm(items[i])) marked.add(i);
  return marked;
}
