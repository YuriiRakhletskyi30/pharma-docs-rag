/** A citation in the answer: [2] or, as the prompt asks, [2 "exact words from source 2"] (curly quotes too). */
export const CITATION = /\[(\d+)(?:\s+["“]([^"“”\]]*)["”])?\]/g;

export type Citation = { n: number; quote: string | null };

export function parseCitations(text: string): Citation[] {
  return [...text.matchAll(CITATION)].map((m) => ({ n: Number(m[1]), quote: m[2]?.trim() || null }));
}

/** Source numbers cited in the answer, in order of first use. */
export function citedNumbers(text: string): number[] {
  return [...new Set(parseCitations(text).map((c) => c.n))];
}

export const stripCitations = (text: string) => text.replace(CITATION, '');

// Compare without whitespace (PDF text breaks lines where the model's copy does not) but keep every other
// character: "2.5" must not match "25", and "<30" must not match ">30".
const norm = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑–—]/g, '-');
const squash = (s: string) => norm(s).replace(/\s+/g, '');
// a hyphen at a line end is either a split word ("impair-\nment") or a real hyphen ("Child-\nPugh"): accept both
const sourceForms = (s: string) => {
  const n = norm(s);
  return [n.replace(/-\s*\n\s*/g, ''), n].map((f) => f.replace(/\s+/g, ''));
};
const MIN_QUOTE = 12; // chars without spaces; shorter quotes ("the dose") prove nothing

/**
 * invalid: [n] points to no source that was sent.
 * unverified: a citation of source n has no quote, or its quote is not in source n's text.
 * A found quote shows the source contains those words; it does not prove they support the sentence.
 */
export function checkCitations(text: string, sources: string[]) {
  const all = parseCitations(text);
  const cited = [...new Set(all.map((c) => c.n))];
  const invalid = cited.filter((n) => n < 1 || n > sources.length);
  const source = sources.map(sourceForms);
  const unverified = cited.filter(
    (n) =>
      !invalid.includes(n) &&
      all.some((c) => {
        if (c.n !== n) return false;
        const q = c.quote ? squash(c.quote) : '';
        return q.length < MIN_QUOTE || !source[n - 1].some((f) => f.includes(q));
      }),
  );
  return { cited, invalid, unverified };
}

export type Outcome =
  | 'answered'
  | 'not_found'
  | 'not_found_by_model'
  | 'answered_invalid_citations'
  | 'answered_cut_off'
  | 'answered_no_citations'
  | 'answered_unverified_quotes'
  | 'aborted'
  | 'error';

/** One outcome per answer for the traces, worst problem first. */
export function classifyAnswer(a: {
  refused: boolean;
  invalid: number[];
  cutOff: boolean;
  uncited: boolean;
  unverified: number[];
}): Outcome {
  if (a.refused) return 'not_found_by_model';
  if (a.invalid.length) return 'answered_invalid_citations';
  if (a.cutOff) return 'answered_cut_off';
  if (a.uncited) return 'answered_no_citations';
  if (a.unverified.length) return 'answered_unverified_quotes';
  return 'answered';
}

/** A citation still being streamed: the UI hides it until it closes. */
export const PARTIAL_CITATION = /\[\d*(?:\s+["“][^"“”\]]*["”]?)?$/;

/** Text split around bare [n] marks (quotes already taken out): strings stay text, numbers become chips. */
export function splitCitations(text: string): (string | number)[] {
  return text
    .split(/(\[\d+\])/)
    .filter((part) => part !== '')
    .map((part) => (/^\[\d+\]$/.test(part) ? Number(part.slice(1, -1)) : part));
}
