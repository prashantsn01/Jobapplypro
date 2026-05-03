// server/services/scrapers/linkedin.js
// Strategy: LinkedIn's "jobs-guest" API returns HTML fragments — no auth needed.
// We parse with cheerio. If rate-limited (429) we fall back to search portal links.
// Optionally pass LINKEDIN_COOKIE (li_at value) for higher rate limits.

const axios   = require('axios');
const cheerio = require('cheerio');
const logger  = require('../../middleware/logger');

const SEARCH_QUERIES = [
  { keywords: 'React Developer',        location: 'India', f_E: '1,2' },
  { keywords: 'Full Stack Developer',   location: 'India', f_E: '1,2' },
  { keywords: 'Frontend Developer',     location: 'India', f_E: '1,2' },
  { keywords: 'Node.js Developer',      location: 'India', f_E: '1,2' },
  { keywords: 'Software Engineer',      location: 'Bangalore, India', f_E: '1,2' },
];

function buildHeaders() {
  const base = {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection':      'keep-alive',
    'Referer':         'https://www.linkedin.com/jobs/search/',
  };
  const cookie = process.env.LINKEDIN_COOKIE;
  if (cookie) {
    base['Cookie'] = `li_at=${cookie}`;
    base['Csrf-Token'] = 'ajax:' + Math.random().toString(36).slice(2);
  }
  return base;
}

function parseJobCards($) {
  const jobs = [];

  // LinkedIn uses multiple card selectors across versions — try all
  const selectors = [
    'li[data-occludable-job-id]',
    '.job-search-card',
    '.jobs-search__results-list > li',
    '.base-card',
  ];

  let $cards = $();
  for (const sel of selectors) {
    $cards = $(sel);
    if ($cards.length) break;
  }

  $cards.each((_, el) => {
    const $el = $(el);

    // Job ID
    const jobId = $el.attr('data-occludable-job-id')
      || $el.attr('data-entity-urn')?.split(':').pop()
      || $el.find('a[href*="/jobs/view/"]').attr('href')?.match(/\/jobs\/view\/(\d+)/)?.[1];

    if (!jobId) return;

    // Title
    const title = ($el.find('.base-search-card__title, .job-search-card__title').first().text()
      || $el.find('h3').first().text()).trim();

    // Company
    const company = ($el.find('.base-search-card__subtitle, .job-search-card__company-name').first().text()
      || $el.find('h4').first().text()).trim();

    // Location
    const location = $el.find('.job-search-card__location, .base-search-card__metadata').first().text().trim();

    // Apply URL — use the clean canonical URL, strip tracking params
    const rawLink = $el.find('a.base-card__full-link, a[href*="/jobs/view/"]').first().attr('href') || '';
    const applyUrl = rawLink ? 'https://www.linkedin.com' + rawLink.split('?')[0] : `https://www.linkedin.com/jobs/view/${jobId}`;

    // Date
    const dateStr = $el.find('time').attr('datetime');
    const postedAt = dateStr ? new Date(dateStr) : null;

    if (!title || !company) return;

    jobs.push({
      externalId:      `linkedin_${jobId}`,
      title,
      company,
      platform:        'linkedin',
      location:        location || 'India',
      applyUrl,
      postedAt,
      tags:            extractTagsFromTitle(title),
      isRemote:        /remote/i.test(location),
      experienceLevel: 'fresher',
      jobType:         classifyJobType(title),
      description:     `${title} at ${company} — ${location || 'India'}`,
    });
  });

  return jobs;
}

async function fetchLinkedInJobs(userProfile = {}) {
  const results = [];
  const seen    = new Set();

  for (let i = 0; i < Math.min(SEARCH_QUERIES.length, 3); i++) {
    const q = SEARCH_QUERIES[i];
    try {
      await sleep(1500 + Math.random() * 2000);

      const res = await axios.get(
        'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search',
        {
          params: {
            keywords: q.keywords,
            location: q.location,
            f_E:      q.f_E,
            f_TPR:   'r604800',  // last 7 days
            start:   0,
            count:   25,
          },
          headers:        buildHeaders(),
          timeout:        15000,
          validateStatus: s => s < 500,
        }
      );

      if (res.status === 429) {
        logger.warn(`LinkedIn rate-limited on "${q.keywords}" — skipping`);
        continue;
      }
      if (res.status !== 200 || !res.data) continue;

      const $ = cheerio.load(res.data);
      const jobs = parseJobCards($);

      for (const job of jobs) {
        if (!seen.has(job.externalId)) {
          seen.add(job.externalId);
          results.push(job);
        }
      }
      logger.info(`LinkedIn: "${q.keywords}" → ${jobs.length} jobs`);
    } catch (err) {
      logger.warn(`LinkedIn scrape error for "${q.keywords}": ${err.message}`);
    }
  }

  // Always add a few search portal shortcuts so the UI has fallback links
  const shortcuts = generatePortalLinks(userProfile);
  for (const s of shortcuts) {
    if (!seen.has(s.externalId)) results.push(s);
  }

  logger.info(`LinkedIn total: ${results.length} jobs (${results.filter(j=>!j.isPortalLink).length} real)`);
  return results;
}

function generatePortalLinks(userProfile = {}) {
  const city = userProfile.city || 'Bangalore';
  return [
    {
      externalId: 'linkedin_portal_react',
      title: 'React Developer Fresher — LinkedIn Search',
      company: 'Browse on LinkedIn',
      platform: 'linkedin',
      location: city,
      applyUrl: `https://www.linkedin.com/jobs/search/?keywords=React+Developer+fresher&location=${encodeURIComponent(city)}&f_E=1%2C2&sortBy=DD`,
      tags: ['React', 'fresher', 'frontend'],
      isRemote: false,
      experienceLevel: 'fresher',
      jobType: 'frontend',
      description: `Find React Developer fresher jobs in ${city} on LinkedIn.`,
      isPortalLink: true,
    },
    {
      externalId: 'linkedin_portal_fullstack',
      title: 'Full Stack Developer Fresher — LinkedIn Search',
      company: 'Browse on LinkedIn',
      platform: 'linkedin',
      location: city,
      applyUrl: `https://www.linkedin.com/jobs/search/?keywords=Full+Stack+Developer+fresher&location=${encodeURIComponent(city)}&f_E=1%2C2&sortBy=DD`,
      tags: ['Full Stack', 'MERN', 'fresher'],
      isRemote: false,
      experienceLevel: 'fresher',
      jobType: 'fullstack',
      description: `Find Full Stack Developer fresher jobs in ${city} on LinkedIn.`,
      isPortalLink: true,
    },
  ];
}

function classifyJobType(title = '') {
  const t = title.toLowerCase();
  if (/fullstack|full.?stack|mern|mean|backend|node\.?js|express/.test(t)) return 'fullstack';
  if (/frontend|react|vue|angular|ui\b|next\.?js/.test(t))                 return 'frontend';
  return 'other';
}

function extractTagsFromTitle(title = '') {
  const keywords = ['React', 'Node.js', 'Angular', 'Vue', 'TypeScript',
    'JavaScript', 'Python', 'Java', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker'];
  return keywords.filter(k => new RegExp(k, 'i').test(title));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { fetchLinkedInJobs };
