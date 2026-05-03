// server/services/scrapers/naukri.js
// Naukri exposes a JSON search API used by their own web app.
// Works without login for keyword searches (cookie improves quality of results).
// Falls back to portal links if the API returns an unexpected response.

const axios   = require('axios');
const logger  = require('../../middleware/logger');

const SEARCH_QUERIES = [
  { keyword: 'React Developer',      location: 'bangalore' },
  { keyword: 'Full Stack Developer', location: 'hyderabad' },
  { keyword: 'Frontend Developer',   location: 'pune'      },
  { keyword: 'Node.js Developer',    location: 'mumbai'    },
  { keyword: 'Software Engineer',    location: 'chennai'   },
];

function buildHeaders() {
  const headers = {
    'appid':       '109',
    'systemid':    'Naukri',
    'User-Agent':  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    'Accept':      'application/json',
    'Referer':     'https://www.naukri.com/',
    'x-http-method-override': 'GET',
    'clientid':    'd3skt0p',
  };
  const cookie = process.env.NAUKRI_COOKIE;
  if (cookie) headers['Cookie'] = cookie;
  return headers;
}

function normalizeJob(j) {
  const location = (j.placeholders || []).find(p => p.type === 'location')?.label
    || (j.locations || []).join(', ')
    || 'India';
  const salary = (j.placeholders || []).find(p => p.type === 'salary')?.label || null;
  const tags   = (j.tagsAndSkills || j.skills || '')
    .split(/[,;]/).map(s => s.trim()).filter(Boolean).slice(0, 6);

  return {
    externalId:      `naukri_${j.jobId || j.id}`,
    title:           j.title || '',
    company:         j.companyName || j.company || 'Unknown',
    platform:        'naukri',
    location,
    salary,
    applyUrl:        j.jdURL
      ? (j.jdURL.startsWith('http') ? j.jdURL : `https://www.naukri.com${j.jdURL}`)
      : `https://www.naukri.com/job-listings-${j.jobId}`,
    tags,
    isRemote:        /remote/i.test(location + ' ' + (j.title || '')),
    experienceLevel: 'fresher',
    jobType:         classifyJobType(j.title),
    description:     ((j.jobDescription || j.description || '')).replace(/<[^>]+>/g, '').slice(0, 300),
    companyLogo:     j.logoPathV3 || j.companyLogo || null,
    postedAt:        j.createdDate ? new Date(j.createdDate * 1000) : null,
  };
}

async function fetchNaukriJobs(userProfile = {}) {
  const results = [];
  const seen    = new Set();

  for (const q of SEARCH_QUERIES.slice(0, 3)) {
    try {
      await sleep(1200 + Math.random() * 1500);

      const res = await axios.get('https://www.naukri.com/jobapi/v3/search', {
        params: {
          noOfResults: 20,
          urlType:     'search_by_key_loc',
          searchType:  'adv',
          keyword:     q.keyword,
          experience:  0,
          location:    q.location,
          jobAge:      7,
          src:         'jobsearchDesk',
        },
        headers:        buildHeaders(),
        timeout:        12000,
        validateStatus: s => s < 500,
      });

      if (res.status !== 200) {
        logger.warn(`Naukri API returned ${res.status} for "${q.keyword}"`);
        continue;
      }

      const raw = res.data?.jobDetails || res.data?.jobs || [];
      for (const j of raw) {
        const job = normalizeJob(j);
        if (!seen.has(job.externalId)) {
          seen.add(job.externalId);
          results.push(job);
        }
      }
      logger.info(`Naukri: "${q.keyword}" @ ${q.location} → ${raw.length} jobs`);
    } catch (err) {
      logger.warn(`Naukri API error for "${q.keyword}": ${err.message}`);
    }
  }

  // Append portal shortcuts so users always have direct search links
  const shortcuts = generatePortalLinks(userProfile);
  for (const s of shortcuts) {
    if (!seen.has(s.externalId)) results.push(s);
  }

  logger.info(`Naukri total: ${results.length} jobs (${results.filter(j => !j.isPortalLink).length} real)`);
  return results;
}

function generatePortalLinks(userProfile = {}) {
  const city  = (userProfile.city || 'Bangalore').toLowerCase();
  const roles = userProfile.jobPreferences || ['React Developer', 'Full Stack Developer'];

  return roles.slice(0, 2).map((role, i) => ({
    externalId:   `naukri_portal_${i}_${role.replace(/\s+/g, '_').toLowerCase()}`,
    title:        `${role} Fresher — Naukri Search`,
    company:      'Browse on Naukri',
    platform:     'naukri',
    location:     userProfile.city || 'Bangalore',
    applyUrl:     `https://www.naukri.com/${role.toLowerCase().replace(/\s+/g, '-')}-jobs-in-${city}?experience=0`,
    tags:         ['fresher', '0-1 years'],
    isRemote:     false,
    experienceLevel: 'fresher',
    jobType:      role.toLowerCase().includes('full') ? 'fullstack' : 'frontend',
    description:  `Browse ${role} fresher jobs on Naukri in ${userProfile.city || 'Bangalore'}.`,
    isPortalLink: true,
  }));
}

function classifyJobType(title = '') {
  const t = title.toLowerCase();
  if (/fullstack|full.?stack|mern|mean|backend|node\.?js/.test(t)) return 'fullstack';
  if (/frontend|react|vue|angular|ui\b|next\.?js/.test(t))         return 'frontend';
  return 'other';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { fetchNaukriJobs };
