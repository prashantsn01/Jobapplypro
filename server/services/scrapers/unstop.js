// server/services/scrapers/unstop.js
// Unstop (formerly Dare2Compete) has a public opportunity search API.
// We fetch real job listings without authentication.

const axios  = require('axios');
const logger = require('../../middleware/logger');

const BASE_URL = 'https://unstop.com';

async function fetchUnstopJobs(userProfile = {}) {
  const results = [];
  const seen    = new Set();

  const queries = [
    { opportunity: 'jobs',        type: '2', label: 'Jobs' },
    { opportunity: 'internship',  type: '1', label: 'Internships' },
  ];

  for (const q of queries) {
    try {
      await sleep(1000 + Math.random() * 1000);

      const res = await axios.get(`${BASE_URL}/api/public/opportunity/search-result`, {
        params: {
          opportunity: q.opportunity,
          per_page:    20,
          page:        1,
          'type[]':    q.type,
          // Filter for tech roles
          'superCategory[]': '2',  // Engineering & Technology
        },
        headers: {
          'Accept':          'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin':          BASE_URL,
          'Referer':         `${BASE_URL}/${q.opportunity}s`,
          'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        },
        timeout:        12000,
        validateStatus: s => s < 500,
      });

      if (res.status !== 200) {
        logger.warn(`Unstop API returned ${res.status} for ${q.label}`);
        continue;
      }

      const raw = res.data?.data?.data
        || res.data?.data
        || res.data?.opportunities
        || [];

      for (const item of raw) {
        const job = normalizeJob(item, q.opportunity);
        if (job && !seen.has(job.externalId)) {
          seen.add(job.externalId);
          results.push(job);
        }
      }
      logger.info(`Unstop: ${q.label} → ${raw.length} results`);
    } catch (err) {
      logger.warn(`Unstop API error for ${q.label}: ${err.message}`);
    }
  }

  // Fallback portal links
  const portals = generatePortalLinks();
  for (const p of portals) {
    if (!seen.has(p.externalId)) results.push(p);
  }

  logger.info(`Unstop total: ${results.length} jobs (${results.filter(j => !j.isPortalLink).length} real)`);
  return results;
}

function normalizeJob(item, opportunityType) {
  if (!item) return null;
  const id = item.id || item.opportunity_id;
  if (!id) return null;

  const title   = item.title || item.name || item.opportunity_name || '';
  const company = item.organisation?.name
    || item.company?.name
    || item.organisation_name
    || 'Unknown';

  const location = item.location || item.city
    || (item.locations || []).join(', ')
    || 'India';

  const isRemote = /remote|anywhere|virtual/i.test(location);

  const slug    = item.slug || item.url_slug || id;
  const applyUrl = `${BASE_URL}/o/${slug}-${id}`;

  const skills = (item.skills || item.tags || []).map(s =>
    typeof s === 'object' ? (s.name || s.title || '') : String(s)
  ).filter(Boolean).slice(0, 6);

  const stipend = item.stipend || item.salary_range;
  const salary  = stipend
    ? (typeof stipend === 'string' ? stipend : `₹${stipend.from || 0}–${stipend.to || '?'}`)
    : null;

  const postedRaw = item.start_date || item.created_at || item.posted_at;
  const postedAt  = postedRaw ? new Date(postedRaw) : null;

  return {
    externalId:      `unstop_${id}`,
    title:           title || (opportunityType === 'internship' ? 'Tech Internship' : 'Tech Job'),
    company,
    platform:        'unstop',
    location:        typeof location === 'string' ? location : 'India',
    salary,
    applyUrl,
    tags:            skills.length ? skills : ['fresher', 'tech'],
    isRemote,
    experienceLevel: 'fresher',
    jobType:         classifyJobType(title),
    description:     (item.description || item.about || '').replace(/<[^>]+>/g, '').slice(0, 300),
    companyLogo:     item.organisation?.logo || item.company?.logo || null,
    postedAt,
  };
}

function generatePortalLinks() {
  return [
    {
      externalId:      'unstop_portal_jobs',
      title:           'Tech Jobs — Unstop',
      company:         'Browse on Unstop',
      platform:        'unstop',
      location:        'India',
      applyUrl:        'https://unstop.com/jobs?superCategory=2&opportunity=jobs',
      tags:            ['tech', 'fresher', 'jobs'],
      isRemote:        false,
      experienceLevel: 'fresher',
      jobType:         'other',
      description:     'Browse engineering and tech jobs for freshers on Unstop.',
      isPortalLink:    true,
    },
    {
      externalId:      'unstop_portal_internships',
      title:           'Tech Internships — Unstop',
      company:         'Browse on Unstop',
      platform:        'unstop',
      location:        'India',
      applyUrl:        'https://unstop.com/internships?superCategory=2',
      tags:            ['internship', 'fresher', 'tech'],
      isRemote:        false,
      experienceLevel: 'fresher',
      jobType:         'other',
      description:     'Browse engineering and tech internships on Unstop.',
      isPortalLink:    true,
    },
  ];
}

function classifyJobType(title = '') {
  const t = title.toLowerCase();
  if (/fullstack|full.?stack|mern|mean|backend|node/.test(t)) return 'fullstack';
  if (/frontend|react|vue|angular|ui\b/.test(t))              return 'frontend';
  return 'other';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { fetchUnstopJobs };
