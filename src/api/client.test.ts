import { beforeEach, expect, test, vi } from 'vitest';
import { api } from './client';
import { NO_SESSION_KEY, authGuard } from '../auth/sessionFlag';

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

test('unconfigured when VITE_API_URL is unset', () => {
  expect(api.configured).toBe(false);
  expect(api.base).toBe('');
});

test('me() calls /api/auth/me with cookies and parses the user', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.com/');
  const user = { id: 'g_1', email: 'a@b.c', name: 'A', avatar: '' };
  stubFetch({ user });
  await expect(api.me()).resolves.toEqual({ user });
  const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  // Trailing slash on the env var is trimmed, not doubled.
  expect(url).toBe('https://api.example.com/api/auth/me');
  expect(init.credentials).toBe('include');
});

test('server error bodies surface their message', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.com');
  stubFetch({ error: 'Unauthorized.' }, 401);
  await expect(api.me()).rejects.toThrow('Unauthorized.');
});

test('designCreate posts name and data', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.com');
  stubFetch({ id: 'd_1' });
  await expect(api.designCreate('My design', { nodes: [] })).resolves.toEqual({
    id: 'd_1',
  });
  const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://api.example.com/api/designs');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual({
    name: 'My design',
    data: { nodes: [] },
  });
});

test('designsList, designGet, shareCreate, shareResolve, dailyPlay hit their routes', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.com');
  const seen: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      const path = new URL(url as string).pathname;
      seen.push(path);
      const bodies: Record<string, unknown> = {
        '/api/share': { id: 'aB3xK9pQ' },
        '/api/share/aB3xK9pQ': { payload: { nodes: [] } },
        '/api/designs': { designs: [] },
        '/api/designs/d_1': {
          id: 'd_1',
          name: 'N',
          data: {},
          created_at: 1,
          updated_at: 2,
        },
        '/api/daily/play': { day: '2026-09-17', streak: 3 },
      };
      return new Response(JSON.stringify(bodies[path]));
    }),
  );
  await api.shareCreate({ nodes: [] });
  await api.shareResolve('aB3xK9pQ');
  await api.designsList();
  await api.designGet('d_1');
  await expect(api.dailyPlay()).resolves.toEqual({
    day: '2026-09-17',
    streak: 3,
  });
  expect(seen).toEqual([
    '/api/share',
    '/api/share/aB3xK9pQ',
    '/api/designs',
    '/api/designs/d_1',
    '/api/daily/play',
  ]);
});

test('authed calls fail fast without a fetch when no session can exist', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.com');
  vi.spyOn(authGuard, 'canBeSignedIn').mockReturnValue(false);
  const fetchMock = vi.fn(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  await expect(api.me()).rejects.toThrow('Not signed in.');
  await expect(api.designsList()).rejects.toThrow('Not signed in.');
  await expect(api.designCreate('N', {})).rejects.toThrow('Not signed in.');
  await expect(api.designGet('d_1')).rejects.toThrow('Not signed in.');
  await expect(api.shareCreate({})).rejects.toThrow('Not signed in.');
  await expect(api.dailyPlay()).rejects.toThrow('Not signed in.');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('logout resolves locally when no session can exist', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.com');
  vi.spyOn(authGuard, 'canBeSignedIn').mockReturnValue(false);
  const fetchMock = vi.fn(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  await expect(api.logout()).resolves.toEqual({ ok: true });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('the public share read never goes through the guard', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.com');
  vi.spyOn(authGuard, 'canBeSignedIn').mockReturnValue(false);
  stubFetch({ payload: { nodes: [] } });
  await expect(api.shareResolve('aB3xK9pQ')).resolves.toEqual({
    payload: { nodes: [] },
  });
});

test('a 401 remembers the dead session; a success clears it', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.com');
  stubFetch({ error: 'Unauthorized.' }, 401);
  await expect(api.designsList()).rejects.toThrow('Unauthorized.');
  expect(sessionStorage.getItem(NO_SESSION_KEY)).toBe('1');
  stubFetch({ designs: [] });
  await expect(api.designsList()).resolves.toEqual({ designs: [] });
  expect(sessionStorage.getItem(NO_SESSION_KEY)).toBeNull();
});
