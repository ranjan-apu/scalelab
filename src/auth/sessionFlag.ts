/* Tab-local signed-in presence.
 *
 * WHY. Every endpoint behind the Worker's requireAuth answers 401 without a
 * session. Firing those calls while logged out (or after the session died)
 * costs a round trip that can only fail, and litters the console with 401s.
 * Two client-side signals predict the outcome before any fetch:
 *
 *   - the readable `scalelab-auth` presence marker (see backend cookies.ts):
 *     the server sets it beside the HttpOnly session cookie, so its absence
 *     on a production host means no session cookie can exist either; and
 *   - `scalelab.no-session` in sessionStorage: set the moment this tab
 *     learns there is no session (a 401, a logout), cleared on an
 *     authenticated success or an explicit login.
 *
 * This module owns both signals. AuthContext (the boot check) and the API
 * client (every authed call) consult the same predicate, so they can never
 * disagree about whether a call is worth making. Localhost always checks:
 * local dev shares no parent domain for the marker, so without the bypass
 * localhost could never log in.
 */

export const NO_SESSION_KEY = 'scalelab.no-session';
export const AUTH_MARKER = 'scalelab-auth';

function readHostname(): string {
  try {
    return window.location.hostname;
  } catch {
    return 'localhost';
  }
}

function readCookie(): string {
  try {
    return document.cookie;
  } catch {
    // Unreadable environment (no DOM): pretend the marker is there, so the
    // check — not the guess — decides.
    return `${AUTH_MARKER}=1`;
  }
}

function readNoSessionFlag(): boolean {
  try {
    return sessionStorage.getItem(NO_SESSION_KEY) !== null;
  } catch {
    return false;
  }
}

export function isLocalHost(hostname: string = readHostname()): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0'
  );
}

export function hasAuthMarker(cookie: string = readCookie()): boolean {
  return cookie
    .split(';')
    .some((part) => part.trim().startsWith(`${AUTH_MARKER}=`));
}

export interface AuthPresence {
  hostname?: string;
  cookie?: string;
  noSession?: boolean;
}

/**
 * Pure predicate: true when an authenticated call could only 401. Inputs
 * default to the live DOM so production code calls it bare, while tests
 * inject values.
 */
export function shouldSkipAuthCall(input: AuthPresence = {}): boolean {
  const hostname = input.hostname ?? readHostname();
  if (isLocalHost(hostname)) return false;
  if (input.noSession ?? readNoSessionFlag()) return true;
  const cookie = input.cookie ?? readCookie();
  return !hasAuthMarker(cookie);
}

function canBeSignedIn(): boolean {
  return !shouldSkipAuthCall();
}

/**
 * Indirection seam for tests: client code goes through authGuard so tests
 * can force either outcome without faking hostnames or cookies.
 */
export const authGuard = {
  canBeSignedIn,
};

/** Remember "the server said 401" (or we logged out) for the rest of the tab. */
export function noteAuthFailure(): void {
  try {
    sessionStorage.setItem(NO_SESSION_KEY, '1');
  } catch {
    // Private mode: the next call simply checks again.
  }
}

/** An authenticated round trip just proved the session is alive. */
export function noteAuthSuccess(): void {
  try {
    sessionStorage.removeItem(NO_SESSION_KEY);
  } catch {
    // Private mode: harmless.
  }
}
