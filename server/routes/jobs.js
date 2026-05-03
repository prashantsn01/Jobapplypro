// server/routes/jobs.js
const express           = require('express');
const { scrapeLimiter } = require('../middleware/rateLimiter');
const { getJobsFromDB, runFullScrape } = require('../services/jobAggregator');
const prisma            = require('../lib/prisma');
const router            = express.Router();

// GET /api/jobs
router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1,   parseInt(req.query.page,  10) || 1);
    const limit    = Math.min(100, parseInt(req.query.limit, 10) || 30);
    const { platform, role, location, search, experienceLevel } = req.query;

    const result = await getJobsFromDB({ page, limit, platform, role, location, search, experienceLevel });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/refresh  — triggers a background scrape
router.post('/refresh', scrapeLimiter, async (req, res) => {
  try {
    const userProfile = req.isAuthenticated() ? (req.user?.profile || {}) : {};
    // Fire and forget — don't block the response
    runFullScrape(userProfile).catch(e => {});
    res.json({ message: 'Scrape started', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/stats
router.get('/stats', async (req, res) => {
  try {
    const now    = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [total, todayCount, byPlatform] = await Promise.all([
      prisma.job.count({ where: { active: true } }),
      prisma.job.count({ where: { active: true, fetchedAt: { gte: dayAgo } } }),
      prisma.job.groupBy({
        by:      ['platform'],
        where:   { active: true },
        _count:  { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    res.json({
      total,
      fetchedToday: todayCount,
      byPlatform:   byPlatform.map(p => ({ platform: p.platform, count: p._count.id })),
      lastUpdated:  now.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/platforms  — metadata for the UI
router.get('/platforms', (_req, res) => {
  res.json({
    platforms: [
      { id: 'remotive',  name: 'Remotive',  type: 'api',     status: 'live',    color: '#35e8a0', description: '100% remote jobs worldwide' },
      { id: 'linkedin',  name: 'LinkedIn',  type: 'scraper', status: 'live',    color: '#0a7aff', description: 'World\'s largest job network' },
      { id: 'naukri',    name: 'Naukri',    type: 'api',     status: 'live',    color: '#ff7040', description: 'India\'s #1 job portal' },
      { id: 'unstop',    name: 'Unstop',    type: 'api',     status: 'live',    color: '#9b6fff', description: 'Jobs + hackathons for freshers' },
      { id: 'cutshort',  name: 'Cutshort',  type: 'api',     status: 'live',    color: '#00b386', description: 'Startup & tech jobs India' },
      { id: 'indeed',    name: 'Indeed',    type: 'links',   status: 'portal',  color: '#2557a7', description: 'Job search portal' },
    ],
  });
});

module.exports = router;
