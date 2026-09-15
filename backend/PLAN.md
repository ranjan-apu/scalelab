# ScaleLab Backend Plan (100% Cloudflare)

Stack: Cloudflare Pages (UI) → Worker `scalelab-api` (Hono) → D1 (source of truth) + KV `SESSION_CACHE` (session read-through cache) → R2 later (files). No Supabase, no VPS for v1. AI Service on VPS comes last, behind the Worker.

Auth: Google OIDC only. Single "Sign in with Google" button — first login = signup via `upsertUser()` (`INSERT … ON CONFLICT DO UPDATE`). No separate signup form, no passwords.

## Where we are (done)

- [x] `backend/` layered layout: `routes/ → controllers/ → schemas/ → services/ → entities/`, `middleware/auth.ts` (`attachUser` / `requireAuth`), `utils/`, `config/`
- [x] Google OIDC: `GET /api/auth/login` → `GET /api/auth/callback` (code exchange server-side, JWKS verify via `jose`, `upsertUser` + `createSession`, `__Host-` HttpOnly cookie) → `GET /api/auth/me` → `POST /api/auth/logout`
- [x] Sessions: D1 `sessions` = truth, KV `SESSION_CACHE` (`sess:<id>` → `{user, expires_at}`) = read-through cache. Login warms, logout evicts, expiry re-checked on read
- [x] D1 schema: `users, sessions, designs, shares, daily_plays`
- [x] Frontend: `src/api/client.ts`, `src/auth/AuthContext.tsx`, `src/auth/LoginButton.tsx` (top bar, disabled offline when `VITE_API_URL` unset)
- [x] Shares service scaffold: `shortId(8)` (62⁸), `createShare / resolveShare / bumpShareViews`, 512KB cap
- [x] Typecheck green (frontend + backend)

## Decisions (locked)

1. One repo, two deployables: `src/**` → Pages, `backend/**` → Worker. No second repo.
2. CORS is echo today (`origin: o => o`) — must become `ALLOWED_ORIGINS` allowlist before public (keep localhost).
3. `POST /api/share` stays auth-required; `GET /api/share/:id` goes public + rate-limited (currently both locked — the split is Phase 2).
4. Tiered limits: authed key=`user.id` generous (100/min), anon key=`cf-connecting-ip` strict (10/min).
5. Short links (`/d/<8>`) replace giant `#d1.` URLs for logged-in users; hash links stay as offline fallback.
6. Anon share view shows "X shared you this design" modal: [Sign in] / [Continue viewing]. `new=1` on first login drives the welcome variant.
7. Worker never runs LLM inference — it auth-checks + proxies/streams to the VPS AI Service (HMAC-signed `X-User-Id`).

## Phase 1 — Go-live hardening (next, ~1 session)

- [ ] `ALLOWED_ORIGINS` env + strict CORS (`FRONTEND_URL` + Pages URL + localhost), `wrangler.toml` + `index.ts`
- [ ] Provision: `wrangler d1 create scalelab` (+ id), `db:apply:remote`, `wrangler kv namespace create SESSION_CACHE` (+ id), secrets (`GOOGLE_CLIENT_ID/SECRET`), Pages env `VITE_API_URL`
- [ ] Dashboard rate-limit rules (no code): `POST /api/share` 10/min/IP, `GET /api/share/*` 30/min/IP, `/api/auth/*` 10/min/IP
- [ ] Deploy wiring: Pages auto (root `/`, build `npm run build`, out `dist`) + Worker Git integration (root `backend/`) — or `.github/workflows/api.yml` with `paths: ['backend/**']`
- [ ] Accept: prod login round-trip works, `GET /api/health` 200, wrong-origin fetch blocked, 429s fire on rule test

## Phase 2 — Short links + gated viewing

- [ ] Split `shares.routes.ts`: `POST /` = `attachUser+requireAuth`, `GET /:id` = `attachUser` only
- [ ] Rate-limit middleware (`middleware/rateLimit.ts`): KV fixed-window first (native `ratelimits` binding later); `{ anon: 10/min, authed: 100/min }`, 429 + `Retry-After`
- [ ] Callback: `newUser` detection → redirect `?login=ok&new=1`
- [ ] Frontend: `/d/:id` boot path (`GET /api/share/:id` → `setTopology`), share modal (Sign in / Continue viewing, `sessionStorage` dismiss), Share button prefers `POST /api/share` when `api.configured`, else `#d1.` hash
- [ ] Accept: anon can view `/d/x` within limits, sees modal, can continue read-only; authed can fork/save; spam IP gets 429

## Phase 3 — Cloud designs

- [ ] Wire Save/List/Load to `GET/POST /api/designs` (+ `GET /:id`); localStorage stays as offline fallback + 20-cap shelf
- [ ] Conflict rule: last-write-wins, `updated_at` ordering; name cap 60 shared (`MAX_DESIGN_NAME`)
- [ ] Accept: cross-device save/load works, logged-out works exactly as today

## Phase 4 — Server streaks (+ gallery later)

- [ ] `POST /api/daily/play` drives streaks (UTC day key, upsert); frontend migrates from `daily.ts` localStorage when logged in
- [ ] Gallery/leaderboard: only after abuse story is proven (auth + limits + Turnstile if needed)

## Phase 5 — AI Service on VPS (exploratory, last)

- [ ] Worker `POST /api/ai/*` = `attachUser+requireAuth` + tiered limit → proxy to VPS with `X-User-Id/X-Timestamp/X-Signature` (HMAC `AI_SERVICE_SECRET`, 60s replay window), stream SSE back unbuffered
- [ ] VPS verifies HMAC only — no Google calls, no KV reads. Own Redis/node-cache for quota if needed
- [ ] R2 via S3-compat keys for file IO (VPS direct); session/auth reads stay Worker-only
- [ ] Never expose VPS directly: UI → Worker → VPS (cookies don't cross-origin, auth stays single-place)

## Cross-cutting backlog

- Security: revoke/expiry on shares, `DELETE /api/account` (cascade deletes), Turnstile on anon endpoints if spam
- Observability: Workers + D1 analytics alerts (req > 50k/day), error-shape consistency `{ error }`
- Tests: route-level (auth split, 401/429 matrix), service-level (streak edges, share caps)

## How to add a feature (repeat)

1. Table in `schema.sql` + type in `entities/`
2. Validator in `schemas/` 3. SQL in `services/` 4. HTTP in `controllers/`
3. URL + middleware in `routes/` + mount in `index.ts`
