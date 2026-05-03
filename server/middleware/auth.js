// server/middleware/auth.js
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated. Please sign in with Google.' });
}

// Validate required env vars at startup — call once from index.js
function validateEnv() {
  const required = [
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'DATABASE_URL'
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`\n[FATAL] Missing required environment variables:\n  ${missing.join('\n  ')}\n`);
    process.exit(1);
  }
  if (process.env.SESSION_SECRET === 'dev-secret-change-in-prod') {
    console.error('[FATAL] SESSION_SECRET is still the default dev value. Set a real secret.\n');
    process.exit(1);
  }
}

module.exports = { requireAuth, validateEnv };
