import type { SourceRef } from '@/lib/types';

/** "Eliquis · 8.6 Renal Impairment · p. 24" */
export function sourceLabel(s: SourceRef) {
  const drug = s.title.replace(/\s*\(.*\)$/, '');
  return [drug, s.heading, `p. ${s.page}`].filter(Boolean).join(' · ');
}
