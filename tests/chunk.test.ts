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

  it('gives a short section that runs into the next heading the heading it started under', () => {
    const chunks = chunkPages([`7 DRUG INTERACTIONS\nShort intro.\n7.1 Strong Inhibitors\n${filler(10)}`]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe('7 DRUG INTERACTIONS');
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

  it('keeps the cap on pages with very long lines or no line breaks', () => {
    const long = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
    const pages = [Array.from({ length: 4 }, () => long(250)).join('\n'), long(1500)];
    const chunks = chunkPages(pages);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(1800);
    // nothing lost: every word of the second page is in some chunk on page 2
    const page2 = chunks.filter((c) => c.page === 2).map((c) => c.content).join(' ');
    expect(page2).toContain('word0 ');
    expect(page2).toContain('word1499');
  });

  it('skips empty pages', () => {
    expect(chunkPages(['', '  \n '])).toEqual([]);
  });
});
