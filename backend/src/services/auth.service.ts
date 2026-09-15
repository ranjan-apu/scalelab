/* Auth service: Google OIDC login + D1 user/session persistence. */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Bindings } from '../env';
import { SESSION_TTL_S } from '../config/constants';
import { newId } from '../utils/ids';
import { nowSec } from '../utils/time';

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  avatar: string;
}

export function buildGoogleLoginUrl(clientId: string, redirectUri: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function exchangeCodeForIdToken(
  env: Bindings,
  code: string,
): Promise<{ ok: true; idToken: string } | { ok: false }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return { ok: false };
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) return { ok: false };
  return { ok: true, idToken: tokens.id_token };
}

export async function verifyGoogleIdToken(
  env: Bindings,
  idToken: string,
): Promise<GoogleProfile | null> {
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_CLIENT_ID,
    });
    const sub = String(payload.sub ?? '');
    const email = String(payload.email ?? '');
    if (!sub || !email) return null;
    return {
      sub,
      email,
      name: String(payload.name ?? ''),
      avatar: String(payload.picture ?? ''),
    };
  } catch {
    return null;
  }
}

/** Upsert the Google user in D1 and return the internal user id (`g_<sub>`). */
export async function upsertUser(env: Bindings, profile: GoogleProfile): Promise<string> {
  const now = nowSec();
  const userId = `g_${profile.sub}`;
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, avatar, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email=excluded.email, name=excluded.name,
       avatar=excluded.avatar, last_login_at=excluded.last_login_at`,
  )
    .bind(userId, profile.email, profile.name, profile.avatar, now, now)
    .run();
  return userId;
}

export async function createSession(env: Bindings, userId: string): Promise<string> {
  const sessionId = newId('sess');
  const now = nowSec();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(sessionId, userId, now + SESSION_TTL_S, now)
    .run();
  return sessionId;
}
