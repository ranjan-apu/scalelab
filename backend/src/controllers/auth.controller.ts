/* Auth controller: HTTP mapping for Google OIDC. Logic lives in services. */

import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { SESSION_TTL_S } from '../config/constants';
import { sessionCookieHeader } from '../utils/cookies';
import {
  buildGoogleLoginUrl,
  createSession,
  exchangeCodeForIdToken,
  upsertUser,
  verifyGoogleIdToken,
} from '../services/auth.service';
import { deleteSession, putSessionCache } from '../services/session.service';
import { nowSec } from '../utils/time';

type Ctx = Context<AppEnv>;

export function login(c: Ctx) {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = c.env;
  if (!GOOGLE_CLIENT_ID) {
    return c.json(
      { error: 'Google login is not configured (missing GOOGLE_CLIENT_ID).' },
      500,
    );
  }
  return c.redirect(buildGoogleLoginUrl(GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI), 302);
}

export async function callback(c: Ctx) {
  const code = c.req.query('code');
  const err = c.req.query('error');
  const frontend = c.env.FRONTEND_URL;
  if (err) return c.redirect(`${frontend}?login=${encodeURIComponent(err)}`, 302);
  if (!code) return c.json({ error: 'Missing code.' }, 400);

  // 1. Exchange code for tokens (server-to-server; secret never hits browser).
  const exchanged = await exchangeCodeForIdToken(c.env, code);
  if (!exchanged.ok) return c.redirect(`${frontend}?login=exchange_failed`, 302);

  // 2. Verify the OIDC id_token signature + audience.
  const profile = await verifyGoogleIdToken(c.env, exchanged.idToken);
  if (!profile) return c.redirect(`${frontend}?login=invalid_token`, 302);

  // 3. Upsert user + create session in D1, warm the KV cache.
  const userId = await upsertUser(c.env, profile);
  const sessionId = await createSession(c.env, userId);
  await putSessionCache(
    c.env,
    sessionId,
    { id: userId, email: profile.email, name: profile.name, avatar: profile.avatar },
    nowSec() + SESSION_TTL_S,
  );

  // 4. HttpOnly cookie + back to the app.
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${frontend}?login=ok`,
      'Set-Cookie': sessionCookieHeader(sessionId, SESSION_TTL_S),
    },
  });
}

export function me(c: Ctx) {
  const user = c.get('user');
  if (!user) return c.json({ user: null }, 401);
  return c.json({ user });
}

export async function logout(c: Ctx) {
  await deleteSession(c.env, c.req.raw);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader('', 0),
    },
  });
}
