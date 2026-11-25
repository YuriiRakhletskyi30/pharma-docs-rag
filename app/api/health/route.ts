import { sqlClient } from '@/lib/db/client';

/** For the container healthcheck and a load balancer: the app is up and can reach Postgres. */
export async function GET() {
  try {
    await sqlClient`select 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
