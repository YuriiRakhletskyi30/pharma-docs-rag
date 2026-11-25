# What I'd do next

Back to the [README](../README.md).

- Fix the keyword leg (AND first, OR fallback, or weight RRF) and re-run the ablation.
- Parse SPL XML instead of PDFs for exact sections and tables.
- Metadata filters (by label / section) and a compare-drugs view.
- Claim-level support check (an LLM judge per sentence): the quote check proves the words are in the source, not that they back the claim.
- Bigger eval set from a pharmacist, plus eval runs in CI against a seeded database.
- Auth, shared rate limits, async ingest worker, S3 storage.

## Known limits

- Tables flatten to text in extraction; cells lose their row/column meaning.
- Scanned (image-only) PDFs are rejected; no OCR.
- Keyword-only mode (no Voyage key) is noticeably weaker: it missed the Xarelto pre-surgery page that hybrid + rerank finds first.
- The in-PDF highlight matches text items against the passage, so table rows that share words with it can also light up.
- Prompt injection inside an uploaded PDF: delimiters are escaped and the prompt treats sources as data, but nothing strips instructions written in plain text inside a document.
- The relevance floor cannot separate all out-of-scope questions (score overlap in [RAG approach](rag-approach.md)).
- No auth: anyone who can reach the app can read all documents, and upload when `ALLOW_UPLOADS=true`. Keep it off on a shared server.
- Rate limits live in each instance's memory, so N replicas allow N times the limit; without a login a client can change its IP header or drop its cookie, so the global limit is what caps spend.
