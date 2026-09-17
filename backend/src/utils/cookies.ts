import { SESSION_COOKIE, SESSION_COOKIE_LEGACY } from '../config/constants';

/**
 * Readable marker proving "we set a session cookie here". Deliberately NOT
 * HttpOnly: the frontend checks it before calling /me so logged-out visits
 * skip a round trip that could only 401. It carries no identity, only
 * presence, so reading it buys an attacker nothing.
 */
export const AUTH_MARKER = 'scalelab-auth';

/**
 * Parent domain shared by the API and frontend hosts (`apurba.top`), or
 * null when they share none (local dev on localhost). A host-only cookie
 * is invisible to the other host's JS, so without a shared parent there
 * is no marker worth setting and the frontend always checks /me.
 */
export function sharedParentDomain(
  req: Request,
  frontendUrl: string,
): string | null {
  try {
    const apiHost = new URL(req.url).hostname;
    const frontHost = new URL(frontendUrl).hostname;
    if (!apiHost.includes('.') || !frontHost.includes('.')) return null;
    const parent = apiHost.split('.').slice(-2).join('.');
    return frontHost === parent || frontHost.endsWith(`.${parent}`)
      ? parent
      : null;
  } catch {
    return null;
  }
}

export function markerCookieHeader(domain: string, maxAge: number): string {
  return `${AUTH_MARKER}=1; Path=/; Domain=${domain}; Max-Age=${maxAge}; SameSite=None; Secure`;
}

export function clearMarkerCookieHeader(domain: string): string {
  return `${AUTH_MARKER}=; Path=/; Domain=${domain}; Max-Age=0; SameSite=None; Secure`;
}

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
