# Engineering standards

Back to the [README](../README.md). Known limits are in [next-steps.md](next-steps.md#known-limits).

Followed:
- TypeScript strict, ESLint, Vitest; CI on push runs typecheck, lint, tests (`.github/workflows/ci.yml`).
- Input validated at the API boundary with zod; uploaded PDF text escaped before it reaches the PDF text layer.
- Security headers from `next.config.ts`: a static CSP (nonces would force every page to render per request), `nosniff`, `frame-ancestors 'none'`, no `X-Powered-By`. Model answers render as text only: no images or links.
- Every outside call has a time limit (rewrite, embed and rerank 15 s; the answer 90 s) and stops when the user presses Stop.
- Rate limits checked before any paid call: per client (IP behind a trusted proxy, else the owner cookie) and in total, set from env; 429 with `Retry-After`.
- Server errors go to the JSON logs and, with `ERROR_WEBHOOK_URL`, to a webhook (`instrumentation.ts`); headers and query strings are left out.
- Questions about the library ("which labels are loaded?") are answered from the documents table, not by search or the model.
- `/api/health` checks the database; compose uses it as the app healthcheck. `next start` runs as PID 1 so it gets SIGTERM.
- Error and not-found pages; CI runs typecheck, lint, tests and `next build`.
- Small focused modules; pure functions unit-tested; comments only where the reason is not obvious; known shortcuts and their limits listed under Known limits.
- pnpm `minimumReleaseAge` of 1 day (supply-chain guard); lockfile committed.
- Clean-clone check: `git clone` + `docker compose up --build` on an empty database.

Skipped (and why):
- No E2E browser tests; UI checked by hand at 1440 px and at phone widths from 320 to 430 px.
- No auth (local demo). Rate limits are per instance, in memory.
- Evals not in CI: they need paid API keys as CI secrets.
- No integration test container for the search SQL; the eval exercises it against the real database.
