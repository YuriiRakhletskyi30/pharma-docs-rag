import { rerank } from 'ai';
import { voyage } from 'voyage-ai-provider';
import { sqlClient as sql } from '@/lib/db/client';
import { hasVoyage } from '@/lib/env';
import { embeddingText, embedQuery } from './embed';
import { UPLOAD_PREFIX } from '@/lib/constants';
import { rrf } from './rrf';

export const MODES = ['vector', 'hybrid', 'hybrid_rerank'] as const;
export type Mode = (typeof MODES)[number];

/** The mode a search actually runs: without a Voyage key every mode is full-text only. */
export const effectiveMode = (mode: Mode): Mode | 'fulltext' => (hasVoyage ? mode : 'fulltext');

export type Hit = {
  id: number;
  documentId: number;
  title: string;
  page: number;
  heading: string | null;
  content: string;
  /** rerank relevance (0-1) when reranked, otherwise the RRF score */
  score: number;
  reranked: boolean;
  /** from a user upload, not a seeded FDA label */
  uploaded: boolean;
};

type ChunkRow = {
  id: number;
  document_id: number;
  context: string;
  page: number;
  heading: string | null;
  content: string;
  uploaded: boolean;
};

const CANDIDATES = 30;
export const TOP_K = 6;

async function vectorIds(query: string, signal?: AbortSignal): Promise<number[]> {
  const vec = JSON.stringify(await embedQuery(query, signal));
  const rows = await sql<{ id: number }[]>`
    select id from chunks where embedding is not null
    order by embedding <=> ${vec}::vector limit ${CANDIDATES}`;
  return rows.map((r) => r.id);
}

async function fullTextIds(query: string): Promise<number[]> {
  // OR the query terms: an AND of every word in a natural question rarely matches anything.
  // ts_rank_cd still ranks chunks with more (and closer) matching terms first.
  const rows = await sql<{ id: number }[]>`
    with q as (
      select nullif(replace(plainto_tsquery('english', ${query})::text, '&', '|'), '')::tsquery as q
    )
    select id from chunks, q where tsv @@ q.q
    order by ts_rank_cd(tsv, q.q) desc limit ${CANDIDATES}`;
  return rows.map((r) => r.id);
}

async function loadChunks(ids: number[]) {
  if (!ids.length) return [];
  const rows = await sql<ChunkRow[]>`
    select c.id, c.document_id, c.context, c.page, c.heading, c.content,
           d.filename like ${UPLOAD_PREFIX + '%'} as uploaded
    from chunks c join documents d on d.id = c.document_id
    where c.id = any(${ids})`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  // keep the fused order
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r
      ? [
          {
            id,
            documentId: r.document_id,
            title: r.context,
            page: r.page,
            heading: r.heading,
            content: r.content,
            uploaded: r.uploaded,
          },
        ]
      : [];
  });
}

/** Without a Voyage key every mode falls back to full-text only. */
export async function search(query: string, mode: Mode = 'hybrid_rerank', signal?: AbortSignal): Promise<Hit[]> {
  const lists = !hasVoyage
    ? [await fullTextIds(query)]
    : mode === 'vector'
      ? [await vectorIds(query, signal)]
      : await Promise.all([vectorIds(query, signal), fullTextIds(query)]);

  const fused = rrf(lists);
  const candidates = await loadChunks(fused.map((f) => f.id));
  const score = new Map(fused.map((f) => [f.id, f.score]));

  if (mode !== 'hybrid_rerank' || !hasVoyage || !candidates.length) {
    return candidates
      .slice(0, TOP_K)
      .map((c) => ({ ...c, score: score.get(c.id) ?? 0, reranked: false }));
  }

  const { ranking } = await rerank({
    model: voyage.reranking('rerank-3'),
    query,
    documents: candidates.map((c) => embeddingText({ context: c.title, heading: c.heading, content: c.content })),
    topN: TOP_K,
    abortSignal: signal,
  });
  return ranking.map((r) => ({ ...candidates[r.originalIndex], score: r.score, reranked: true }));
}
