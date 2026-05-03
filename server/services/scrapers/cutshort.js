// server/services/scrapers/cutshort.js
// Cutshort exposes a GraphQL-like REST API used by their webapp.
// No auth token required for public job listings.

const axios  = require('axios');
const logger = require('../../middleware/logger');

const BASE_URL = 'https://cutshort.io';

// Cutshort's actual listing endpoint (inspected from their web app network calls)
async function fetchCutshortJobs(userProfile = {}) {
  const results = [];
  const seen    = new Set();

  const endpoints = [
    // Primary: their public listing API
    {
      method: 'POST',
      url:    `${BASE_URL}/api/jobs/list`,
      data: {
        filters: {
          experience: { min: 0, max: 2 },
          type: 'full_time',
        },
        page:     0,
        pageSize: 30,
        sort:     'recent',
      },
      extract: r => r.data?.data || r.data?.jobs || [],
    },
    // Fallback: their v1 public endpoint
    {
      method: 'GET',
      url:    `${BASE_URL}/api/v1/jobs`,
      params: { limit: 30, offset: 0, experience_min: 0, experience_max: 2 },
      extract: r => r.data?.data || r.data?.jobs || [],
    },
  ];

  for (const ep of endpoints) {
    if (results.length >= 15) break;
    try {
      await sleep(800 + Math.random() * 800);

      const res = await axios({
        method: ep.method,
        url:    ep.url,
        ...(ep.data   ? { data: ep.data }     : {}),
        ...(ep.params ? { params: ep.params }  : {}),
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
          'Origin':       BASE_URL,
          'Referer':      `${BASE_URL}/jobs`,
          'User-Agent':   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        },
        timeout:        12000,
        validateStatus: s => s < 500,
      });

      if (res.status !== 200) continue;

      const raw = ep.extract(res);
      for (const j of raw) {
        const job = normalizeJob(j);
        if (job && !seen.has(job.externalId)) {
          seen.add(job.externalId);
          results.push(job);
        }
      }
      logger.info(`Cutshort: endpoint "${ep.url}" → ${raw.length} jobs`);
      if (results.length) break;  // primary worked, skip fallback
    } catch (err) {
      logger.warn(`Cutshort endpoint "${ep.url}" error: ${err.message}`);
    }
  }

  // Always append portal link
  if (!seen.has('cutshort_portal_main')) {
    results.push({
      externalId:   'cutshort_portal_main',
      title:        'React / Full Stack Jobs — Cutshort',
      company:      'Browse on Cutshort',
      platform:     'cutshort',
      location:     'India',
      applyUrl:     'https://cutshort.io/jobs?skills=React%2CNode.js&experience=0-2&type=full_time',
      tags:         ['React', 'Node.js', 'fresher'],
      isRemote:     false,
      experienceLevel: 'fresher',
      jobType:      'fullstack',
      description:  'Browse React and Full Stack developer jobs on Cutshort (0-2 years exp).',
      isPortalLink: true,
    });
  }

  logger.info(`Cutshort total: ${results.length} jobs (${results.filter(j => !j.isPortalLink).length} real)`);
  return results;
}

function normalizeJob(j) {
  if (!j) return null;
  const id = j._id || j.id || j.shortCode;
  if (!id) return null;

  const locations = (j.locations || j.location || []);
  const locationStr = Array.isArray(locations)
    ? locations.join(', ')
    : (typeof locations === 'string' ? locations : 'India');

  const skills = (j.skills || j.tags || []).map(s =>
    typeof s === 'object' ? (s.name || s.label || '') : String(s)
  ).filter(Boolean).slice(0, 6);

  const ctcMin = j.ctcMin || j.salaryMin || null;
  const ctcMax = j.ctcMax || j.salaryMax || null;
  const salary = ctcMin && ctcMax ? `${ctcMin}–${ctcMax} LPA`
    : ctcMax ? `Up to ${ctcMax} LPA`
    : null;

  const slug = j.shortCode || j.slug || id;

  return {
    externalId:      `cutshort_${id}`,
    title:           j.title || j.role || '',
    company:         j.company?.name || j.companyName || 'Unknown',
    platform:        'cutshort',
    location:        locationStr || 'India',
    salary,
    salaryMin:       ctcMin ? parseFloat(ctcMin) : null,
    salaryMax:       ctcMax ? parseFloat(ctcMax) : null,
    applyUrl:        `${BASE_URL}/job/${slug}`,
    tags:            skills,
    isRemote:        /remote/i.test(locationStr),
    experienceLevel: 'fresher',
    jobType:         classifyJobType(j.title || j.role || ''),
    description:     ((j.description || j.about || '')).replace(/<[^>]+>/g, '').slice(0, 300),
    companyLogo:     j.company?.logo || j.companyLogo || null,
    postedAt:        j.publishedAt ? new Date(j.publishedAt) : null,
  };
}

function classifyJobType(title = '') {
  const t = title.toLowerCase();
  if (/fullstack|full.?stack|mern|mean|backend|node\.?js/.test(t)) return 'fullstack';
  if (/frontend|react|vue|angular|ui\b|next\.?js/.test(t))         return 'frontend';
  return 'other';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { fetchCutshortJobs };
