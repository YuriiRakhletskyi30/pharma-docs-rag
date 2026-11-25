import { z } from 'zod';

// Keys are optional here so `next build` (which loads route modules) works without secrets.
// scripts/check-env.ts fails fast at container start when the required key is missing.
const schema = z.object({
  DATABASE_URL: z.string().default('postgres://rag:rag@localhost:5433/rag'),
  ANTHROPIC_API_KEY: z.string().optional(),
  // without it the app runs full-text search only, no embeddings or rerank
  VOYAGE_API_KEY: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
});

export const env = schema.parse(process.env);
export const hasVoyage = Boolean(env.VOYAGE_API_KEY);
