import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';

export async function GET(_req: Request, ctx: RouteContext<'/api/documents/[id]/file'>) {
  const raw = (await ctx.params).id;
  // plain digits that fit Postgres int4; anything else ("1e0", "99999999999") is simply not a document
  if (!/^\d{1,9}$/.test(raw)) return new Response('Not found', { status: 404 });
  const id = Number(raw);

  const [doc] = await db.select({ pdf: documents.pdf }).from(documents).where(eq(documents.id, id));
  if (!doc) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(doc.pdf), {
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
