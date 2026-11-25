// "Which labels do you have?" is a question about the library, not about label text: search cannot answer it
// (no passage says "this app holds 9 labels") and a model guessing from a few retrieved pages miscounts.
// Such questions are answered from the documents table instead, with no model call.

const ABOUT_LIBRARY =
  /\b(documents?|labels?|drugs?|medications?|medicines?|files?|pdfs?)\b.*\b(do (you|we) have|(you|we) have|have you got|are (loaded|available|listed|there|included|covered|in here)|is (loaded|available)|can (i|you) ask about|do you (know|cover|support))\b/;
const LIST_REQUEST = /^(list|show)( me)?( all)?( the)? (documents|labels|drugs|medications|files)\b/;
const HOW_MANY = /\bhow many (documents|labels|drugs|medications|files)\b/;
// words that make it a question about label content ("which drugs are listed as CYP2C9 inhibitors?")
const CONTENT_WORDS =
  /\b(interact\w*|dos(e|es|ing|age)|inhibit\w*|induc\w*|cyp\w*|renal|hepatic|kidney|liver|bleed\w*|surgery|warning\w*|contraindicat\w*|side effects?|adverse|pregnan\w*|reversal|overdose|as (an? )?\w+)\b/;

// After the library phrase only filler may follow. Anything else ("...for patients on dialysis",
// "...in a 2.5 mg tablet") makes it a clinical question that search has to answer.
const FILLER =
  /^((are|is|do you have|have you got|you have|we have|there|loaded|available|listed|included|covered|here|now|currently|in total|total|in (the|this) (app|library|system|database|tool)|please)\b\s*)*$/;

export function isLibraryQuestion(question: string): boolean {
  const q = question
    .toLowerCase()
    .replace(/[?.!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (q.length > 120 || CONTENT_WORDS.test(q)) return false;
  return [ABOUT_LIBRARY, LIST_REQUEST, HOW_MANY].some((re) => {
    const m = re.exec(q);
    return m !== null && FILLER.test(q.slice(m.index + m[0].length).trim());
  });
}

export function libraryAnswer(labels: { title: string; uploaded: boolean }[]): string {
  if (!labels.length) return 'No labels are loaded yet.';
  const lines = labels.map((l) => `- ${l.title}${l.uploaded ? ' (uploaded file, not a checked FDA label)' : ''}`);
  return [
    `${labels.length} prescribing ${labels.length === 1 ? 'label is' : 'labels are'} loaded:`,
    '',
    ...lines,
    '',
    'Ask about dosing, interactions, warnings or use in specific patient groups for any of them.',
  ].join('\n');
}
