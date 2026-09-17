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

/* ------------------------------------------------------------------ *
 * CORS: strict allowlist.
 *
 * The old `origin: (o) => o` echo turned this into OPEN CORS: with
 * `credentials: true` and the SameSite=None session cookie, ANY site a
 * logged-in user visited could make API calls as that user AND read the
 * responses. Now only the production frontend origins and local dev get
 * an Access-Control-Allow-Origin header; everything else is blocked by
 * the browser (no header = preflight and response both fail).
 *
 * The Origin header is scheme+host with no trailing slash, so the list
 * below matches what browsers actually send. Localhost is allowed on any
 * port because the Vite/wrangler dev servers hop ports when busy.
 * ------------------------------------------------------------------ */
const ALLOWED_ORIGINS = [
  'https://scalelab.apurba.top',
  'https://scalelab-apu.pages.dev',
];

function allowedOrigin(origin: string): string | null {
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  try {
    const u = new URL(origin);
    if (u.protocol === 'http:' && u.hostname === 'localhost') return origin;
  } catch {
    // Not a parseable origin — never allow it.
  }
  return null;
}

app.use(
  '/api/*',
  cors({
    origin: (origin) => allowedOrigin(origin),
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
