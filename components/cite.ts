import type { SourceRef } from '@/lib/types';

/** "Eliquis" from "Eliquis (apixaban)" */
export const drugName = (s: SourceRef) => s.title.replace(/\s*\(.*\)$/, '');

/** "Eliquis · 8.6 Renal Impairment · p. 24", or without the page when it is shown apart */
export function sourceLabel(s: SourceRef, withPage = true) {
  return [drugName(s), s.heading, withPage && `p. ${s.page}`].filter(Boolean).join(' · ');
}
