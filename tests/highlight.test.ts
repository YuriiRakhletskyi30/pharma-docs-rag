import { describe, expect, it } from 'vitest';
import { passageRun } from '@/components/highlight';

const passage = `2.3 Coronary Artery Disease but No Prior Stroke
Administer 60 mg of BRILINTA twice daily.
Initiate treatment with a 180 mg loading dose of BRILINTA.`;

describe('passageRun', () => {
  it('marks the cited block, not the same sentence repeated earlier on the page', () => {
    const items = [
      '2.2 Acute Coronary Syndrome',
      'Initiate treatment with a 180 mg loading dose of BRILINTA.', // repeated wording, wrong section
      'Administer 90 mg twice daily during the first year.',
      '2.3 Coronary Artery Disease but No Prior Stroke',
      'Administer 60 mg of BRILINTA twice daily.',
      '1',
      'Initiate treatment with a 180 mg loading dose of BRILINTA.',
    ];
    expect([...passageRun(items, passage)]).toEqual([3, 4, 5, 6]);
  });

  it('marks nothing when no item matches', () => {
    expect(passageRun(['Unrelated text here', 'More unrelated text'], passage).size).toBe(0);
  });

  it('keeps short items such as doses inside the run', () => {
    const items = ['Administer 60 mg of BRILINTA', ' ', 'twice daily.'];
    expect([...passageRun(items, passage)]).toEqual([0, 2]);
  });
});
