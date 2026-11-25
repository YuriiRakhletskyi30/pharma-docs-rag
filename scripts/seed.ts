// Loads the seed labels with their precomputed vectors. Idempotent: skips labels already loaded.
import { readFile } from 'node:fs/promises';
import { sqlClient } from '@/lib/db/client';
import { saveDocument, type PreparedChunk } from '@/lib/rag/ingest';

type SeedDoc = { title: string; setId: string; pages: number; chunks: PreparedChunk[] };
const seed: SeedDoc[] = JSON.parse(await readFile('data/seed/vectors.json', 'utf8'));

const existing = new Set(
  (await sqlClient`select filename from documents`).map((r) => r.filename as string),
);

for (const doc of seed) {
  const filename = `${doc.setId}.pdf`;
  if (existing.has(filename)) continue;
  const pdf = await readFile(`data/seed/labels/${filename}`);
  await saveDocument({ title: doc.title, filename, pdf, pages: doc.pages, chunks: doc.chunks });
  console.log(`seeded ${doc.title} (${doc.chunks.length} chunks)`);
}
await sqlClient.end();
