import { rerank } from 'ai';
import { voyage } from 'voyage-ai-provider';
import { sqlClient as sql } from '@/lib/db/client';
import { hasVoyage } from '@/lib/env';
import { embedQuery } from './embed';
import { rrf } from './rrf';

export const MODES = ['vector', 'hybrid', 'hybrid_rerank'] as const;
export type Mode = (typeof MODES)[number];

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
};

const CANDIDATES = 30;
export const TOP_K = 6;

async function vectorIds(query: string): Promise<number[]> {
  const vec = JSON.stringify(await embedQuery(query));
  const rows = await sql`
    select id from chunks where embedding is not null
    order by embedding <=> ${vec}::vector limit ${CANDIDATES}`;
  return rows.map((r) => r.id);
}

async function fullTextIds(query: string): Promise<number[]> {
  // OR the query terms: an AND of every word in a natural question rarely matches anything.
  // ts_rank_cd still ranks chunks with more (and closer) matching terms first.
  const rows = await sql`
    with q as (
      select nullif(replace(plainto_tsquery('english', ${query})::text, '&', '|'), '')::tsquery as q
    )
    select id from chunks, q where tsv @@ q.q
    order by ts_rank_cd(tsv, q.q) desc limit ${CANDIDATES}`;
  return rows.map((r) => r.id);
}

async function loadChunks(ids: number[]) {
  if (!ids.length) return [];
  const rows = await sql`
    select id, document_id, context, page, heading, content from chunks where id = any(${ids})`;
  const byId = new Map(rows.map((r) => [r.id as number, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r
      ? [{ id, documentId: r.document_id, title: r.context, page: r.page, heading: r.heading, content: r.content }]
      : [];
  });
}

/** Without a Voyage key every mode falls back to full-text only. */
export async function search(query: string, mode: Mode = 'hybrid_rerank'): Promise<Hit[]> {
  const lists = !hasVoyage
    ? [await fullTextIds(query)]
    : mode === 'vector'
      ? [await vectorIds(query)]
      : await Promise.all([vectorIds(query), fullTextIds(query)]);

  const fused = rrf(lists);
  const candidates = await loadChunks(fused.map((f) => f.id));
  const score = new Map(fused.map((f) => [f.id, f.score]));

  if (mode !== 'hybrid_rerank' || !hasVoyage || !candidates.length) {
    return candidates
      .slice(0, TOP_K)
      .map((c) => ({ ...c, score: score.get(c.id)!, reranked: false }));
  }

  const { ranking } = await rerank({
    model: voyage.reranking('rerank-3'),
    query,
    documents: candidates.map((c) => [c.title, c.heading, c.content].filter(Boolean).join('\n')),
    topN: TOP_K,
  });
  return ranking.map((r) => ({ ...candidates[r.originalIndex], score: r.score, reranked: true }));
}
