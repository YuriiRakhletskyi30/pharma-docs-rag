import { describe, expect, it } from 'vitest';
import { ownerCookie, readOwner } from '@/lib/owner';

const owner = '0b0e4d47-9a51-4c38-9c5e-2f5f9c1d6a11';
const req = (cookie?: string, url = 'http://localhost/api/chat') =>
  new Request(url, { headers: cookie ? { cookie } : {} });

describe('owner cookie', () => {
  it('reads a valid owner id among other cookies', () => {
    expect(readOwner(req(`theme=dark; dlqa_owner=${owner}; x=1`))).toBe(owner);
  });

  it('ignores a missing or forged value', () => {
    expect(readOwner(req())).toBeNull();
    expect(readOwner(req('dlqa_owner=../../etc'))).toBeNull();
    expect(readOwner(req("dlqa_owner=' or 1=1"))).toBeNull();
  });

  it('is httpOnly, scoped to the API, and Secure only over https', () => {
    expect(ownerCookie(owner, req())).toBe(`dlqa_owner=${owner}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=31536000`);
    expect(ownerCookie(owner, req(undefined, 'https://x.test/api/chat'))).toMatch(/; Secure$/);
  });
});
