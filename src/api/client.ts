/* Thin fetch client for the Cloudflare Worker API.
 * Same-origin in prod (/api/* route) or VITE_API_URL in dev.
 * Cookies carry the session, so every call uses credentials: 'include'.
 *
 * Calls behind the Worker's requireAuth go through reqAuthed, which checks
 * the tab-local presence flag first (see auth/sessionFlag): when no session
 * can exist the call rejects with 'Not signed in.' instead of firing a
 * round trip that could only 401. */

import {
  authGuard,
  noteAuthFailure,
  noteAuthSuccess,
} from '../auth/sessionFlag';

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
    const err = new Error(
      (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`,
    ) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch wrapper for requireAuth endpoints. Skips the round trip when the
 * tab already knows there is no session, and teaches the tab when the
 * server is the one to say so (401 sets the flag; any success clears it).
 */
async function reqAuthed<T>(path: string, init?: RequestInit): Promise<T> {
  if (!authGuard.canBeSignedIn()) throw new Error('Not signed in.');
  try {
    const out = await req<T>(path, init);
    noteAuthSuccess();
    return out;
  } catch (e) {
    if ((e as { status?: unknown } | null)?.status === 401) {
      noteAuthFailure();
    }
    throw e;
  }
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
  me: () => reqAuthed<{ user: ApiUser }>('/api/auth/me'),
  loginUrl: () => `${base()}/api/auth/login`,
  // Logout is idempotent: with no session there is nothing to clear
  // server-side, so it resolves locally instead of throwing.
  logout: (): Promise<{ ok: true }> => {
    if (!authGuard.canBeSignedIn()) return Promise.resolve({ ok: true });
    return reqAuthed<{ ok: true }>('/api/auth/logout', {
      method: 'POST',
      body: '{}',
    });
  },
  designsList: () =>
    reqAuthed<{ designs: ApiDesignSummary[] }>('/api/designs'),
  designCreate: (name: string, data: unknown) =>
    reqAuthed<{ id: string }>('/api/designs', {
      method: 'POST',
      body: JSON.stringify({ name, data }),
    }),
  designGet: (id: string) =>
    reqAuthed<ApiDesignDetail>(`/api/designs/${encodeURIComponent(id)}`),
  shareCreate: (payload: unknown) =>
    reqAuthed<{ id: string }>('/api/share', {
      method: 'POST',
      body: JSON.stringify({ payload }),
    }),
  // Public read: anyone with the link can open it, signed in or not, so no guard.
  shareResolve: (id: string) =>
    req<{ payload: unknown }>(`/api/share/${encodeURIComponent(id)}`),
  dailyPlay: () =>
    reqAuthed<{ day: string; streak: number }>('/api/daily/play', {
      method: 'POST',
      body: '{}',
    }),
};
