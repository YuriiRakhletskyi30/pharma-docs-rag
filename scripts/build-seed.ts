// Parses, chunks and embeds the seed labels once, so a fresh install needs no Voyage calls.
// Output: data/seed/vectors.json (committed).
import { readFile, writeFile } from 'node:fs/promises';
import labels from '../data/seed/labels.json' with { type: 'json' };
import { preparePdf } from '@/lib/rag/ingest';

const out = [];
for (const { title, setId } of labels) {
  const bytes = new Uint8Array(await readFile(`data/seed/labels/${setId}.pdf`));
  const { pages, chunks } = await preparePdf(title, bytes, { withEmbeddings: true });
  const rounded = chunks.map((c) => ({
    ...c,
    embedding: c.embedding!.map((v) => Math.round(v * 1e6) / 1e6),
  }));
  out.push({ title, setId, pages, chunks: rounded });
  console.log(`${title}: ${chunks.length} chunks`);
}
await writeFile('data/seed/vectors.json', JSON.stringify(out));
