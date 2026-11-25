import { db } from '@/lib/db/client';
import { chunks, documents } from '@/lib/db/schema';
import { hasVoyage } from '@/lib/env';
import { chunkPages } from './chunk';
import { embedDocuments, embeddingText } from './embed';
import { pdfPages, skipFrontMatter } from './pdf';

export type PreparedChunk = {
  page: number;
  heading: string | null;
  content: string;
  embedding: number[] | null;
};

/** Parse + chunk + (optionally) embed. No DB writes, so the seed builder can reuse it. */
export async function preparePdf(title: string, bytes: Uint8Array, withEmbeddings = hasVoyage) {
  const pages = await pdfPages(bytes);
  const parts = chunkPages(skipFrontMatter(pages));
  const vectors = withEmbeddings
    ? await embedDocuments(parts.map((c) => embeddingText({ context: title, ...c })))
    : null;
  return {
    pages: pages.length,
    chunks: parts.map((c, i): PreparedChunk => ({ ...c, embedding: vectors?.[i] ?? null })),
  };
}

export async function saveDocument(input: {
  title: string;
  filename: string;
  pdf: Buffer;
  pages: number;
  chunks: PreparedChunk[];
}) {
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(documents)
      .values({ title: input.title, filename: input.filename, pdf: input.pdf, pages: input.pages })
      .returning({ id: documents.id });
    if (input.chunks.length) {
      await tx
        .insert(chunks)
        .values(input.chunks.map((c) => ({ ...c, documentId: doc.id, context: input.title })));
    }
    return { id: doc.id, chunks: input.chunks.length };
  });
}
