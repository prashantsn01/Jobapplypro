// server/tests/setup.js
process.env.DATABASE_URL    = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/jobapplypro_test';
process.env.SESSION_SECRET  = 'test-session-secret-32chars-at-least';
process.env.GOOGLE_CLIENT_ID     = 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.GOOGLE_REDIRECT_URI  = 'http://localhost:3000/auth/google/callback';
process.env.ENCRYPTION_KEY  = 'a'.repeat(64);   // 64 hex chars
process.env.CLIENT_URL      = 'http://localhost:5173';
process.env.NODE_ENV        = 'test';
process.env.PORT            = '3001';
