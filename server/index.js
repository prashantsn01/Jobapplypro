require('dotenv').config();

const { validateEnv } = require('./middleware/auth');
validateEnv();

const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const session     = require('express-session');
const passport    = require('passport');
const path        = require('path');

const logger         = require('./middleware/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { initQueues } = require('./jobs/queueManager');
const { setupSocketHandlers } = require('./services/socketService');
const prisma         = require('./lib/prisma');

const authRoutes         = require('./routes/auth');
const jobsRoutes         = require('./routes/jobs');
const applicationsRoutes = require('./routes/applications');
const gmailRoutes        = require('./routes/gmail');
const userRoutes         = require('./routes/user');

require('./middleware/passport');

const app    = express();
const server = http.createServer(app);
const isProd = process.env.NODE_ENV === 'production';

// ── Allowed origins ──────────────────────────────────────────────────────────
// CLIENT_URL = your Vercel prod URL  e.g. https://jobapplypro.vercel.app
// EXTRA_ORIGINS = comma-separated additional URLs (custom domain, staging, etc.)
const CLIENT_URL    = process.env.CLIENT_URL;
const EXTRA_ORIGINS = (process.env.EXTRA_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === CLIENT_URL) return true;
  if (EXTRA_ORIGINS.includes(origin)) return true;
  // Allow Vercel preview deployments for the same project slug
  const slug = process.env.VERCEL_PROJECT_SLUG || '';
  if (slug && new RegExp(`^https://${slug}-[\\w-]+\\.vercel\\.app$`).test(origin)) return true;
  // Dev localhost
  if (!isProd && /^http:\/\/localhost(:\\d+)?$/.test(origin)) return true;
  return false;
}

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:      (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, origin);
      logger.warn(`Socket CORS blocked: ${origin}`);
      cb(new Error('Not allowed by CORS'));
    },
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
app.set('io', io);
global.io = io;

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc:     ["'self'", 'fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'", 'wss:', 'ws:', CLIENT_URL, ...(EXTRA_ORIGINS)],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ── CORS — cross-domain for Vercel ↔ Render ──────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, Render health checks)
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, origin);
    logger.warn(`CORS blocked: ${origin}`);
    cb(new Error('Not allowed by CORS'));
  },
  credentials:    true,
  methods:        ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  maxAge:         86400,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/api', apiLimiter);

// ── Sessions — cross-domain cookie config ────────────────────────────────────
// When frontend (Vercel) and backend (Render) are on different domains,
// cookies MUST be: secure=true, sameSite='none'
// For local dev: secure=false, sameSite='lax'
const RedisStore       = require('connect-redis').default;
const { createClient } = require('redis');

let redisClient = null;
let storeReady  = false;

(async () => {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    redisClient.on('error', err => logger.warn('Redis error:', err.message));
    await redisClient.connect();
    storeReady = true;
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.warn('⚠️  Redis unavailable, using memory sessions:', err.message);
  }
})();

// Middleware that builds the session store lazily after Redis connects
app.use((req, res, next) => {
  const store = storeReady && redisClient
    ? new RedisStore({ client: redisClient, prefix: 'jap:sess:' })
    : undefined;

  session({
    store,
    secret:            process.env.SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    proxy:             isProd,  // trust Render's reverse proxy
    cookie: {
      secure:   isProd,                    // HTTPS only in prod
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',   // 'none' needed for cross-domain
      maxAge:   7 * 24 * 60 * 60 * 1000,
    },
  })(req, res, next);
});

app.use(passport.initialize());
app.use(passport.session());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() })
);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth',             authRoutes);
app.use('/api/jobs',         jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/gmail',        gmailRoutes);
app.use('/api/user',         userRoutes);

// Serve built React app in production (only if client/dist exists)
if (isProd) {
  const distPath = path.join(__dirname, '../client/dist');
  try {
    require('fs').accessSync(distPath);
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } catch {
    // client/dist doesn't exist — Vercel serves the frontend separately
    logger.info('No client/dist — frontend served by Vercel');
  }
}

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isProd ? {} : { stack: err.stack }),
  });
});

setupSocketHandlers(io);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('💥 Database connection failed:', err.message);
    process.exit(1);
  }

  await initQueues().catch(err => logger.error('Queue init failed:', err));

  const PORT = parseInt(process.env.PORT, 10) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 JobApplyPro v2 on port ${PORT} (${process.env.NODE_ENV})`);
    logger.info(`🌐 CLIENT_URL: ${CLIENT_URL}`);
    logger.info(`📮 Gmail: ${process.env.GOOGLE_CLIENT_ID ? 'configured ✅' : 'NOT SET ❌'}`);
  });
}

start();

module.exports = { app, server, io };
