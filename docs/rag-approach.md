# RAG approach and decisions

Back to the [README](../README.md).

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
- Ablation on 28 questions with an expected page: vector alone 100% hit@6 / MRR 0.79; hybrid without rerank 75% / 0.51; hybrid + rerank 100% / 0.92. The keyword leg alone adds noise on natural-language questions; the reranker is what makes hybrid pay off.

**LLM and orchestration**
- `claude-sonnet-5-5` answers, `claude-haiku-5-5` rewrites follow-ups and judges evals. Model ids live in one file (`lib/rag/models.ts`); any AI SDK provider fits there.
- Vercel AI SDK for streaming and provider swap; no RAG framework. Considered LangChain.js / LlamaIndex.TS: more abstraction than a pipeline this size needs.

**Prompt and context management**
- System prompt: answer only from numbered sources, cite every sentence with a source number and a short exact quote, use one fixed not-found sentence when the sources don't answer, quote numbers as written, treat source text as data, keep answers under ~250 words and point to the section and page instead of copying long tables.
- Sources go into the last user turn as `<source id label page section>` blocks; history stays plain text with old citations stripped (each turn numbers its own sources).
- Last 6 turns kept on the server, keyed by the chat id and an owner id. The owner id is a random value in an httpOnly cookie the server sets on the first question, so a chat id copied from someone's browser reads nothing. Deleting a chat in the sidebar deletes its messages and traces on the server too. The chat list itself lives in the browser (`localStorage`): with no login, a server-side list would show every visitor's questions to everyone. From turn 2, Haiku rewrites the question into a standalone search query ("and on dialysis?" becomes "apixaban dosing ... dialysis").

**Guardrails**
- Relevance floor: if the best rerank score is below 0.4, reply "not found" without calling the LLM. On the eval set in-scope questions scored 0.73 or higher, but one out-of-scope question scored 0.74, so the floor only catches clear misses; the prompt rule is the backstop (on the eval set the floor refused 3 of the 5 out-of-scope questions, the prompt rule the other 2).
- Quoted citations: the model cites as `[n "4-10 words copied from source n"]`. The server checks that every `n` was sent (invalid ones are struck through) and that each quote appears word for word in source `n`, ignoring case, spacing and line-break hyphens but not digits, decimal points or signs ("25 mg" does not match "2.5 mg", ">30" does not match "<30"). Answers cut off by the token limit or with no citation at all get their own warning. A missing or unmatched quote marks that chip amber, adds a warning under the answer, and is logged as `answered_unverified_quotes`. The UI shows only the number; the quote is in the tooltip. This proves the words are in the source, not that they back the sentence.
- Source text and titles are escaped so a PDF or filename cannot close the `<source>` block or fake a new one.
- Personal treatment questions ("should my mother take 2.5 or 5 mg?"): the answer states the general label rule, does not apply it to the person, and defers to their clinician. First version applied the criteria to the mother; the prompt was tightened and the eval covers it.
- Input limits: chat body <= 32 KB and only the new question is sent (history comes from the database), question <= 1000 chars, answer <= 4000 tokens (a safety net; most answers use under 1500). Uploads: off unless `ALLOW_UPLOADS=true`, PDF only (magic bytes), 20 MB checked from `Content-Length` before the body is read, 300 pages checked before embedding, scanned PDFs rejected. Uploaded labels are tagged in the sidebar. Fixed disclaimer in the UI.

**Quality controls and evals**
- 33 hand-checked questions in `evals/golden.json`, each pinned to a label page I read: 25 answerable across all nine labels (one two-drug comparison, 3 follow-ups that go through the query rewrite), 5 out of scope, 3 patient-specific.
- `pnpm eval`: hit@6 and MRR per retrieval mode, then full answers judged by Haiku against the reference facts (structured pass/fail + reason), plus deterministic checks for refusals, citations and quotes. Latest: 33/33, 88/88 cited quotes found word for word in their source, and the judge failed all 3 deliberately wrong control answers (a changed threshold, a false reversal claim, a dropped renal adjustment). 33/33 is a ceiling: the set catches regressions, it does not rank small quality changes. One out-of-scope question (vaccines) scored right at the 0.4 floor; the prompt rule is the backstop there. See `evals/results.md`.

**Observability**
- pino JSON logs with request id and conversation id.
- `traces` table: question, rewritten search query, mode, retrieved chunk ids/pages/scores, model, input/output tokens, latency, outcome (`answered`, `not_found`, `not_found_by_model`, `answered_invalid_citations`, `answered_cut_off`, `answered_no_citations`, `answered_unverified_quotes`, `aborted`, `error`). Every request writes one, including stopped and failed ones. A question and its answer are saved to the history together, so a stopped turn leaves nothing half-written.
- Considered Langfuse: its self-hosted setup adds several services to compose. OpenTelemetry / Langfuse is the production step.
