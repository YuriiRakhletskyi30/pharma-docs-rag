# Key technical decisions

Back to the [README](../README.md).

- One Next.js app instead of UI + separate API service: less plumbing for a build planned at about 10 hours; `lib/rag` is the seam to split along later.
- Docker image: multi-stage, production dependencies only, runs as the `node` user with `next start` as PID 1; Node pinned by version and digest. Not Next standalone output: that skips files the release step reads (seed data, migrations), so the image is larger (~800 MB) but has no tracing surprises.
- Migrations and seeding are a separate release step under a Postgres advisory lock: copies started together wait instead of racing (checked by running two at once on an empty database).
- PDFs stored in Postgres (bytea): one volume holds all state.
- Precomputed seed embeddings committed (9.6 MB): first start needs no Voyage calls; Voyage limits keys without a payment method to 3 requests/min.
- Label PDFs committed with attribution (`data/seed/SOURCES.md`); copyright status not verified, so these docs do not call them public domain.
- Follow-up rewrite with Haiku instead of embedding the whole conversation.
