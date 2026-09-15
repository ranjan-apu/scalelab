# ScaleLab API (Cloudflare Worker + D1)

100% Cloudflare backend. No Supabase, no VPS.

## Setup (one time)

```bash
cd backend
npm install

# 1. Login + create D1
npx wrangler login
npx wrangler d1 create scalelab
# paste database_id into wrangler.toml

# 2. Apply schema
npm run db:apply:local    # local dev
npm run db:apply:remote   # prod D1

# 3. Google OAuth (Google Cloud Console -> APIs & Services -> Credentials)
#    - Create OAuth client (Web application)
#    - Authorized redirect URI:
#        local:  http://localhost:8787/api/auth/callback
#        prod:   https://scalelab-api.<you>.workers.dev/api/auth/callback
#      (or your custom domain https://api.yourdomain.com/api/auth/callback)

# 4. Secrets
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
# local dev: copy .dev.vars.example -> .dev.vars and fill

# 5. Run
npm run dev        # http://localhost:8787
npm run deploy     # prod
```

## Frontend env

```
VITE_API_URL=http://localhost:8787   # dev
VITE_API_URL=https://scalelab-api.<you>.workers.dev  # prod
```

## Routes

- `GET /api/health`
- `GET /api/auth/login` -> Google
- `GET /api/auth/callback` -> session cookie + redirect to FRONTEND_URL
- `GET /api/auth/me` (cookie) -> `{ user }`
- `POST /api/auth/logout`
- `GET/POST /api/designs`, `GET /api/designs/:id` (auth)
- `POST /api/share` (optional auth), `GET /api/share/:id`
- `POST /api/daily/play` (auth)
