import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './env';
import { authRoutes } from './routes/auth.routes';
import { designsRoutes } from './routes/designs.routes';
import { sharesRoutes } from './routes/shares.routes';
import { dailyRoutes } from './routes/daily.routes';
import { health } from './controllers/health.controller';

/* ------------------------------------------------------------------ *
 * ScaleLab API — Cloudflare Worker + Hono + D1 (100% Cloudflare).
 *
 * Layered layout:
 *   routes/      -> URL -> controller mapping (+ auth middleware)
 *   controllers/ -> HTTP mapping (status codes, cookies, redirects)
 *   services/    -> business logic + D1 queries
 *   entities/    -> TS types mirroring D1 tables
 *   schemas/     -> request-body validation
 *   utils/       -> ids, time, cookies
 *   middleware/  -> attachUser / requireAuth
 *   config/      -> shared constants
 * ------------------------------------------------------------------ */

const app = new Hono<AppEnv>();

/* CORS: Pages origin + local dev. Cookies need credentials. */
app.use(
  '/api/*',
  cors({
    origin: (origin) => origin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.get('/api/health', health);
app.route('/api/auth', authRoutes);
app.route('/api/designs', designsRoutes);
app.route('/api/share', sharesRoutes);
app.route('/api/daily', dailyRoutes);

export default app;
