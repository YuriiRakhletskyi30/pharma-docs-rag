import { asc, count, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { chunks, documents } from '@/lib/db/schema';
import { allowUploads, env, hasVoyage } from '@/lib/env';
import { readOwner } from '@/lib/owner';
import { clientKey, createLimiter, tooMany } from '@/lib/rate-limit';
import { log } from '@/lib/log';
import { MAX_UPLOAD_MB, MAX_UPLOAD_PAGES, UPLOAD_PREFIX } from '@/lib/constants';
import { PageLimitError, preparePdf, saveDocument } from '@/lib/rag/ingest';

const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const TOO_BIG = `PDF is larger than ${MAX_UPLOAD_MB} MB.`;
const uploadsPerClient = createLimiter(env.UPLOADS_PER_HOUR_PER_CLIENT, 60 * 60_000);

export async function GET() {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      pages: documents.pages,
      chunks: count(chunks.id),
      uploaded: sql<boolean>`${documents.filename} like ${UPLOAD_PREFIX + '%'}`,
    })
    .from(documents)
    .leftJoin(chunks, eq(chunks.documentId, documents.id))
    .groupBy(documents.id)
    .orderBy(asc(documents.title));
  return Response.json({ documents: rows, semanticSearch: hasVoyage, uploads: allowUploads });
}

export async function POST(req: Request) {
  if (!allowUploads) return Response.json({ error: 'Uploads are turned off on this server.' }, { status: 403 });
  const wait = uploadsPerClient.hit(clientKey(req, readOwner(req), env.TRUST_PROXY));
  if (wait) return tooMany(wait, 'uploads');
  // reject big bodies before formData() reads them into memory (multipart adds a little over the file size)
  const declared = Number(req.headers.get('content-length'));
  if (!declared) return Response.json({ error: 'Content-Length is required.' }, { status: 411 });
  if (declared > MAX_BYTES + 64 * 1024) return Response.json({ error: TOO_BIG }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Attach a PDF file.' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: TOO_BIG }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString() !== '%PDF-') {
    return Response.json({ error: 'That file is not a PDF.' }, { status: 415 });
  }

  const title = file.name.replace(/\.pdf$/i, '').slice(0, 120) || 'Untitled';
  const filename = `${UPLOAD_PREFIX}${crypto.randomUUID()}.pdf`;
  try {
    const { pages, chunks: prepared } = await preparePdf(title, new Uint8Array(bytes), { maxPages: MAX_UPLOAD_PAGES });
    if (!prepared.length) {
      return Response.json({ error: 'No text found in this PDF (scanned PDFs are not supported).' }, { status: 422 });
    }
    const doc = await saveDocument({ title, filename, pdf: bytes, pages, chunks: prepared });
    log.info({ documentId: doc.id, title, pages, chunks: doc.chunks }, 'document uploaded');
    return Response.json({ id: doc.id, title, pages, chunks: doc.chunks }, { status: 201 });
  } catch (err) {
    if (err instanceof PageLimitError) {
      return Response.json({ error: `PDF has more than ${MAX_UPLOAD_PAGES} pages.` }, { status: 413 });
    }
    log.error({ err, title }, 'upload failed');
    return Response.json({ error: 'Could not read this PDF.' }, { status: 500 });
  }
}
