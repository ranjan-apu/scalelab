import { SESSION_COOKIE, SESSION_COOKIE_LEGACY } from '../config/constants';

export function sessionCookieHeader(
  sessionId: string,
  maxAge: number,
  req: Request,
): string {
  const isHttps = new URL(req.url).protocol === 'https:';

  // Production Pages and the standalone workers.dev API are different
  // sites. SameSite=Lax cookies are not sent on the frontend's cross-site
  // fetch('/api/auth/me'), so production needs SameSite=None; Secure.
  // Local wrangler dev uses HTTP, where Secure/None cookies are rejected;
  // use the legacy non-__Host name and Lax there instead.
  const name = isHttps ? SESSION_COOKIE : SESSION_COOKIE_LEGACY;
  const sameSite = isHttps ? 'None' : 'Lax';
  const secure = isHttps ? '; Secure' : '';
  return `${name}=${sessionId}; HttpOnly; SameSite=${sameSite}; Path=/${secure}; Max-Age=${maxAge}`;
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
