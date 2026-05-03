// server/routes/gmail.js
const express          = require('express');
const { requireAuth }  = require('../middleware/auth');
const { gmailLimiter } = require('../middleware/rateLimiter');
const { syncGmailForUser } = require('../services/gmailService');
const prisma           = require('../lib/prisma');
const router           = express.Router();

router.use(requireAuth);

// POST /api/gmail/sync — trigger a manual sync
router.post('/sync', gmailLimiter, async (req, res) => {
  try {
    if (!req.user.gmailConnected) {
      return res.status(400).json({
        error: 'Gmail not connected.',
        hint:  'Sign in with Google and grant Gmail read access.',
      });
    }
    const result = await syncGmailForUser(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gmail/status — last sync info
router.get('/status', async (req, res) => {
  try {
    const sync = await prisma.emailSync.findFirst({ where: { userId: req.user.id } });
    res.json({
      connected:    req.user.gmailConnected,
      lastSyncedAt: sync?.lastSyncedAt  || null,
      totalFetched: sync?.totalFetched  || 0,
      totalMatched: sync?.totalMatched  || 0,
      status:       sync?.status        || 'never',
      errorMsg:     sync?.errorMsg      || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gmail/replies — applications that got an email reply
router.get('/replies', async (req, res) => {
  try {
    const replies = await prisma.application.findMany({
      where:   { userId: req.user.id, replyDetected: true },
      select: {
        id: true, company: true, role: true, platform: true,
        status: true, replyType: true, replySnippet: true,
        replyDetectedAt: true, appliedAt: true,
      },
      orderBy: { replyDetectedAt: 'desc' },
    });
    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gmail/notifications
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gmail/notifications/read — mark all as read
router.post('/notifications/read', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data:  { read: true },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
