/**
 * Reciprocal Rank Fusion: merges ranked id lists using rank positions only,
 * so cosine distances and ts_rank scores never need to be on the same scale.
 */
export function rrf(lists: number[][], k = 60): { id: number; score: number }[] {
  const scores = new Map<number, number>();
  for (const list of lists) {
    list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}
