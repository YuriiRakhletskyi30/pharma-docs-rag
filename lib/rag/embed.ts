import { embed, embedMany } from 'ai';
import { voyage } from 'voyage-ai-provider';
import { EMBEDDING_DIMS } from '@/lib/db/schema';

const model = voyage.embeddingModel('voyage-4');
const options = (inputType: 'query' | 'document') => ({
  voyage: { inputType, outputDimension: EMBEDDING_DIMS },
});

// Title + heading give the vector the context the raw chunk text lacks ("ELIQUIS" vs "apixaban").
export const embeddingText = (c: { context: string; heading: string | null; content: string }) =>
  [c.context, c.heading, c.content].filter(Boolean).join('\n');

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 128) {
    const { embeddings } = await embedMany({
      model,
      values: texts.slice(i, i + 128),
      providerOptions: options('document'),
    });
    out.push(...embeddings);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({ model, value: text, providerOptions: options('query') });
  return embedding;
}
