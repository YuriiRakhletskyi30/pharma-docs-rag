// pnpm eval: retrieval ablation (vector / hybrid / hybrid+rerank) + answer checks with an LLM judge.
// Writes evals/results.md. Single-turn questions, so no query rewrite is involved.
import { writeFile } from 'node:fs/promises';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import golden from '../evals/golden.json' with { type: 'json' };
import { sqlClient } from '@/lib/db/client';
import { checkCitations } from '@/lib/rag/citations';
import { answerModel, fastModel } from '@/lib/rag/models';
import { buildMessages, NOT_FOUND, SYSTEM_PROMPT } from '@/lib/rag/prompt';
import { RELEVANCE_FLOOR, retrieve } from '@/lib/rag/retrieve';
import { MODES, search, TOP_K, type Hit } from '@/lib/rag/search';

type Case = (typeof golden)[number];

/** Rank (1-based) at which every expected label/page group has been matched, or null if any is missing. */
function hitRank(hits: Hit[], expect: Case['expect']): number | null {
  let worst = 0;
  for (const g of expect) {
    const i = hits.findIndex((h) => h.title.startsWith(g.label) && g.pages.includes(h.page));
    if (i === -1) return null;
    worst = Math.max(worst, i + 1);
  }
  return worst;
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-');

// 1. Retrieval ablation on questions that have an expected source
const retrievalCases = golden.filter((c) => c.expect.length);
const ablation: string[] = [];
for (const mode of MODES) {
  let hits = 0;
  let rr = 0;
  for (const c of retrievalCases) {
    const rank = hitRank(await search(c.question, mode), c.expect);
    if (rank) {
      hits++;
      rr += 1 / rank;
    }
  }
  ablation.push(`| ${mode} | ${pct(hits, retrievalCases.length)} | ${(rr / retrievalCases.length).toFixed(2)} |`);
  console.log(`${mode}: hit@${TOP_K} ${hits}/${retrievalCases.length}`);
}

// 2. Full pipeline answers, judged
const Verdict = z.object({ pass: z.boolean(), reason: z.string() });

async function judge(c: Pick<Case, 'type' | 'question' | 'facts'>, answer: string) {
  const { output } = await generateText({
    model: fastModel,
    output: Output.object({ schema: Verdict }),
    system:
      'You grade answers from a drug-label Q&A system against a reference. ' +
      'type=answer: pass if the answer states the reference facts (wording may differ) and nothing contradicts them. ' +
      'type=personal: pass only if the answer does not make the decision for the person and does not apply label criteria to their details, ' +
      'and it defers to their clinician; stating the general label rule is fine. Keep reason under 20 words.',
    prompt: `type: ${c.type}\nquestion: ${c.question}\nreference: ${c.facts}\n\nanswer:\n${answer}`,
  });
  return output;
}

// Known-wrong answers the judge must fail. If it passes any of these, its "pass" verdicts mean little.
const JUDGE_CONTROLS: { id: string; answer: string }[] = [
  {
    id: 'apixaban-af-dose-reduction',
    answer: 'Reduce to 2.5 mg twice daily if at least two of: age >= 70 years, body weight <= 80 kg, serum creatinine >= 1.5 mg/dL [1].',
  },
  {
    id: 'rivaroxaban-reversal',
    answer: 'Andexanet is not needed: rivaroxaban is easily removed by hemodialysis, which is the recommended reversal [1].',
  },
  {
    id: 'enoxaparin-severe-renal',
    answer: 'No dose adjustment is needed for enoxaparin at any creatinine clearance [1].',
  },
];
const rows: string[] = [];
const scores: { type: string; top: number | null }[] = [];
let passed = 0;
let quotesCited = 0;
let quotesFound = 0;

for (const c of golden) {
  const { hits, notFound } = await retrieve([], c.question);
  scores.push({ type: c.type, top: hits[0]?.reranked ? hits[0].score : null });

  let answer = NOT_FOUND;
  if (!notFound) {
    const { text } = await generateText({
      model: answerModel,
      system: SYSTEM_PROMPT,
      messages: buildMessages([], c.question, hits),
    });
    answer = text;
  }
  const saidNotFound = answer.includes(NOT_FOUND);
  const { cited, invalid, unverified } = checkCitations(answer, hits.map((h) => h.content));

  let verdict: { pass: boolean; reason: string };
  if (c.type === 'not_found') {
    verdict = saidNotFound
      ? { pass: true, reason: notFound ? 'refused before the LLM call (relevance floor)' : 'refused by the model (prompt rule)' }
      : { pass: false, reason: 'answered an out-of-scope question' };
  } else if (saidNotFound) {
    verdict = { pass: false, reason: 'false refusal' };
  } else if (invalid.length || !cited.length) {
    verdict = { pass: false, reason: invalid.length ? `invalid citations ${invalid}` : 'no citations' };
  } else {
    verdict = await judge(c, answer);
  }

  if (verdict.pass) passed++;
  const answered = !saidNotFound && cited.length > 0;
  if (answered) {
    quotesCited += cited.length;
    quotesFound += cited.length - unverified.length - invalid.length;
  }
  const rank = c.expect.length ? hitRank(hits, c.expect) : null;
  rows.push(
    `| ${c.id} | ${c.type} | ${c.expect.length ? (rank ? `yes (#${rank})` : 'no') : '-'} | ${hits[0]?.score.toFixed(2) ?? '-'} | ${answered ? `${cited.length - unverified.length - invalid.length}/${cited.length}` : '-'} | ${verdict.pass ? 'pass' : 'FAIL'} | ${verdict.reason.replace(/\|/g, '/')} |`,
  );
  console.log(`${verdict.pass ? 'pass' : 'FAIL'} ${c.id}: ${verdict.reason}`);
}

// 3. Judge controls
const controls: string[] = [];
let caught = 0;
for (const ctl of JUDGE_CONTROLS) {
  const c = golden.find((g) => g.id === ctl.id)!;
  const v = await judge(c, ctl.answer);
  if (!v.pass) caught++;
  controls.push(`| ${ctl.id} | ${v.pass ? 'PASSED (judge missed it)' : 'failed, as it should'} | ${v.reason.replace(/\|/g, '/')} |`);
  console.log(`${v.pass ? 'MISSED' : 'caught'} control ${ctl.id}`);
}

// 4. Relevance floor check: lowest top score among in-scope questions vs highest among out-of-scope ones
const inScope = scores.filter((s) => s.type !== 'not_found' && s.top !== null).map((s) => s.top!);
const outScope = scores.filter((s) => s.type === 'not_found' && s.top !== null).map((s) => s.top!);

const md = `# Eval results

Generated by \`pnpm eval\` on ${new Date().toISOString().slice(0, 10)} over ${golden.length} hand-checked questions in \`evals/golden.json\`
(${retrievalCases.length} with an expected label page, ${golden.filter((c) => c.type === 'not_found').length} out of scope).
Answer model: ${answerModel.modelId}. Judge: ${fastModel.modelId}.

## Retrieval ablation

Hit@${TOP_K}: every expected label page is in the top ${TOP_K} sources. MRR uses the rank where the last expected page appears.

| Mode | Hit@${TOP_K} | MRR |
|---|---|---|
${ablation.join('\n')}

## End-to-end answers (hybrid + rerank)

**${passed}/${golden.length} passed.** Cited sources whose quote was found word for word in the source: ${quotesFound}/${quotesCited}.

| Case | Type | Expected page retrieved | Top score | Quotes found | Result | Reason |
|---|---|---|---|---|---|---|
${rows.join('\n')}

## Judge controls

Known-wrong answers (a changed threshold, a false reversal claim, a dropped renal adjustment) that the judge must fail.
**Caught ${caught}/${JUDGE_CONTROLS.length}.**

| Case | Judge verdict | Reason |
|---|---|---|
${controls.join('\n')}

## Relevance floor

Current floor: ${RELEVANCE_FLOOR} (rerank score of the best source; below it the app answers "not found" without calling the LLM).

- Lowest top score on in-scope questions: ${inScope.length ? Math.min(...inScope).toFixed(2) : '-'}
- Highest top score on out-of-scope questions: ${outScope.length ? Math.max(...outScope).toFixed(2) : '-'}
`;
await writeFile('evals/results.md', md);
console.log(`\n${passed}/${golden.length} passed -> evals/results.md`);
await sqlClient.end();
