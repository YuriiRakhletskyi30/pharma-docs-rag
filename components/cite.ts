import type { SourceRef } from '@/lib/types';

/** "Eliquis" from "Eliquis (apixaban)" */
export const drugName = (s: SourceRef) => s.title.replace(/\s*\(.*\)$/, '');

/** "Eliquis · 8.6 Renal Impairment · p. 24" */
export function sourceLabel(s: SourceRef) {
  return [drugName(s), s.heading, `p. ${s.page}`].filter(Boolean).join(' · ');
}
