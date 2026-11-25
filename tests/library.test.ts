import { describe, expect, it } from 'vitest';
import { isLibraryQuestion, libraryAnswer } from '@/lib/rag/library';

describe('isLibraryQuestion', () => {
  it.each([
    'which documents we have?',
    'which drug are listed?',
    'What labels do you have?',
    'Which drugs are available?',
    'What drugs can I ask about?',
    'list the labels',
    'How many labels are loaded?',
    'what medications do you cover',
    'Which drugs do you have in the library?',
    'show me all the labels you have',
  ])('library: %s', (q) => expect(isLibraryQuestion(q)).toBe(true));

  it.each([
    'Which drugs are listed as CYP2C9 inhibitors?',
    'Which drugs interact with warfarin?',
    'What is the apixaban dose for patients on dialysis?',
    'Which drugs are listed in the warfarin label for bleeding risk?',
    'Do you have the dose of metformin?',
    'Can Pradaxa capsules be opened?',
    'Which drugs do you have for patients on dialysis?',
    'What drugs are there for stroke prevention in atrial fibrillation?',
    'Which labels are available in a 2.5 mg tablet strength?',
  ])('content: %s', (q) => expect(isLibraryQuestion(q)).toBe(false));
});

describe('libraryAnswer', () => {
  it('counts the labels and marks uploads', () => {
    const text = libraryAnswer([
      { title: 'Eliquis (apixaban)', uploaded: false },
      { title: 'my-notes', uploaded: true },
    ]);
    expect(text).toMatch(/^2 prescribing labels are loaded:/);
    expect(text).toContain('- my-notes (uploaded file, not a checked FDA label)');
  });
});
