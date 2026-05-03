# 🚀 Deploy JobApplyPro — Render (backend) + Vercel (frontend)

This guide takes you from zero to a live production app in under 30 minutes.

---

## Architecture

```
Browser
  │
  ├── GET https://jobapplypro.vercel.app  → Vercel (React SPA)
  │
  └── API calls → https://jobapplypro-server.onrender.com
                      │
                      ├── PostgreSQL  (Render managed DB)
                      ├── Redis       (Render managed Redis)
                      └── Gmail API   (Google Cloud)
```

---

## Step 1 — Push your code to GitHub

```bash
cd jobapplypro
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/jobapplypro.git
git push -u origin main
```

---

## Step 2 — Google Cloud Setup (required for OAuth + Gmail)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: `JobApplyPro`
3. **Enable APIs** → search and enable:
   - `Gmail API`
   - `Google People API`
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: `JobApplyPro`
   - Authorized redirect URIs — add both:
     ```
     http://localhost:3000/auth/google/callback
     https://jobapplypro-server.onrender.com/auth/google/callback
     ```
   *(Replace `jobapplypro-server` with your actual Render service name)*
5. Copy the **Client ID** and **Client Secret** — you'll need them below.
6. Go to **OAuth consent screen**:
   - User type: **External**
   - App name: `JobApplyPro`
   - Scopes: add `gmail.readonly`, `profile`, `email`
   - Add your Gmail as a test user

---

## Step 3 — Deploy Backend to Render

### Option A — Blueprint (automatic, recommended)

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render will read `render.yaml` and create:
   - **jobapplypro-server** (Node web service)
   - **jobapplypro-db** (PostgreSQL)
   - **jobapplypro-redis** (Redis)
4. After creation, go to **jobapplypro-server** → **Environment** and add these secrets:

| Key | Value |
|-----|-------|
| `SESSION_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | From Step 2 |
| `GOOGLE_CLIENT_SECRET` | From Step 2 |
| `GOOGLE_REDIRECT_URI` | `https://jobapplypro-server.onrender.com/auth/google/callback` |
| `CLIENT_URL` | `https://jobapplypro.vercel.app` *(fill in after Step 4)* |
| `VERCEL_PROJECT_SLUG` | `jobapplypro` *(your Vercel project name)* |

5. Click **Save** → service redeploys automatically.

### Option B — Manual

1. Render → **New Web Service** → connect repo
2. Settings:
   - **Root directory**: `server`
   - **Build command**: `npm install && npx prisma generate`
   - **Start command**: `sh scripts/start.sh`
   - **Health check path**: `/health`
3. Add all env vars from the table above.
4. Create a **PostgreSQL** database and a **Redis** instance from Render dashboard.
5. Copy their **Internal Connection String** values into `DATABASE_URL` and `REDIS_URL`.

### Verify backend is live

```bash
curl https://jobapplypro-server.onrender.com/health
# → {"status":"ok","version":"2.0.0"}
```

---

## Step 4 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://jobapplypro-server.onrender.com` |

5. Click **Deploy**.
6. Once deployed, note your URL: `https://jobapplypro.vercel.app`

---

## Step 5 — Wire everything together

After both are deployed, update **Render** environment vars:

1. Render → **jobapplypro-server** → **Environment**
2. Set `CLIENT_URL` = `https://jobapplypro.vercel.app`
3. The service will redeploy automatically.

Also update **Google Cloud** redirect URIs:

1. Google Cloud Console → Credentials → your OAuth client
2. Add: `https://jobapplypro-server.onrender.com/auth/google/callback`
   *(if not already added in Step 2)*

---

## Step 6 — Verify everything works

```bash
# 1. Health check
curl https://jobapplypro-server.onrender.com/health

# 2. Visit your app
open https://jobapplypro.vercel.app

# 3. Sign in with Google — should redirect back to /dashboard

# 4. Trigger job scrape
curl -X POST https://jobapplypro-server.onrender.com/api/jobs/refresh \
  -H "Content-Type: application/json"
# → {"message":"Scrape started"}

# 5. Check jobs
curl https://jobapplypro-server.onrender.com/api/jobs
```

---

## Custom Domain (optional)

### Vercel custom domain
1. Vercel → Project → **Domains** → Add `www.jobapplypro.com`
2. Add the DNS records shown
3. Update `VITE_API_URL` stays the same (still points to Render)
4. Update Render `CLIENT_URL` = `https://www.jobapplypro.com`

### Render custom domain
1. Render → Service → **Custom Domain** → Add `api.jobapplypro.com`
2. Update `VITE_API_URL` in Vercel = `https://api.jobapplypro.com`
3. Update `GOOGLE_REDIRECT_URI` in Render = `https://api.jobapplypro.com/auth/google/callback`
4. Update Google Cloud redirect URIs to include the new one

---

## Troubleshooting

### "Cookies not working" / Logged out after OAuth

The cross-domain cookie setup requires:
- `secure: true` (HTTPS) ✅ (Render + Vercel both use HTTPS)
- `sameSite: 'none'` ✅ (set automatically when `NODE_ENV=production`)
- `withCredentials: true` in Axios ✅ (set in `client/src/api/client.js`)

If you're still being logged out, check:
1. `NODE_ENV=production` is set in Render environment
2. `CLIENT_URL` exactly matches your Vercel URL (no trailing slash)

### "CORS error" in browser

Check that `CLIENT_URL` in Render matches your Vercel URL exactly.
Check that `VITE_API_URL` in Vercel matches your Render URL exactly (no trailing slash).

### Render service sleeping (free plan)

Render free plan sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds.
To keep it awake, use a free uptime monitor:
- [UptimeRobot](https://uptimerobot.com) — ping `https://jobapplypro-server.onrender.com/health` every 5 minutes.

### "ENCRYPTION_KEY must be 64 hex characters"

Generate a valid key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Paste the output (exactly 64 chars) as your `ENCRYPTION_KEY` in Render.

### Gmail sync says "not connected"

The Gmail `refresh_token` is only returned by Google on **first consent**.
If you signed in before the Gmail scope was added, sign out and sign in again.
Make sure `prompt: 'consent'` is set in `server/middleware/passport.js` (it is).

### Jobs board is empty after first deploy

1. The scrape runs automatically every 30 minutes via the cron job.
2. To trigger immediately, click **Refresh Jobs** in the UI or:
   ```bash
   curl -X POST https://jobapplypro-server.onrender.com/api/jobs/refresh \
     -b "your-session-cookie"
   ```
3. The seed script (`prisma/seed.js`) runs on startup and adds portal shortcut links so the board is never completely empty.

---

## Environment Variables Summary

### Render (server)

| Variable | Where to get it | Example |
|----------|----------------|---------|
| `NODE_ENV` | hardcode | `production` |
| `DATABASE_URL` | Render auto-fills from blueprint | `postgresql://...` |
| `REDIS_URL` | Render auto-fills from blueprint | `redis://...` |
| `SESSION_SECRET` | generate with node crypto | 64-char hex |
| `ENCRYPTION_KEY` | generate with node crypto | 64-char hex |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | `123....apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | your Render URL | `https://jobapplypro-server.onrender.com/auth/google/callback` |
| `CLIENT_URL` | your Vercel URL | `https://jobapplypro.vercel.app` |
| `VERCEL_PROJECT_SLUG` | your Vercel project name | `jobapplypro` |
| `LINKEDIN_COOKIE` | optional | `AQE...` |
| `NAUKRI_COOKIE` | optional | `nauk_ses=...` |

### Vercel (client)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://jobapplypro-server.onrender.com` |
