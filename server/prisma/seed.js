// server/prisma/seed.js
// Seeds the database with sample portal job shortcuts so the UI isn't empty
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PORTAL_SHORTCUTS = [
  // LinkedIn
  { externalId: 'linkedin_search_fe',   title: '🔍 Frontend Developer Fresher – LinkedIn',   company: 'LinkedIn',  platform: 'linkedin',  location: 'India',     applyUrl: 'https://www.linkedin.com/jobs/search/?keywords=frontend%20developer&location=India&f_E=1&sortBy=DD',                                    tags: ['fresher', 'frontend'], isRemote: false, experienceLevel: 'fresher', jobType: 'frontend',  description: 'Browse Frontend Developer fresher jobs on LinkedIn, sorted newest first.' },
  { externalId: 'linkedin_search_fs',   title: '🔍 Full Stack / MERN Fresher – LinkedIn',    company: 'LinkedIn',  platform: 'linkedin',  location: 'Bangalore', applyUrl: 'https://www.linkedin.com/jobs/search/?keywords=full%20stack%20developer%20fresher&location=Bengaluru%20Karnataka&f_E=1&sortBy=DD',  tags: ['fresher', 'fullstack'], isRemote: false, experienceLevel: 'fresher', jobType: 'fullstack', description: 'Browse Full Stack Developer fresher jobs on LinkedIn.' },
  { externalId: 'linkedin_search_sde',  title: '🔍 Software Engineer Fresher – LinkedIn',    company: 'LinkedIn',  platform: 'linkedin',  location: 'India',     applyUrl: 'https://www.linkedin.com/jobs/search/?keywords=software%20engineer%20fresher&location=India&f_E=1&f_JT=F&sortBy=DD',               tags: ['fresher', 'sde'], isRemote: false, experienceLevel: 'fresher', jobType: 'fullstack', description: 'Browse SDE fresher jobs on LinkedIn.' },
  { externalId: 'linkedin_search_react',title: '🔍 React Developer Entry Level – LinkedIn',  company: 'LinkedIn',  platform: 'linkedin',  location: 'India',     applyUrl: 'https://www.linkedin.com/jobs/search/?keywords=react%20developer&location=India&f_E=1&sortBy=DD',                                      tags: ['React', 'fresher'], isRemote: false, experienceLevel: 'fresher', jobType: 'frontend', description: 'Browse React Developer fresher jobs on LinkedIn.' },
  // Naukri
  { externalId: 'naukri_search_fe',     title: '🔍 Frontend Developer 0yr – Naukri',         company: 'Naukri',    platform: 'naukri',    location: 'India',     applyUrl: 'https://www.naukri.com/frontend-developer-jobs?experience=0&sortBy=recency&jobAge=1',                                                   tags: ['fresher', 'frontend'], isRemote: false, experienceLevel: 'fresher', jobType: 'frontend',  description: 'Browse Frontend Developer 0yr exp jobs on Naukri.' },
  { externalId: 'naukri_search_fs',     title: '🔍 Full Stack Developer Fresher – Naukri',   company: 'Naukri',    platform: 'naukri',    location: 'India',     applyUrl: 'https://www.naukri.com/full-stack-developer-jobs?experience=0&sortBy=recency&jobAge=1',                                                 tags: ['fresher', 'fullstack'], isRemote: false, experienceLevel: 'fresher', jobType: 'fullstack', description: 'Browse Full Stack Developer fresher jobs on Naukri.' },
  { externalId: 'naukri_search_react',  title: '🔍 React Developer Fresher – Naukri Blr',   company: 'Naukri',    platform: 'naukri',    location: 'Bangalore', applyUrl: 'https://www.naukri.com/react-developer-jobs-in-bangalore?experience=0&sortBy=recency',                                                  tags: ['React', 'Bangalore'], isRemote: false, experienceLevel: 'fresher', jobType: 'frontend', description: 'Browse React Developer fresher jobs in Bangalore on Naukri.' },
  { externalId: 'naukri_search_mern',   title: '🔍 MERN Stack Fresher – Naukri',             company: 'Naukri',    platform: 'naukri',    location: 'India',     applyUrl: 'https://www.naukri.com/mern-stack-developer-jobs?experience=0&sortBy=recency',                                                           tags: ['MERN', 'fresher'], isRemote: false, experienceLevel: 'fresher', jobType: 'fullstack', description: 'Browse MERN Stack Developer fresher jobs on Naukri.' },
  // Unstop
  { externalId: 'unstop_search_fe',     title: '🔍 Frontend / React Fresher – Unstop',       company: 'Unstop',    platform: 'unstop',    location: 'India',     applyUrl: 'https://unstop.com/jobs?oppType=job&filters=fresher&domain=Technology&subDomain=Front-end+Development',                                 tags: ['fresher', 'frontend'], isRemote: true, experienceLevel: 'fresher', jobType: 'frontend',  description: 'Browse Frontend/React fresher jobs on Unstop.' },
  { externalId: 'unstop_search_fs',     title: '🔍 Full Stack / SDE Fresher – Unstop',       company: 'Unstop',    platform: 'unstop',    location: 'India',     applyUrl: 'https://unstop.com/jobs?oppType=job&filters=fresher&domain=Technology&subDomain=Full+Stack+Development',                                tags: ['fresher', 'fullstack'], isRemote: true, experienceLevel: 'fresher', jobType: 'fullstack', description: 'Browse Full Stack SDE fresher jobs on Unstop.' },
  // Cutshort
  { externalId: 'cutshort_search_fe',   title: '🔍 Frontend Developer 0–1yr – Cutshort',     company: 'Cutshort', platform: 'cutshort',  location: 'India',     applyUrl: 'https://cutshort.io/jobs?min_exp=0&max_exp=1&tech=frontend',                                                                              tags: ['fresher', 'frontend'], isRemote: false, experienceLevel: 'fresher', jobType: 'frontend',  description: 'Browse Frontend Developer 0-1yr jobs on Cutshort.' },
  { externalId: 'cutshort_search_fs',   title: '🔍 Full Stack Developer 0–1yr – Cutshort',   company: 'Cutshort', platform: 'cutshort',  location: 'India',     applyUrl: 'https://cutshort.io/jobs?min_exp=0&max_exp=1&tech=full-stack',                                                                             tags: ['fresher', 'fullstack'], isRemote: false, experienceLevel: 'fresher', jobType: 'fullstack', description: 'Browse Full Stack Developer 0-1yr jobs on Cutshort.' },
  // Wellfound
  { externalId: 'wellfound_search_fe',  title: '🔍 Frontend Engineer Entry – Wellfound',     company: 'Wellfound', platform: 'wellfound', location: 'India/Remote', applyUrl: 'https://wellfound.com/jobs?role=frontend-engineer&experience%5B%5D=entry&remote=true',                                                 tags: ['startup', 'frontend'], isRemote: true, experienceLevel: 'fresher', jobType: 'frontend', description: 'Browse Frontend Engineer entry-level startup jobs on Wellfound.' },
  { externalId: 'wellfound_search_fs',  title: '🔍 Full Stack Engineer Entry – Wellfound',   company: 'Wellfound', platform: 'wellfound', location: 'India/Remote', applyUrl: 'https://wellfound.com/jobs?role=full-stack-engineer&experience%5B%5D=entry&remote=true',                                               tags: ['startup', 'fullstack'], isRemote: true, experienceLevel: 'fresher', jobType: 'fullstack', description: 'Browse Full Stack Engineer entry-level startup jobs on Wellfound.' },
  // Indeed
  { externalId: 'indeed_search_fe',     title: '🔍 Frontend Developer Fresher – Indeed India', company: 'Indeed', platform: 'indeed',    location: 'India',     applyUrl: 'https://in.indeed.com/jobs?q=frontend+developer+fresher&l=India&sort=date',                                                               tags: ['fresher', 'frontend'], isRemote: false, experienceLevel: 'fresher', jobType: 'frontend',  description: 'Browse Frontend Developer fresher jobs on Indeed India.' },
  { externalId: 'indeed_search_fs',     title: '🔍 Full Stack Developer Fresher – Indeed India', company: 'Indeed', platform: 'indeed', location: 'India',     applyUrl: 'https://in.indeed.com/jobs?q=full+stack+developer+fresher&l=India&sort=date',                                                             tags: ['fresher', 'fullstack'], isRemote: false, experienceLevel: 'fresher', jobType: 'fullstack', description: 'Browse Full Stack Developer fresher jobs on Indeed India.' },
];

async function main() {
  console.log('🌱 Seeding portal job shortcuts...');
  let seeded = 0;

  for (const job of PORTAL_SHORTCUTS) {
    await prisma.job.upsert({
      where:  { externalId: job.externalId },
      update: { ...job, fetchedAt: new Date(), active: true },
      create: { ...job, fetchedAt: new Date(), active: true }
    });
    seeded++;
  }

  console.log(`✅ Seeded ${seeded} portal shortcuts`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
