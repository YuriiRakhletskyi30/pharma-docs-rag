// Fixed-window limits kept in this process's memory. Per instance, not shared between replicas:
// with N copies the real ceiling is N times these numbers (a shared store such as Redis is the production step).
// Without a login every client key can be faked (a new IP header, a dropped cookie), so the global limit
// is what actually caps spend; the per-client limit keeps one heavy user from using it all.

type Window = { start: number; count: number };

export function createLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const windows = new Map<string, Window>();
  return {
    /** Counts one request. Returns 0 when allowed, otherwise the seconds until the window resets. */
    hit(key: string): number {
      const t = now();
      if (windows.size > 10_000) for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        windows.set(key, { start: t, count: 1 });
        return 0;
      }
      if (w.count >= limit) return Math.ceil((w.start + windowMs - t) / 1000);
      w.count++;
      return 0;
    },
  };
}

/**
 * Who is asking. The client IP only when a trusted proxy sets X-Forwarded-For (TRUST_PROXY=true);
 * otherwise the owner cookie, otherwise one shared "anonymous" key (stricter, never looser).
 */
export function clientKey(req: Request, owner: string | null, trustProxy: boolean): string {
  const ip = trustProxy ? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() : undefined;
  return ip ? `ip:${ip}` : owner ? `owner:${owner}` : 'anonymous';
}

export function tooMany(retryAfter: number, what: string, headers?: HeadersInit) {
  return Response.json(
    { error: `Too many ${what}. Try again in ${retryAfter < 60 ? `${retryAfter} s` : `${Math.ceil(retryAfter / 60)} min`}.` },
    { status: 429, headers: { ...headers, 'retry-after': String(retryAfter) } },
  );
}
