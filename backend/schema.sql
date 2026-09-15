-- ScaleLab D1 schema (SQLite). Apply with:
--   wrangler d1 execute scalelab --local --file=./schema.sql
--   wrangler d1 execute scalelab --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Cloud designs. `data` is the topology JSON (nodes/edges/annotations),
-- same shape the frontend already saves to localStorage. 10-30KB typical.
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_designs_user_updated ON designs(user_id, updated_at DESC);

-- Short share links: /d/<id> resolves to the payload without stuffing
-- kilobytes into the URL (replaces the current #d1. hash links for
-- logged-in users; anonymous hash links keep working as-is).
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  payload TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Server-authoritative daily streaks (replaces localStorage daily.ts).
CREATE TABLE IF NOT EXISTS daily_plays (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_played TEXT NOT NULL,
  streak INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
