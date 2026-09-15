import { SESSION_COOKIE, SESSION_COOKIE_LEGACY } from '../config/constants';

export function sessionCookieHeader(sessionId: string, maxAge: number): string {
  // __Host- prefix requires Secure + Path=/ + no Domain. Localhost over
  // http can't set Secure, so only add it when the cookie actually lives.
  const secure = maxAge > 0 ? '; Secure' : '';
  return `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Lax; Path=/${secure}; Max-Age=${maxAge}`;
}

export function readSessionId(req: Request): string | null {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE || k === SESSION_COOKIE_LEGACY) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}
