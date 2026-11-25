import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';

export async function GET(_req: Request, ctx: RouteContext<'/api/documents/[id]/file'>) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response('Not found', { status: 404 });

  const [doc] = await db.select({ pdf: documents.pdf }).from(documents).where(eq(documents.id, id));
  if (!doc) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(doc.pdf), {
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'private, max-age=3600',
    },
  });
}
