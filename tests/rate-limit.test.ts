import { describe, expect, it } from 'vitest';
import { clientKey, createLimiter } from '@/lib/rate-limit';

describe('createLimiter', () => {
  it('allows the limit per window, then says how long to wait, then resets', () => {
    let t = 0;
    const limiter = createLimiter(2, 60_000, () => t);
    expect(limiter.hit('a')).toBe(0);
    expect(limiter.hit('a')).toBe(0);
    t = 15_000;
    expect(limiter.hit('a')).toBe(45);
    expect(limiter.hit('b')).toBe(0); // other clients are separate
    t = 60_000;
    expect(limiter.hit('a')).toBe(0);
  });
});

describe('clientKey', () => {
  const req = new Request('http://x', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } });
  it('uses the forwarded IP only behind a trusted proxy', () => {
    expect(clientKey(req, null, true)).toBe('ip:203.0.113.7');
    expect(clientKey(req, 'o1', false)).toBe('owner:o1');
    expect(clientKey(req, null, false)).toBe('anonymous');
  });
});
