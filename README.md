# 💼 JobApplyPro v2

A full-stack personal job application tracker with **real job fetching** from LinkedIn, Naukri, Cutshort, Unstop & Remotive, **Gmail OAuth** auto-detection of replies, and a fully componentised React frontend.

---

## ✨ What's included

| Feature | Detail |
|---|---|
| **Real job scraping** | LinkedIn guest API + cheerio · Naukri JSON API · Cutshort REST API · Unstop public API · Remotive API |
| **Gmail OAuth** | Sign in with Google, read-only Gmail access to detect interview invites, offer letters, and rejections |
| **Application tracker** | Log, filter, update status, delete. Real-time updates via Socket.io |
| **Auto-resume parser** | Upload PDF/DOCX → auto-fill profile (skills, CGPA, college, city, URLs) |
| **Job board** | Filter by platform, role type (frontend/fullstack), location, search |
| **Real-time notifications** | Socket.io pushes Gmail reply alerts and new job counts live |
| **Security** | AES-256-GCM for token storage · Helmet CSP · Zod validation · rate limiters · no ports exposed in Docker |
| **Tests** | Jest unit tests for Gmail classifier, domain matcher, scrapers, pagination guards |
| **Docker** | Single `docker compose up` to run everything (Postgres, Redis, server, nginx+React) |

---

## 🚀 Quick Start (Local Dev)

### 1 — Prerequisites

- Node.js 20+
- PostgreSQL 16+ running locally (`brew install postgresql` or use Docker)
- Redis (optional — app falls back to `node-cron` without it)

### 2 — Clone and install

```bash
git clone https://github.com/you/jobapplypro.git
cd jobapplypro
npm install --prefix server
npm install --prefix client
```

### 3 — Google OAuth setup (required for Gmail)

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create **OAuth 2.0 Client ID** → Web Application
3. Authorised redirect URI: `http://localhost:3000/auth/google/callback`
4. Enable **Gmail API** in [API Library](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
5. Copy your Client ID and Client Secret

### 4 — Environment variables

```bash
cp .env.example server/.env
# Edit server/.env with your values:
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
#   SESSION_SECRET    (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#   ENCRYPTION_KEY    (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#   DATABASE_URL      (e.g. postgresql://postgres:password@localhost:5432/jobapplypro)
#   CLIENT_URL        http://localhost:5173
```

### 5 — Database setup

```bash
cd server
npx prisma migrate dev --name init
npm run db:seed      # seeds portal shortcut links so the job board isn't empty
```

### 6 — Run

```bash
# From repo root:
npm run dev          # starts both server (3000) and client (5173) together
# Or separately:
npm run dev:server
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173) and sign in with Google.

---

## 🐳 Docker (Production)

```bash
cp .env.example .env
# Fill in .env (see above)

docker compose up -d --build
# App available at http://localhost (port 80)
```

Run migrations inside the container:

```bash
docker compose exec server npx prisma migrate deploy
docker compose exec server node prisma/seed.js
```

---

## 🔑 Optional: Scraper Cookies

Without cookies the scrapers use public APIs (fewer results, lower rate limits).  
Adding cookies unlocks full personalised results.

### LinkedIn `li_at` cookie

1. Log in to linkedin.com in Chrome
2. Open DevTools → Application → Cookies → `www.linkedin.com`
3. Copy the value of `li_at`
4. Set `LINKEDIN_COOKIE=<value>` in your `.env`

### Naukri session cookie

1. Log in to naukri.com in Chrome
2. Open DevTools → Network → any request → Request Headers → `Cookie`
3. Copy the entire Cookie header value
4. Set `NAUKRI_COOKIE=<value>` in your `.env`

---

## 📋 API Reference

| Method | Path | Description |
|---|---|---|
| `GET`  | `/auth/google` | Start Google OAuth |
| `GET`  | `/auth/me` | Current session user |
| `POST` | `/auth/logout` | Logout |
| `GET`  | `/api/jobs` | List jobs (with filters) |
| `POST` | `/api/jobs/refresh` | Trigger scrape |
| `GET`  | `/api/jobs/stats` | Job counts by platform |
| `GET`  | `/api/applications` | List user applications |
| `POST` | `/api/applications` | Log new application |
| `PATCH`| `/api/applications/:id` | Update status/notes |
| `DELETE`| `/api/applications/:id` | Delete application |
| `GET`  | `/api/applications/stats` | Response/interview rates |
| `POST` | `/api/gmail/sync` | Trigger Gmail sync |
| `GET`  | `/api/gmail/status` | Last sync info |
| `GET`  | `/api/gmail/replies` | Applications with replies |
| `GET`  | `/api/user/profile` | Get profile |
| `PATCH`| `/api/user/profile` | Save profile |
| `POST` | `/api/user/resume` | Upload & parse resume |

---

## 🧪 Tests

```bash
cd server
npm test
```

Tests cover: Gmail email classification, strict domain matching, pagination NaN guards, job type classifier, and route authentication.

---

## 📁 Project Structure

```
jobapplypro/
├── server/
│   ├── index.js                  # Express app entry point
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   ├── seed.js               # Portal shortcut seeds
│   │   └── migrations/           # SQL migrations
│   ├── routes/                   # auth, jobs, applications, gmail, user
│   ├── services/
│   │   ├── scrapers/             # linkedin, naukri, cutshort, unstop, remotive
│   │   ├── gmailService.js       # Gmail OAuth + strict domain matching
│   │   ├── jobAggregator.js      # Orchestrates all scrapers + DB upsert
│   │   ├── cryptoService.js      # AES-256-GCM for token storage
│   │   ├── resumeParser.js       # PDF/DOCX parser
│   │   └── socketService.js      # Socket.io handlers
│   ├── middleware/               # auth, passport, rateLimiter, logger
│   ├── jobs/queueManager.js      # Bull queues + node-cron fallback
│   └── tests/                   # Jest tests
└── client/
    ├── src/
    │   ├── pages/                # Login, Dashboard, Jobs, Applications, Profile
    │   ├── components/           # Navbar, JobCard
    │   ├── contexts/             # AuthContext
    │   ├── hooks/                # useSocket
    │   ├── api/                  # Axios client
    │   └── styles/               # global.css (full design system)
    └── vite.config.js
```

---

## 🔒 Security Notes

- OAuth tokens are AES-256-GCM encrypted before being stored in Postgres
- Gmail access is **read-only** (`gmail.readonly` scope) — we never read email bodies, only subject + metadata
- Postgres and Redis ports are **not exposed** in docker-compose (internal network only)
- All inputs validated with Zod; file uploads restricted to PDF/DOCX ≤ 5 MB
- Rate limiting: 500 req/15 min (API), 10 syncs/hour (Gmail), 3 scrapes/10 min

---

## 🛠 Troubleshooting

**No jobs appear after refresh**  
→ Check server logs: `docker compose logs server` or `npm run dev:server`  
→ LinkedIn/Naukri may rate-limit the first scrape. Wait 1 min and retry.  
→ Try adding cookies for better results (see above).

**Gmail sync says "not connected"**  
→ You need to sign in via Google OAuth (`/auth/google`) which requests `gmail.readonly` scope.  
→ If you signed in before adding Gmail scope, sign out and sign in again.

**"ENCRYPTION_KEY must be 64 hex characters"**  
→ Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`  
→ Paste the output as your `ENCRYPTION_KEY` value.

**Prisma migration fails**  
→ Make sure `DATABASE_URL` points to a running Postgres instance.  
→ Run: `npx prisma migrate dev --name fix` from the `server/` directory.
