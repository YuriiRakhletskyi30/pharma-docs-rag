import { describe, expect, it } from 'vitest';
import { checkCitations, citedNumbers } from '@/lib/rag/citations';
import { buildMessages, formatSources } from '@/lib/rag/prompt';
import type { Hit } from '@/lib/rag/search';

describe('citations', () => {
  it('collects unique cited numbers in order', () => {
    expect(citedNumbers('Dose is 5 mg [2]. Avoid with X [1][2].')).toEqual([2, 1]);
  });

  it('flags numbers outside the sent sources', () => {
    expect(checkCitations('a [1] b [7] c [0]', 6).invalid).toEqual([7, 0]);
    expect(checkCitations('no citations', 6)).toEqual({ cited: [], invalid: [] });
  });
});

describe('prompt', () => {
  const hit: Hit = {
    id: 1,
    documentId: 3,
    title: 'Eliquis (apixaban)',
    page: 24,
    heading: '8.6 Renal Impairment',
    content: 'No dose adjustment is recommended.',
    score: 0.9,
    reranked: true,
  };

  it('numbers sources from 1 with label, page and section', () => {
    const s = formatSources([hit, { ...hit, heading: null, page: 2 }]);
    expect(s).toContain('<source id="1" label="Eliquis (apixaban)" page="24" section="8.6 Renal Impairment">');
    expect(s).toContain('<source id="2" label="Eliquis (apixaban)" page="2">');
  });

  it('keeps history and puts sources only in the last turn', () => {
    const msgs = buildMessages([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }], 'dose?', [hit]);
    expect(msgs).toHaveLength(3);
    expect(msgs[0].content).toBe('hi');
    expect(msgs[2].content).toContain('<sources>');
    expect(msgs[2].content).toMatch(/Question: dose\?$/);
  });

  it('strips old citation marks from history', () => {
    const msgs = buildMessages([{ role: 'assistant', content: 'Use 5 mg [3][1].' }], 'q', [hit]);
    expect(msgs[0].content).toBe('Use 5 mg .');
  });
});
