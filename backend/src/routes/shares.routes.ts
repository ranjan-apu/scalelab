import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { attachUser, requireAuth } from '../middleware/auth';
import * as Shares from '../controllers/shares.controller';

const r = new Hono<AppEnv>();

// Locked down: only authenticated users can create AND resolve shares.
// This is the `@Authorized()` equivalent — attachUser resolves the session
// (KV-cached), requireAuth rejects anonymous callers with 401.
// Trade-off: share links are now private (login required to view).
// If you want public links later, split: POST stays protected, GET goes public
// + rate-limited via dashboard rule.
r.use('*', attachUser, requireAuth);
r.post('/', Shares.create);
r.get('/:id', Shares.resolve);

export const sharesRoutes = r;
