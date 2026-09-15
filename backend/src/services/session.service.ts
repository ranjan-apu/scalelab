/* Session service: resolve the current user from the session cookie.
 *
 * Read-through KV cache:
 *   1. SESSION_CACHE (KV, edge, ~ms) -> hit returns immediately, no D1 read.
 *   2. Miss -> D1 (sessions JOIN users) -> populate KV with matching TTL.
 * This is what blunts quota-exhaustion: repeated API calls from a logged-in
 * user cost a KV read, not a D1 read.
 */

import type { Bindings } from '../env';
import type { SessionUser, SessionWithUserRow } from '../entities/user';
import { readSessionId } from '../utils/cookies';
import { nowSec } from '../utils/time';

const kvKey = (sid: string) => `sess:${sid}`;

interface CachedSession {
  user: SessionUser;
  expires_at: number;
}

export async function putSessionCache(
  env: Bindings,
  sessionId: string,
  user: SessionUser,
  expiresAt: number,
): Promise<void> {
  if (!env.SESSION_CACHE) return;
  const ttl = expiresAt - nowSec();
  if (ttl <= 0) return;
  try {
    await env.SESSION_CACHE.put(kvKey(sessionId), JSON.stringify({ user, expires_at: expiresAt }), {
      expirationTtl: Math.min(ttl, 60 * 60 * 24 * 30),
    });
  } catch {
    // Cache is best-effort; D1 stays source of truth.
  }
}

export async function getCurrentUser(env: Bindings, req: Request): Promise<SessionUser | null> {
  const sid = readSessionId(req);
  if (!sid) return null;

  // 1. KV fast path.
  if (env.SESSION_CACHE) {
    try {
      const cached = await env.SESSION_CACHE.get<CachedSession>(kvKey(sid), 'json');
      if (cached) {
        if (cached.expires_at < nowSec()) {
          // Stale — evict in background, fall through to D1 for a firm answer.
          env.SESSION_CACHE.delete(kvKey(sid)).catch(() => {});
        } else {
          return cached.user;
        }
      }
    } catch {
      // Fall through to D1 on any KV error.
    }
  }

  // 2. D1 source of truth.
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.avatar, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
  )
    .bind(sid)
    .first<SessionWithUserRow>();
  if (!row || row.expires_at < nowSec()) {
    if (env.SESSION_CACHE) env.SESSION_CACHE.delete(kvKey(sid)).catch(() => {});
    return null;
  }
  const user: SessionUser = { id: row.id, email: row.email, name: row.name, avatar: row.avatar };

  // 3. Populate cache for next time (fire-and-forget safe: awaited but guarded).
  await putSessionCache(env, sid, user, row.expires_at);
  return user;
}

export async function deleteSession(env: Bindings, req: Request): Promise<void> {
  const sid = readSessionId(req);
  if (!sid) return;
  await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run();
  if (env.SESSION_CACHE) {
    try {
      await env.SESSION_CACHE.delete(kvKey(sid));
    } catch {
      // Best-effort.
    }
  }
}
