import type { UIMessage } from 'ai';

export type SourceRef = {
  n: number;
  documentId: number;
  title: string;
  page: number;
  heading: string | null;
  content: string;
  score: number;
  /** from a user upload, not a seeded FDA label */
  uploaded: boolean;
  /** client only, set when opened from an answer: the words the answer quoted, and whether the server found them */
  quote?: string | null;
  quoteFound?: boolean;
};

export type ChatMessage = UIMessage<
  never,
  {
    sources: { items: SourceRef[] };
    /**
     * invalid: no such source; unverified: the quote was not found in that source;
     * cutOff: the answer hit the token limit; uncited: an answer with no citation at all
     */
    citations: { invalid: number[]; unverified: number[]; cutOff: boolean; uncited: boolean };
  }
>;
