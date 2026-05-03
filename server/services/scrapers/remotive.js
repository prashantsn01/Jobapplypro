// server/services/scrapers/remotive.js
// Remotive public API — free, no auth, very reliable.

const axios  = require('axios');
const logger = require('../../middleware/logger');

const CATEGORIES = ['software-dev', 'devops-sysadmin', 'product'];

async function fetchRemotiveJobs() {
  const allJobs = [];
  const seen    = new Set();

  for (const category of CATEGORIES) {
    try {
      const res = await axios.get('https://remotive.com/api/remote-jobs', {
        params:  { category, limit: 50 },
        timeout: 12000,
        headers: { 'User-Agent': 'JobApplyPro/2.0' },
      });

      for (const j of (res.data?.jobs || [])) {
        const job = normalizeJob(j);
        if (!seen.has(job.externalId)) {
          seen.add(job.externalId);
          allJobs.push(job);
        }
      }
      logger.info(`Remotive: ${category} → ${res.data?.jobs?.length ?? 0} jobs`);
    } catch (err) {
      logger.warn(`Remotive fetch failed for ${category}: ${err.message}`);
    }
  }

  logger.info(`Remotive total: ${allJobs.length} jobs`);
  return allJobs;
}

function normalizeJob(j) {
  const title = j.title || '';
  const t     = title.toLowerCase();

  const jobType = /fullstack|full.?stack|mern|backend|node/.test(t) ? 'fullstack'
    : /frontend|react|vue|angular|ui/.test(t)                       ? 'frontend'
    : 'other';

  return {
    externalId:      `remotive_${j.id}`,
    title,
    company:         j.company_name || 'Unknown',
    platform:        'remotive',
    location:        j.candidate_required_location || 'Worldwide',
    salary:          null,
    salaryMin:       null,
    salaryMax:       null,
    applyUrl:        j.url,
    postedAt:        j.publication_date ? new Date(j.publication_date) : null,
    tags:            (j.tags || []).slice(0, 6),
    isRemote:        true,
    experienceLevel: 'fresher',
    description:     (j.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
    companyLogo:     j.company_logo || null,
    jobType,
  };
}

module.exports = { fetchRemotiveJobs };
