/* Auth middleware: attach optional user, enforce required user. */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { getCurrentUser } from '../services/session.service';

/** Loads session user (if any) into context. Never rejects — sets null. */
export const attachUser = createMiddleware<AppEnv>(async (c, next) => {
  try {
    c.set('user', await getCurrentUser(c.env, c.req.raw));
  } catch {
    c.set('user', null);
  }
  await next();
});

/** 401 unless attachUser found a session. Use on protected routes. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'Unauthorized.' }, 401);
  await next();
});
