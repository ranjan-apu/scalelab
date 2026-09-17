import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { attachUser, requireAuth } from '../middleware/auth';
import * as Shares from '../controllers/shares.controller';

const r = new Hono<AppEnv>();

// Split auth: creating a link is an authenticated write, resolving one is
// a public read so anyone with the link can open it, signed in or not.
// (Rate limiting the anonymous read is a planned follow-up.)
r.post('/', attachUser, requireAuth, Shares.create);
r.get('/:id', attachUser, Shares.resolve);

export const sharesRoutes = r;
