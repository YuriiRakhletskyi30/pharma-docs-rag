// Runs before the app starts: stop early with a readable message instead of failing on the first question.
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  // lib/env.ts falls back to the local dev database; in production that would hide a missing setting
  console.error('DATABASE_URL is missing.');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}
if (!process.env.VOYAGE_API_KEY) {
  console.warn('VOYAGE_API_KEY is not set: running keyword search only (no embeddings, no rerank).');
}
