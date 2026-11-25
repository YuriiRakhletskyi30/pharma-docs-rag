<!-- Yurii: rewrite this file in your own words, then delete this line. Facts below are a starting point. -->

# Working on this repo (people and coding agents)

## Stack and commands
- Next.js 16 (App Router, Cache Components on), TypeScript, Tailwind v4, Postgres 17 + pgvector, Drizzle.
- AI SDK v7 with `@ai-sdk/anthropic` and the community `voyage-ai-provider`.
- `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm eval`, `pnpm migrate`, `pnpm seed`, `pnpm build-seed`.
- Node 24 (unpdf requires it).

## Rules
- Run `pnpm typecheck && pnpm lint && pnpm test` before every commit.
- RAG logic lives in `lib/rag/*` as small, plain functions; pure ones get a unit test in `tests/`.
- Retrieval or prompt changes: run `pnpm eval` and commit the updated `evals/results.md`.
- AI SDK v7, not v5/v6 examples: models are created with `anthropic('claude-sonnet-5-5')` (a bare string routes to Vercel AI Gateway), stream callbacks use `onEnd`, UI streams use `createUIMessageStream` + `toUIMessageStream`.
- Next 16: read `node_modules/next/dist/docs/` before using a Next API; route segment `dynamic` config is not allowed with Cache Components.
- No new dependency without a reason in the commit message. pnpm keeps a 1-day `minimumReleaseAge`.
- Never commit `.env` or keys.

## Review steps for generated code
<!-- Yurii: describe how you review what an agent writes (what you read line by line, what you test by hand). -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
