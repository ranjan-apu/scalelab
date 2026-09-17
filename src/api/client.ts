/* Thin fetch client for the Cloudflare Worker API.
 * Same-origin in prod (/api/* route) or VITE_API_URL in dev.
 * Cookies carry the session, so every call uses credentials: 'include'. */

function base(): string {
  return (
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
  );
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
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

export interface ApiDesignSummary {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  /** JSON byte length of the stored topology. */
  size: number;
}

export interface ApiDesignDetail {
  id: string;
  name: string;
  data: unknown;
  created_at: number;
  updated_at: number;
}

export const api = {
  get base(): string {
    return base();
  },
  get configured(): boolean {
    return base().length > 0;
  },
  me: () => req<{ user: ApiUser }>('/api/auth/me'),
  loginUrl: () => `${base()}/api/auth/login`,
  logout: () =>
    req<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' }),
  designsList: () => req<{ designs: ApiDesignSummary[] }>('/api/designs'),
  designCreate: (name: string, data: unknown) =>
    req<{ id: string }>('/api/designs', {
      method: 'POST',
      body: JSON.stringify({ name, data }),
    }),
  designGet: (id: string) =>
    req<ApiDesignDetail>(`/api/designs/${encodeURIComponent(id)}`),
  shareCreate: (payload: unknown) =>
    req<{ id: string }>('/api/share', {
      method: 'POST',
      body: JSON.stringify({ payload }),
    }),
  shareResolve: (id: string) =>
    req<{ payload: unknown }>(`/api/share/${encodeURIComponent(id)}`),
  dailyPlay: () =>
    req<{ day: string; streak: number }>('/api/daily/play', {
      method: 'POST',
      body: '{}',
    }),
};
