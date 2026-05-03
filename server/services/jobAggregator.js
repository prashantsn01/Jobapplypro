// server/services/jobAggregator.js
const prisma    = require('../lib/prisma');
const logger    = require('../middleware/logger');
const { broadcastNewJobs } = require('./socketService');

const { fetchLinkedInJobs }  = require('./scrapers/linkedin');
const { fetchNaukriJobs }    = require('./scrapers/naukri');
const { fetchCutshortJobs }  = require('./scrapers/cutshort');
const { fetchUnstopJobs }    = require('./scrapers/unstop');
const { fetchRemotiveJobs }  = require('./scrapers/remotive');

let _scraping = false;

async function runFullScrape(userProfile = {}) {
  if (_scraping) {
    logger.info('Scrape already in progress — skipping');
    return { skipped: true };
  }
  _scraping = true;
  const started = Date.now();

  try {
    logger.info('🔍 Full scrape started');

    // Run all scrapers in parallel, errors per-scraper are swallowed so one failure
    // doesn't kill the rest
    const [linkedin, naukri, cutshort, unstop, remotive] = await Promise.allSettled([
      fetchLinkedInJobs(userProfile),
      fetchNaukriJobs(userProfile),
      fetchCutshortJobs(userProfile),
      fetchUnstopJobs(userProfile),
      fetchRemotiveJobs(),
    ]);

    const allJobs = [
      ...settled(linkedin,  'LinkedIn'),
      ...settled(naukri,    'Naukri'),
      ...settled(cutshort,  'Cutshort'),
      ...settled(unstop,    'Unstop'),
      ...settled(remotive,  'Remotive'),
    ];

    logger.info(`Scrape collected ${allJobs.length} total jobs — upserting to DB`);
    const { saved, fresh } = await upsertJobs(allJobs);

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    logger.info(`✅ Scrape done in ${elapsed}s: ${saved} saved, ${fresh} new`);

    if (fresh > 0 && global.io) {
      const newJobs = await prisma.job.findMany({
        where:   { fetchedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, active: true },
        take:    30,
        orderBy: { fetchedAt: 'desc' },
      });
      broadcastNewJobs(newJobs);
    }

    return { saved, fresh, total: allJobs.length, elapsedSec: parseFloat(elapsed) };
  } finally {
    _scraping = false;
  }
}

function settled(result, name) {
  if (result.status === 'fulfilled') return result.value || [];
  logger.warn(`${name} scraper rejected: ${result.reason?.message}`);
  return [];
}

async function upsertJobs(jobs) {
  let saved = 0;
  let fresh = 0;
  const BATCH = 50;

  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    await Promise.all(batch.map(async job => {
      try {
        const { externalId, ...data } = sanitiseJob(job);
        if (!externalId) return;

        const existing = await prisma.job.findUnique({ where: { externalId } });
        await prisma.job.upsert({
          where:  { externalId },
          update: { ...data, fetchedAt: new Date(), active: true },
          create: { externalId, ...data, fetchedAt: new Date(), active: true },
        });
        if (!existing) fresh++;
        saved++;
      } catch (err) {
        logger.warn(`Upsert failed for ${job.externalId}: ${err.message}`);
      }
    }));
  }

  return { saved, fresh };
}

function sanitiseJob(j) {
  return {
    externalId:      String(j.externalId || '').slice(0, 500),
    title:           String(j.title       || '').slice(0, 300),
    company:         String(j.company     || 'Unknown').slice(0, 200),
    platform:        String(j.platform    || 'other').slice(0, 50),
    location:        String(j.location    || '').slice(0, 200),
    salary:          j.salary    ? String(j.salary).slice(0, 100)    : null,
    salaryMin:       typeof j.salaryMin === 'number' ? j.salaryMin   : null,
    salaryMax:       typeof j.salaryMax === 'number' ? j.salaryMax   : null,
    applyUrl:        String(j.applyUrl    || '').slice(0, 1000),
    description:     j.description ? String(j.description).slice(0, 1000) : null,
    tags:            Array.isArray(j.tags) ? j.tags.map(t => String(t).slice(0, 50)).slice(0, 10) : [],
    isRemote:        Boolean(j.isRemote),
    isPortalLink:    Boolean(j.isPortalLink),
    experienceLevel: String(j.experienceLevel || 'fresher').slice(0, 50),
    jobType:         String(j.jobType || 'other').slice(0, 50),
    companyLogo:     j.companyLogo ? String(j.companyLogo).slice(0, 500) : null,
    postedAt:        j.postedAt instanceof Date ? j.postedAt : null,
  };
}

async function getJobsFromDB({ page = 1, limit = 30, platform, role, location, search, experienceLevel } = {}) {
  const where = { active: true };

  if (platform && platform !== 'all')         where.platform        = platform;
  if (experienceLevel && experienceLevel !== 'all') where.experienceLevel = experienceLevel;
  if (role     === 'frontend')  where.jobType = 'frontend';
  if (role     === 'fullstack') where.jobType = 'fullstack';
  if (location && location !== 'all') {
    where.OR = [
      { location: { contains: location, mode: 'insensitive' } },
      { isRemote: true },
    ];
  }
  if (search) {
    const q = search.trim();
    where.OR = [
      { title:   { contains: q, mode: 'insensitive' } },
      { company: { contains: q, mode: 'insensitive' } },
    ];
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ postedAt: 'desc' }, { fetchedAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, total, page, pages: Math.ceil(total / limit) };
}

module.exports = { runFullScrape, getJobsFromDB };
