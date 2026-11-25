# Productionizing on AWS (or GCP / Azure)

Back to the [README](../README.md).

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
- Rate limits in a shared store (Redis / ElastiCache) instead of per-instance memory, and per-user once there is a login; data retention rules for stored questions.
