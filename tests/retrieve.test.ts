import { describe, expect, it } from 'vitest';
import { isNotFound, RELEVANCE_FLOOR, toSourceRefs } from '@/lib/rag/retrieve';
import type { Hit } from '@/lib/rag/search';

const hit = (score: number, reranked: boolean): Hit => ({
  id: 1,
  documentId: 2,
  title: 'Xarelto (rivaroxaban)',
  page: 9,
  heading: null,
  content: 'text',
  score,
  reranked,
  uploaded: false,
});

describe('isNotFound', () => {
  it('is "not found" with no hits or a reranked best score under the floor', () => {
    expect(isNotFound([])).toBe(true);
    expect(isNotFound([hit(RELEVANCE_FLOOR - 0.01, true)])).toBe(true);
    expect(isNotFound([hit(RELEVANCE_FLOOR + 0.01, true)])).toBe(false);
  });

  it('never floors keyword-only scores, which are tiny RRF values', () => {
    expect(isNotFound([hit(0.016, false)])).toBe(false);
  });
});

describe('toSourceRefs', () => {
  it('numbers sources from 1 in the order the model sees them and keeps the upload flag', () => {
    const refs = toSourceRefs([hit(0.9, true), { ...hit(0.8, true), id: 5, uploaded: true }]);
    expect(refs.map((r) => [r.n, r.uploaded])).toEqual([
      [1, false],
      [2, true],
    ]);
  });
});
