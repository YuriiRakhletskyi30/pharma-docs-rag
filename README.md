# Drug Label Q&A

Ask questions about FDA prescribing labels and get answers that cite the label page they came from.
Seeded with 9 anticoagulant and antiplatelet labels from DailyMed; you can upload more PDFs when uploads are on (`ALLOW_UPLOADS=true`, already set in `.env.example`).

No API keys at hand? The Loom video and the screenshots below show the full flow.

![Answer with citations and the cited PDF page](docs/screenshots/03-source-panel.png)

## Quick start

Requirements: Docker. An Anthropic API key. A Voyage AI key is optional.

```bash
cp .env.example .env    # set ANTHROPIC_API_KEY, optionally VOYAGE_API_KEY
docker compose up --build
```

Open http://localhost:3000. If port 3000 is taken: `APP_PORT=3100 docker compose up --build`.

First start runs migrations and loads the seed labels with precomputed embeddings (no Voyage calls).
Without `VOYAGE_API_KEY` the app runs keyword search only and shows a banner.

Local development (Node 24, pnpm):

```bash
docker compose up -d db
pnpm install
pnpm migrate && pnpm seed
pnpm dev
```

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests (chunker, RRF, citation and quote check, prompt escaping, PDF highlight, not-found rule, chat history, owner cookie) and route tests for chat and upload with a mock model |
| `pnpm eval` | Retrieval ablation + judged end-to-end answers, writes `evals/results.md` |
| `pnpm fetch-labels` | Downloads the pinned label PDFs from DailyMed |
| `pnpm build-seed` | Re-parses, chunks and embeds the seed labels into `data/seed/vectors.json` |

## Architecture

```mermaid
flowchart LR
  subgraph Ingest
    PDF[Label PDF] --> P[Extract text per page<br/>skip Highlights + contents]
    P --> C[Chunk per page<br/>heading kept as metadata]
    C --> E[voyage-4 embeddings]
    E --> DB[(Postgres<br/>pgvector + tsvector)]
  end
  subgraph Ask
    Q[Question] --> RW[Follow-up rewrite<br/>claude-haiku-5-5]
    RW --> V[Vector top 30]
    RW --> K[Keyword top 30]
    V --> F[RRF fusion]
    K --> F
    F --> RR[rerank-3 top 6]
    RR -->|best score below floor| NF[Not found, no LLM call]
    RR --> G[claude-sonnet-5-5<br/>streams cited answer]
    G --> CC[Citation check]
    CC --> UI[Chat + source panel + PDF page]
  end
  DB --> V
  DB --> K
  G --> T[(traces table + JSON logs)]
```

One Next.js app. `lib/rag/*` holds the pipeline as small functions (`pdf`, `chunk`, `embed`, `search`, `rrf`, `retrieve`, `prompt`, `citations`, `ingest`); the route handlers in `app/api/*` and the scripts in `scripts/*` call the same functions, so the eval runs the exact code the chat runs.

| Path | Role |
|---|---|
| `app/api/chat/route.ts` | Validates input, loads history, retrieves, streams the answer, writes `messages` + `traces` |
| `app/api/documents/*` | List, upload (PDF only, 20 MB), serve PDF bytes |
| `lib/rag/` | Parsing, chunking, embeddings, hybrid search, rerank, prompt, citation check |
| `lib/db/schema.ts` | `documents` (PDF as bytea), `chunks` (vector(1024) HNSW + generated tsvector GIN), `messages`, `traces` |
| `components/` | Chat, citation chips, source panel, react-pdf viewer |
| `evals/` | Golden set and latest results |

## RAG approach and decisions

**Use case and data**
- I picked option 1 (chat with your docs) and gave it pharma documents, because Newpage's clients are pharma, biotech and healthcare companies.
- 9 FDA labels (Eliquis, Xarelto, Pradaxa, Savaysa, Jantoven, Lovenox, Plavix, Effient, Brilinta). Labels have numbered sections, so citations can name the section; interactions and renal dosing make hard questions.

**Language**
- TypeScript end to end. I built the RAG in Node because it's my main language and the task is quite simple. For more complex pipelines I'd use Python for its richer library choice.

