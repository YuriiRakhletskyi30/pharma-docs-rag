/** Source numbers cited as [n] in the answer, in order of first use. */
export function citedNumbers(text: string): number[] {
  return [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))];
}

/**
 * Checks that every [n] points to a source that was actually sent.
 * This proves the reference exists, not that the source supports the claim.
 */
export function checkCitations(text: string, sourceCount: number) {
  const cited = citedNumbers(text);
  return {
    cited,
    invalid: cited.filter((n) => n < 1 || n > sourceCount),
  };
}
