// server/routes/auth.js
const express  = require('express');
const passport = require('passport');
const router   = express.Router();

const CLIENT_URL = process.env.CLIENT_URL;  // https://jobapplypro.vercel.app

// Kick off Google OAuth — request gmail.readonly + profile
router.get('/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
    accessType: 'offline',
    prompt:     'consent',   // always request refresh_token
  })
);

// OAuth callback — Google redirects here after user grants permission
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${CLIENT_URL}/login?error=oauth_failed`,
    session:         true,
  }),
  (_req, res) => {
    // Redirect user back to the Vercel frontend
    res.redirect(`${CLIENT_URL}/dashboard`);
  }
);

// GET /auth/me — used by Vercel frontend to check if session is valid
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ authenticated: false });
  }
  const { id, name, email, avatar, gmailConnected, profileComplete } = req.user;
  res.json({ authenticated: true, user: { id, name, email, avatar, gmailConnected, profileComplete } });
});

// POST /auth/logout
router.post('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid', {
        secure:   process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      });
      res.json({ success: true });
    });
  });
});

module.exports = router;
