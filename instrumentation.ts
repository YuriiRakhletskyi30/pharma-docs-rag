import type { Instrumentation } from 'next';

// Every server error Next.js catches (route handlers, rendering) goes to the JSON logs and, when
// ERROR_WEBHOOK_URL is set, to a webhook (Slack, Teams, or an incident tool's HTTP intake).
// Request headers are left out on purpose: they carry the owner cookie.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { log } = await import('@/lib/log');
  const report = {
    // Drizzle appends the query parameters to its message, and they can hold a user's question
    message: (err instanceof Error ? err.message : String(err)).split('\nparams:')[0],
    digest: typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined,
    method: request.method,
    path: request.path.split('?')[0], // query strings can hold user input
    route: context.routePath,
    routeType: context.routeType,
  };
  log.error({ ...report, stack: err instanceof Error ? err.stack?.split('\nparams:')[0] : undefined }, 'request error');

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: `Drug Label Q&A error on ${report.method} ${report.route}: ${report.message}`, ...report }),
    signal: AbortSignal.timeout(3000),
  }).catch((e) => log.warn({ err: e }, 'error webhook failed'));
};
