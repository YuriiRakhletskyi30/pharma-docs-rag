// Who owns a chat, without accounts: a random id in an httpOnly cookie, set by the server on the first question.
// Page scripts cannot read it, and a chat id copied from someone's browser is useless without it.

export const OWNER_COOKIE = 'dlqa_owner';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const YEAR = 60 * 60 * 24 * 365;

/** The owner id from the request's cookie, or null when missing or malformed. */
export function readOwner(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  const value = cookie
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === OWNER_COOKIE)?.[1];
  return value && UUID.test(value) ? value : null;
}

export function ownerCookie(owner: string, req: Request): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${OWNER_COOKIE}=${owner}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${YEAR}${secure}`;
}
