import { readFile } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sqlClient } from '@/lib/db/client';
import { saveDocument, type PreparedChunk } from '@/lib/rag/ingest';

export async function migrateDb() {
  await migrate(db, { migrationsFolder: 'drizzle' });
}

/** Loads the seed labels with their precomputed vectors. Skips labels already loaded. */
export async function seedLabels(log: (line: string) => void = console.log) {
  type SeedDoc = { title: string; setId: string; pages: number; chunks: PreparedChunk[] };
  const seed: SeedDoc[] = JSON.parse(await readFile('data/seed/vectors.json', 'utf8'));
  const existing = new Set((await sqlClient<{ filename: string }[]>`select filename from documents`).map((r) => r.filename));
  for (const doc of seed) {
    const filename = `${doc.setId}.pdf`;
    if (existing.has(filename)) continue;
    const pdf = await readFile(`data/seed/labels/${filename}`);
    await saveDocument({ title: doc.title, filename, pdf, pages: doc.pages, chunks: doc.chunks });
    log(`seeded ${doc.title} (${doc.chunks.length} chunks)`);
  }
}

// any fixed number works; it only has to be the same for every copy of the app
const RELEASE_LOCK = 4_802_017;

/**
 * Migrate, then seed, holding a Postgres advisory lock on one dedicated connection.
 * Copies started at the same time (several replicas, a release job and a restart) wait their turn
 * instead of racing; the lock is released when the connection closes, even if the process dies.
 */
export async function release(log: (line: string) => void = console.log) {
  const conn = await sqlClient.reserve();
  try {
    await conn`select pg_advisory_lock(${RELEASE_LOCK})`;
    await migrateDb();
    log('migrations applied');
    await seedLabels(log);
  } finally {
    await conn`select pg_advisory_unlock(${RELEASE_LOCK})`.catch(() => {});
    conn.release();
  }
}
