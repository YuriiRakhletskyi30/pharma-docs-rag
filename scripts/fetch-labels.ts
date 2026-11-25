// Downloads the pinned DailyMed label PDFs listed in data/seed/labels.json.
import { mkdir, writeFile } from 'node:fs/promises';
import labels from '../data/seed/labels.json' with { type: 'json' };

const dir = 'data/seed/labels';
await mkdir(dir, { recursive: true });

for (const { title, setId } of labels) {
  const url = `https://dailymed.nlm.nih.gov/dailymed/downloadpdffile.cfm?setId=${setId}`;
  const res = await fetch(url);
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('pdf')) throw new Error(`${title}: ${res.status} ${type}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(`${dir}/${setId}.pdf`, bytes);
  console.log(`${title}: ${(bytes.length / 1e6).toFixed(1)} MB`);
}
