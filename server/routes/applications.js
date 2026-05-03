// server/routes/applications.js
const express         = require('express');
const { z }           = require('zod');
const { requireAuth } = require('../middleware/auth');
const prisma          = require('../lib/prisma');
const router          = express.Router();

router.use(requireAuth);

const CreateSchema = z.object({
  company:   z.string().min(1).max(200).trim(),
  role:      z.string().min(1).max(200).trim(),
  platform:  z.enum(['linkedin','naukri','unstop','cutshort','indeed','manual','other']).default('other'),
  applyUrl:  z.string().url().optional().or(z.literal('')).nullable(),
  salary:    z.string().max(100).optional().nullable(),
  location:  z.string().max(200).optional().nullable(),
  notes:     z.string().max(5000).optional().nullable(),
});

const UpdateSchema = z.object({
  status: z.enum(['applied','interview','offer','rejected','ghosted']).optional(),
  notes:  z.string().max(5000).optional().nullable(),
});

// Helper: parse and clamp pagination params safely
function parsePagination(query) {
  const page  = Math.max(1,   parseInt(query.page,  10) || 1);
  const limit = Math.min(100, parseInt(query.limit, 10) || 50);
  return { page, limit };
}

// GET /api/applications
router.get('/', async (req, res) => {
  try {
    const { status, platform } = req.query;
    const { page, limit }      = parsePagination(req.query);
    const where = { userId: req.user.id };
    if (status && status !== 'all')     where.status   = status;
    if (platform && platform !== 'all') where.platform = platform;

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.application.count({ where }),
    ]);

    res.json({ applications, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, replies, interviews, offers, ghosted] = await Promise.all([
      prisma.application.count({ where: { userId } }),
      prisma.application.count({ where: { userId, appliedAt: { gte: today } } }),
      prisma.application.count({ where: { userId, replyDetected: true } }),
      prisma.application.count({ where: { userId, status: 'interview' } }),
      prisma.application.count({ where: { userId, status: 'offer' } }),
      prisma.application.count({ where: { userId, status: 'ghosted' } }),
    ]);

    const responseRate  = total > 0 ? Math.round((replies    / total) * 100) : 0;
    const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0;

    res.json({ total, todayCount, replies, interviews, offers, ghosted, responseRate, interviewRate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/applications
router.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { company, role, platform, applyUrl, salary, location, notes } = parsed.data;
    const application = await prisma.application.create({
      data: {
        userId: req.user.id,
        company, role, platform,
        applyUrl:  applyUrl  || null,
        salary:    salary    || null,
        location:  location  || null,
        notes:     notes     || null,
        status:    'applied',
      },
    });

    const io = req.app.get('io');
    if (io) io.to(`user:${req.user.id}`).emit('application:added', application);

    res.status(201).json(application);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:id
router.patch('/:id', async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const existing = await prisma.application.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Application not found' });

    const { status, notes } = parsed.data;
    const updated = await prisma.application.update({
      where: { id: req.params.id },
      data:  {
        ...(status !== undefined && { status }),
        ...(notes  !== undefined && { notes }),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.application.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Application not found' });

    await prisma.application.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
