import { asc, count, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { chunks, documents } from '@/lib/db/schema';
import { hasVoyage } from '@/lib/env';
import { log } from '@/lib/log';
import { preparePdf, saveDocument } from '@/lib/rag/ingest';

const MAX_BYTES = 20 * 1024 * 1024;

export async function GET() {
  const rows = await db
    .select({ id: documents.id, title: documents.title, pages: documents.pages, chunks: count(chunks.id) })
    .from(documents)
    .leftJoin(chunks, eq(chunks.documentId, documents.id))
    .groupBy(documents.id)
    .orderBy(asc(documents.title));
  return Response.json({ documents: rows, semanticSearch: hasVoyage });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Attach a PDF file.' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'PDF is larger than 20 MB.' }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString() !== '%PDF-') {
    return Response.json({ error: 'That file is not a PDF.' }, { status: 415 });
  }

  const title = file.name.replace(/\.pdf$/i, '').slice(0, 120) || 'Untitled';
  const filename = `upload-${crypto.randomUUID()}.pdf`;
  try {
    const { pages, chunks: prepared } = await preparePdf(title, new Uint8Array(bytes));
    if (!prepared.length) {
      return Response.json({ error: 'No text found in this PDF (scanned PDFs are not supported).' }, { status: 422 });
    }
    const doc = await saveDocument({ title, filename, pdf: bytes, pages, chunks: prepared });
    log.info({ documentId: doc.id, title, pages, chunks: doc.chunks }, 'document uploaded');
    return Response.json({ id: doc.id, title, pages, chunks: doc.chunks }, { status: 201 });
  } catch (err) {
    log.error({ err, title }, 'upload failed');
    return Response.json({ error: 'Could not read this PDF.' }, { status: 500 });
  }
}
