import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { attachUser, requireAuth } from '../middleware/auth';
import * as Daily from '../controllers/daily.controller';

const r = new Hono<AppEnv>();

r.post('/play', attachUser, requireAuth, Daily.play);

export const dailyRoutes = r;
