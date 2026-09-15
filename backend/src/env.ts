/* Worker bindings + shared Hono env type. Single source of truth for env. */

import type { SessionUser } from './entities/user';

export type Bindings = {
  DB: D1Database;
  /** KV session cache (user objects keyed by session id). Optional locally. */
  SESSION_CACHE?: KVNamespace;
  FRONTEND_URL: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    /** Attached by auth middleware. Null when anonymous / no session. */
    user: SessionUser | null;
  };
};
