import { describe, expect, it } from 'vitest';
import { rrf } from '@/lib/rag/rrf';

describe('rrf', () => {
  it('ranks ids found by both lists above ids found by one', () => {
    const fused = rrf([
      [1, 2, 3],
      [3, 4, 1],
    ]);
    expect(fused.map((f) => f.id)).toEqual([1, 3, 2, 4]);
  });

  it('uses 1/(k + rank) with 1-based rank', () => {
    expect(rrf([[7]], 60)[0].score).toBeCloseTo(1 / 61);
  });

  it('handles empty lists', () => {
    expect(rrf([[], []])).toEqual([]);
  });
});