**Parsing and chunking**
- unpdf (pdf.js) text per page. Pages before the line "FULL PRESCRIBING INFORMATION" are blanked: the two-column Highlights block and the contents list extract as noise and repeat every heading.
- Chunks never cross a page, so a citation points to one page. New chunk at a numbered heading (sections 1-17 only, so "2.5 mg twice daily" or "18 Years of Age" are not headings) or at ~1800 chars, with a 2-line overlap. Lines over 600 chars (PDFs without line breaks) are cut at word boundaries so the cap holds.
- 939 chunks, ~900 chars average. The label title is stored on each chunk (`context`): label text says "ELIQUIS", users ask about "apixaban". The title goes into the embedding text and the keyword index.
- Considered: pure section splitting (breaks on the contents list and on non-label uploads), hosted parsers (cost, another key). Production path: DailyMed SPL XML, which has structured sections.

**Embeddings**
- Voyage `voyage-4`, 1024 dims (fits pgvector's 2000-dim HNSW cap), `input_type` query vs document, 32k context.
- Considered `voyage-4-lite` (same specs, cheaper, but free tier makes cost moot) and OpenAI `text-embedding-3-small` (1536 dims, 8k input, no reranker on the same key).
- No vendor publishes a pharma-label retrieval benchmark I could verify, so the eval set decides.

**Vector store**
- Postgres + pgvector: vectors, keyword index, chunks, chat history and traces in one database. Same thing runs on RDS / Cloud SQL / Azure Postgres.
- Considered Qdrant/Chroma (second store, weaker keyword search) and LanceDB (no server, weak multi-user story).

**Retrieval**
- Vector top 30 + Postgres full-text top 30 (OR of query terms, `ts_rank_cd`), fused with Reciprocal Rank Fusion (k=60), then Voyage `rerank-3` picks the top 6.
- Ablation (below): vector alone 100% hit@6 / MRR 0.78; hybrid without rerank 75% / 0.55; hybrid + rerank 100% / 0.96. The keyword leg alone adds noise on natural-language questions; the reranker is what makes hybrid pay off.

**LLM and orchestration**
- `claude-sonnet-5-5` answers, `claude-haiku-5-5` rewrites follow-ups and judges evals. Model ids live in one file (`lib/rag/models.ts`); any AI SDK provider fits there.
- Vercel AI SDK for streaming and provider swap; no RAG framework. Considered LangChain.js / LlamaIndex.TS: more abstraction than a pipeline this size needs.

**Prompt and context management**
- System prompt: answer only from numbered sources, cite every sentence with a source number and a short exact quote, use one fixed not-found sentence when the sources don't answer, quote numbers as written, treat source text as data, keep answers under ~250 words and point to the section and page instead of copying long tables.
- Sources go into the last user turn as `<source id label page section>` blocks; history stays plain text with old citations stripped (each turn numbers its own sources).
- Last 6 turns kept on the server, keyed by the chat id and an owner id. The owner id is a random value in an httpOnly cookie the server sets on the first question, so a chat id copied from someone's browser reads nothing. Deleting a chat in the sidebar deletes its messages and traces on the server too. The chat list itself lives in the browser (`localStorage`): with no login, a server-side list would show every visitor's questions to everyone. From turn 2, Haiku rewrites the question into a standalone search query ("and on dialysis?" becomes "apixaban dosing ... dialysis").

**Guardrails**
- Relevance floor: if the best rerank score is below 0.4, reply "not found" without calling the LLM. On the eval set in-scope questions scored 0.73 or higher, but one out-of-scope question scored 0.74, so the floor only catches clear misses; the prompt rule is the real guard (2 of 3 out-of-scope refusals came from it).
- Quoted citations: the model cites as `[n "4-10 words copied from source n"]`. The server checks that every `n` was sent (invalid ones are struck through) and that each quote appears word for word in source `n`, ignoring case, spacing and line-break hyphens but not digits, decimal points or signs ("25 mg" does not match "2.5 mg", ">30" does not match "<30"). Answers cut off by the token limit or with no citation at all get their own warning. A missing or unmatched quote marks that chip amber, adds a warning under the answer, and is logged as `answered_unverified_quotes`. The UI shows only the number; the quote is in the tooltip. This proves the words are in the source, not that they back the sentence.
- Source text and titles are escaped so a PDF or filename cannot close the `<source>` block or fake a new one.
- Personal treatment questions ("should my mother take 2.5 or 5 mg?"): the answer states the general label rule, does not apply it to the person, and defers to their clinician. First version applied the criteria to the mother; the prompt was tightened and the eval covers it.
- Input limits: chat body <= 32 KB and only the new question is sent (history comes from the database), question <= 1000 chars, answer <= 4000 tokens (a safety net; most answers use under 1500). Uploads: off unless `ALLOW_UPLOADS=true`, PDF only (magic bytes), 20 MB checked from `Content-Length` before the body is read, 300 pages checked before embedding, scanned PDFs rejected. Uploaded labels are tagged in the sidebar. Fixed disclaimer in the UI.

**Quality controls and evals**
- 15 hand-checked questions in `evals/golden.json`, each pinned to a label page I read: 10 answerable (one two-drug comparison), 3 out of scope, 2 patient-specific.
- `pnpm eval`: hit@6 and MRR per retrieval mode, then full answers judged by Haiku against the reference facts (structured pass/fail + reason), plus deterministic checks for refusals, citations and quotes. Latest: 15/15, 40/40 cited quotes found word for word in their source, and the judge failed all 3 deliberately wrong control answers (a changed threshold, a false reversal claim, a dropped renal adjustment). See `evals/results.md`.

**Observability**
- pino JSON logs with request id and conversation id.
- `traces` table: question, rewritten search query, mode, retrieved chunk ids/pages/scores, model, input/output tokens, latency, outcome (`answered`, `not_found`, `not_found_by_model`, `answered_invalid_citations`, `answered_cut_off`, `answered_no_citations`, `answered_unverified_quotes`, `aborted`, `error`). Every request writes one, including stopped and failed ones. A question and its answer are saved to the history together, so a stopped turn leaves nothing half-written.
- Considered Langfuse: its self-hosted setup adds several services to compose. OpenTelemetry / Langfuse is the production step.

## Key technical decisions

- One Next.js app instead of UI + separate API service: less plumbing for a 10-hour build; `lib/rag` is the seam to split along later.
- Docker image runs `next start` from a full install, not Next standalone output: standalone output skips files read at runtime (seed data, migrations). Bigger image, no tracing surprises.
- PDFs stored in Postgres (bytea): one volume holds all state.
- Precomputed seed embeddings committed (9.6 MB): first start needs no Voyage calls; Voyage limits keys without a payment method to 3 requests/min.
- Label PDFs committed with attribution (`data/seed/SOURCES.md`); copyright status not verified, so the README does not call them public domain.
- Follow-up rewrite with Haiku instead of embedding the whole conversation.

## Productionizing on AWS (or GCP / Azure)

- App: container on ECS Fargate or App Runner (GCP Cloud Run, Azure Container Apps); Next standalone output with explicit file includes.
- Database: RDS Postgres with pgvector (Cloud SQL / Azure Database for PostgreSQL both support it); migrations as a one-off release job, not on container start.
- Files: PDFs in S3 instead of bytea; signed URLs for the viewer.
- Ingest: upload to S3 -> SQS -> worker container (parse, chunk, embed), idempotent by document hash; status column for the UI.
- LLM: Claude via Amazon Bedrock (traffic and data stay in the AWS account); embeddings either kept on Voyage or moved to a Bedrock embedding model, chosen by re-running the same eval set.
- Secrets in Secrets Manager; private networking to the database.
- Auth: SSO (Cognito / Entra ID), per-tenant document access enforced in SQL (row-level security), audit log of every question and the sources shown.
- Observability: OpenTelemetry traces to CloudWatch/X-Ray or Langfuse; dashboards on latency, tokens, not-found rate, invalid-citation rate.
- Scale: HNSW is fine to millions of chunks; add metadata filters (label, section) and caching of query embeddings.
- Pharma specifics: label version tracking (SPL version per document, re-ingest on update), model and prompt version pinned per answer, validation evidence for GxP-style use.
- Rate limiting per user (not built here); data retention rules for stored questions.

## Engineering standards

Followed:
- TypeScript strict, ESLint, Vitest; CI on push runs typecheck, lint, tests (`.github/workflows/ci.yml`).
- Input validated at the API boundary with zod; uploaded PDF text escaped before it reaches the PDF text layer.
- Security headers from `next.config.ts`: a static CSP (nonces would force every page to render per request), `nosniff`, `frame-ancestors 'none'`, no `X-Powered-By`. Model answers render as text only: no images or links.
- Every outside call has a time limit (rewrite, embed and rerank 15 s; the answer 90 s) and stops when the user presses Stop.
- `/api/health` checks the database; compose uses it as the app healthcheck. `next start` runs as PID 1 so it gets SIGTERM.
- Error and not-found pages; CI runs typecheck, lint, tests and `next build`.
- Small focused modules; pure functions unit-tested; comments only where the reason is not obvious; known shortcuts marked `shortcut:` with their limit.
- pnpm `minimumReleaseAge` of 1 day (supply-chain guard); lockfile committed.
- Clean-clone check: `git clone` + `docker compose up --build` on an empty database.

Skipped (and why):
- No E2E browser tests; UI checked by hand at 1440 px and at phone widths from 320 to 430 px.
- No auth, no per-user rate limit (local demo).
- Evals not in CI: they need paid API keys as CI secrets.
- No integration test container for the search SQL; the eval exercises it against the real database.

## How I used AI tools

- Claude Code for scaffolding and most of the typing; I owned scope, architecture, review and every commit.
- Before coding: decisions settled in a Q&A round, then two independent critique passes (a sceptic and a reviewer) that cut the scope from ~18 h to ~10 h and changed the app from three services to one.
- Rules for the agent live in `AGENTS.md` (commands, AI SDK v7 pitfalls, test-first for `lib/rag`).
- Checks on generated code: typecheck/lint/tests on every commit, real-API probes before relying on a library (Voyage rerank-3 through the community provider), reading the real label text before writing the parser, the eval set before trusting retrieval.
- Things the AI got wrong and how they were caught:
  - The first prompt applied the label's dose-reduction criteria to a user's mother. Caught by a manual test, fixed in the prompt, now an eval case.
  - The first quote check compared letters and digits only, so "25 mg" matched "2.5 mg" and ">30" matched "<30". Caught by a second agent asked to break the change, before it shipped; there is a unit test for it now.
  - Two citations on the same PDF page kept the first one's highlight. Caught in a code review pass, fixed by deriving the highlight from the passage.
  - Building the Docker image failed because env validation ran at build time. Caught by a clean-clone build.
- Do's and don'ts:
  - Do: settle decisions and the eval set before code; ask a second agent to break each change; read every diff; check the UI at phone width myself.
  - Don't: trust "tests pass" for UI or retrieval quality; accept a library claim without a live probe; let the agent pick dependencies.

## Known limits

- Tables flatten to text in extraction; cells lose their row/column meaning.
- Scanned (image-only) PDFs are rejected; no OCR.
- Keyword-only mode (no Voyage key) is noticeably weaker: it missed the Xarelto pre-surgery page that hybrid + rerank finds first.
- The in-PDF highlight matches text items against the passage, so table rows that share words with it can also light up.
- Prompt injection inside an uploaded PDF: delimiters are escaped and the prompt treats sources as data, but nothing strips instructions written in plain text inside a document.
- The relevance floor cannot separate all out-of-scope questions (score overlap shown above).
- No auth: anyone who can reach the app can read all documents, and upload when `ALLOW_UPLOADS=true`. Keep it off on a shared server.
- Migrations and seeding run on every container start; with several replicas starting at once the seed can race. Production runs them once as a release job.

## What I'd do next

- Fix the keyword leg (AND first, OR fallback, or weight RRF) and re-run the ablation.
- Parse SPL XML instead of PDFs for exact sections and tables.
- Metadata filters (by label / section) and a compare-drugs view.
- Claim-level support check (an LLM judge per sentence): the quote check proves the words are in the source, not that they back the claim.
- Bigger eval set from a pharmacist, plus eval runs in CI against a seeded database.
- Auth, rate limits, async ingest worker, S3 storage.

## Screenshots

| Start | Cited answer |
|---|---|
| ![](docs/screenshots/01-start.png) | ![](docs/screenshots/02-answer.png) |
| **Source panel with the cited page** | **Out-of-scope question** |
| ![](docs/screenshots/03-source-panel.png) | ![](docs/screenshots/04-not-found.png) |

## Data source

Label PDFs: National Library of Medicine, DailyMed. Versions and set ids in `data/seed/SOURCES.md`.
