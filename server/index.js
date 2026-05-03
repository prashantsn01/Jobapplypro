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

// ─────────────────────────────────────────────────────────
// 🔥 IMPORTANT: DO NOT depend on NODE_ENV for cookies
// ─────────────────────────────────────────────────────────

const CLIENT_URL    = process.env.CLIENT_URL;
const EXTRA_ORIGINS = (process.env.EXTRA_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Allow origins
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === CLIENT_URL) return true;
  if (EXTRA_ORIGINS.includes(origin)) return true;

  const slug = process.env.VERCEL_PROJECT_SLUG || '';
  if (slug && new RegExp(`^https://${slug}-[\\w-]+\\.vercel\\.app$`).test(origin)) return true;

  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;

  return false;
}

// ── Socket.io ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, origin);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
});

app.set('io', io);

// ── Security ──────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, origin);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use('/api', apiLimiter);

// ── Redis + Session ───────────────────────────────────────
const RedisStore       = require('connect-redis').default;
const { createClient } = require('redis');

let redisClient = null;
let storeReady  = false;

(async () => {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', err => logger.warn('Redis error:', err.message));
    await redisClient.connect();
    storeReady = true;
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.warn('⚠️ Redis unavailable:', err.message);
  }
})();

// 🔥 FIXED SESSION (THIS IS THE MAIN FIX)
app.use((req, res, next) => {
  const store = storeReady && redisClient
    ? new RedisStore({ client: redisClient })
    : undefined;

  session({
    store,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    proxy: true, // 🔥 IMPORTANT

    cookie: {
      secure: true,      // 🔥 REQUIRED for Render
      httpOnly: true,
      sameSite: 'none',  // 🔥 REQUIRED for Vercel ↔ Render
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })(req, res, next);
});

app.use(passport.initialize());
app.use(passport.session());

// ── Routes ────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/user', userRoutes);

// ── Health ────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── Error handler ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error(err);
  res.status(500).json({ error: err.message });
});

// ── Start ─────────────────────────────────────────────────
async function start() {
  await prisma.$connect();
  logger.info('✅ Database connected');

  await initQueues();

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
  });
}

start();
