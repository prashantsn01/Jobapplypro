// server/middleware/passport.js
const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma         = require('../lib/prisma');
const { encrypt }    = require('../services/cryptoService');
const logger         = require('./logger');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_REDIRECT_URI,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email  = profile.emails?.[0]?.value;
    const name   = profile.displayName;
    const avatar = profile.photos?.[0]?.value;

    if (!email) return done(new Error('No email returned from Google'));

    // Only encrypt and store if we have a token
    const encAccess  = accessToken  ? encrypt(accessToken)  : undefined;
    const encRefresh = refreshToken ? encrypt(refreshToken) : undefined;

    const user = await prisma.user.upsert({
      where:  { googleId: profile.id },
      update: {
        name,
        avatar,
        gmailConnected: true,
        ...(encAccess  !== undefined && { accessToken:  encAccess  }),
        ...(encRefresh !== undefined && { refreshToken: encRefresh }),
      },
      create: {
        googleId:       profile.id,
        email,
        name,
        avatar,
        accessToken:    encAccess  || null,
        refreshToken:   encRefresh || null,
        gmailConnected: !!refreshToken,
        profileComplete: false,
        skills:         [],
        jobPreferences: [],
      },
    });

    logger.info(`OAuth login: ${email} (gmailConnected=${user.gmailConnected})`);
    return done(null, user);
  } catch (err) {
    logger.error('Passport Google strategy error:', err);
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});
