import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { attachUser, requireAuth } from '../middleware/auth';
import * as Auth from '../controllers/auth.controller';

const r = new Hono<AppEnv>();

r.get('/login', Auth.login);
r.get('/callback', Auth.callback);
r.get('/me', attachUser, Auth.me);
r.post('/logout', Auth.logout);

export const authRoutes = r;
