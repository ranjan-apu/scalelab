/* Thin fetch client for the Cloudflare Worker API.
 * Same-origin in prod (/api/* route) or VITE_API_URL in dev.
 * Cookies carry the session, so every call uses credentials: 'include'. */

const BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export const api = {
  base: BASE,
  configured: BASE.length > 0,
  me: () => req<{ user: ApiUser }>('/api/auth/me'),
  loginUrl: () => `${BASE}/api/auth/login`,
  logout: () =>
    req<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' }),
};
