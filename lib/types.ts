import type { UIMessage } from 'ai';

export type SourceRef = {
  n: number;
  documentId: number;
  title: string;
  page: number;
  heading: string | null;
  content: string;
  score: number;
};

export type ChatMessage = UIMessage<
  never,
  {
    sources: { items: SourceRef[] };
    citations: { invalid: number[] };
  }
>;
