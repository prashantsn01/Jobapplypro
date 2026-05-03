// server/routes/user.js
const express         = require('express');
const multer          = require('multer');
const path            = require('path');
const { z }           = require('zod');
const { requireAuth } = require('../middleware/auth');
const prisma          = require('../lib/prisma');
const { parseResume } = require('../services/resumeParser');
const router          = express.Router();

router.use(requireAuth);

// Multer: memory storage, 5 MB limit, allow pdf/docx only
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ALLOWED_MIME = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only PDF and DOCX files are allowed'));
  },
});

const ProfileSchema = z.object({
  name:            z.string().min(1).max(100).trim().optional(),
  phone:           z.string().max(20).optional().nullable(),
  city:            z.string().max(100).optional().nullable(),
  college:         z.string().max(200).optional().nullable(),
  degree:          z.string().max(100).optional().nullable(),
  branch:          z.string().max(100).optional().nullable(),
  graduationYear:  z.string().max(4).optional().nullable(),
  cgpa:            z.string().max(10).optional().nullable(),
  skills:          z.array(z.string().max(50)).max(50).optional(),
  jobPreferences:  z.array(z.string().max(100)).max(10).optional(),
  linkedinUrl:     z.string().url().optional().or(z.literal('')).nullable(),
  githubUrl:       z.string().url().optional().or(z.literal('')).nullable(),
  portfolioUrl:    z.string().url().optional().or(z.literal('')).nullable(),
  openToRemote:    z.boolean().optional(),
  openToRelocation:z.boolean().optional(),
  noticePeriod:    z.string().max(50).optional().nullable(),
  expectedSalary:  z.string().max(100).optional().nullable(),
});

// GET /api/user/profile
router.get('/profile', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: {
        id: true, name: true, email: true, avatar: true, gmailConnected: true,
        profileComplete: true, phone: true, city: true, college: true,
        degree: true, branch: true, graduationYear: true, cgpa: true,
        skills: true, jobPreferences: true, linkedinUrl: true, githubUrl: true,
        portfolioUrl: true, openToRemote: true, openToRelocation: true,
        noticePeriod: true, expectedSalary: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/user/profile
router.patch('/profile', async (req, res) => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const data = { ...parsed.data };
    // Remove undefined keys so we don't accidentally null out fields
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const requiredFields = ['name', 'phone', 'city', 'college', 'degree', 'branch', 'graduationYear', 'skills'];
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const merged = { ...user, ...data };
    const profileComplete = requiredFields.every(f => merged[f] && String(merged[f]).trim().length > 0);

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data:  { ...data, profileComplete },
      select: { id: true, name: true, email: true, avatar: true, profileComplete: true,
        phone: true, city: true, college: true, degree: true, branch: true,
        graduationYear: true, cgpa: true, skills: true, jobPreferences: true,
        linkedinUrl: true, githubUrl: true, portfolioUrl: true,
        openToRemote: true, openToRelocation: true, noticePeriod: true, expectedSalary: true },
    });
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user/resume — upload & auto-parse
router.post('/resume', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const parsed = await parseResume(req.file.buffer, req.file.mimetype);
    if (!parsed) return res.status(422).json({ error: 'Could not parse resume' });

    // Auto-populate profile with parsed data (don't overwrite existing values)
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const updates = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && !user[k]) updates[k] = v;
    }
    if (Object.keys(updates).length) {
      await prisma.user.update({ where: { id: req.user.id }, data: updates });
    }

    res.json({ success: true, parsed, fieldsFilled: Object.keys(updates).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 5 MB)' });
  res.status(400).json({ error: err.message });
});

module.exports = router;
