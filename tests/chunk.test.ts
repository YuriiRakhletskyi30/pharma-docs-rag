import { describe, expect, it } from 'vitest';
import { chunkPages } from '@/lib/rag/chunk';
import { skipFrontMatter } from '@/lib/rag/pdf';

const filler = (n: number) => Array.from({ length: n }, (_, i) => `Sentence number ${i} about anticoagulation.`).join('\n');

describe('skipFrontMatter', () => {
  it('blanks pages before the body and keeps page positions', () => {
    const pages = [
      'HIGHLIGHTS OF PRESCRIBING INFORMATION\n...',
      'FULL PRESCRIBING INFORMATION: CONTENTS*\n1 INDICATIONS AND USAGE',
      'contents tail\nFULL PRESCRIBING INFORMATION\nSections omitted...',
      '1 INDICATIONS AND USAGE\nbody',
    ];
    const out = skipFrontMatter(pages);
    expect(out).toHaveLength(4);
    expect(out[0]).toBe('');
    expect(out[1]).toBe('');
    expect(out[2]).not.toContain('contents tail');
    expect(out[3]).toBe(pages[3]);
  });

  it('keeps everything for a non-label PDF', () => {
    expect(skipFrontMatter(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('chunkPages', () => {
  it('splits on headings and carries the heading across pages', () => {
    const pages = [
      `7 DRUG INTERACTIONS\n${filler(10)}\n7.1 Combined P-gp and Strong CYP3A4 Inhibitors\n${filler(3)}`,
      filler(3),
    ];
    const chunks = chunkPages(pages);
    expect(chunks.map((c) => [c.page, c.heading])).toEqual([
      [1, '7 DRUG INTERACTIONS'],
      [1, '7.1 Combined P-gp and Strong CYP3A4 Inhibitors'],
      [2, '7.1 Combined P-gp and Strong CYP3A4 Inhibitors'],
    ]);
  });

  it('does not treat dose, age or NDC lines as headings', () => {
    const noise = ['2.5 mg twice daily', '18 Years of Age for the Treatment of VTE', '60 Tablets', '1 NDC:0003-0893-21'];
    const chunks = chunkPages([`2 DOSAGE AND ADMINISTRATION\n${filler(10)}\n${noise.join('\n')}\n${filler(2)}`]);
    expect(chunks).toHaveLength(1);
  });

  it('treats the boxed warning as a heading', () => {
    expect(chunkPages(['WARNING: SPINAL/EPIDURAL HEMATOMA\nbody'])[0].heading).toBe('WARNING: SPINAL/EPIDURAL HEMATOMA');
  });

  it('caps chunk size with line overlap', () => {
    const chunks = chunkPages([filler(150)]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(1800);
    const lastLine = chunks[0].content.split('\n').at(-1)!;
    expect(chunks[1].content.startsWith(chunks[0].content.split('\n').at(-2)!)).toBe(true);
    expect(chunks[1].content).toContain(lastLine);
  });

  it('skips empty pages', () => {
    expect(chunkPages(['', '  \n '])).toEqual([]);
  });
});
