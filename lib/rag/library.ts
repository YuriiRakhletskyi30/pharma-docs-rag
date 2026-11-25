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

export function isLibraryQuestion(question: string): boolean {
  const q = question.toLowerCase().replace(/\s+/g, ' ').trim();
  if (q.length > 120 || CONTENT_WORDS.test(q)) return false;
  return ABOUT_LIBRARY.test(q) || LIST_REQUEST.test(q) || HOW_MANY.test(q);
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
