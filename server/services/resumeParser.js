// server/services/resumeParser.js
// Parses PDF/DOCX resumes and returns fields mapped to the User flat-profile schema.
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');
const logger   = require('../middleware/logger');

const SKILLS_LIST = [
  'React','Next.js','Vue.js','Angular','Svelte','JavaScript','TypeScript','HTML','CSS',
  'Tailwind','Bootstrap','Sass','Node.js','Express','Fastify','NestJS',
  'MongoDB','PostgreSQL','MySQL','SQLite','Redis','GraphQL','REST API',
  'Python','Django','Flask','FastAPI','Java','Spring Boot','Kotlin','Go',
  'Rust','C++','C#','PHP','Laravel','Ruby','Flutter','React Native','Swift',
  'AWS','GCP','Azure','Docker','Kubernetes','Terraform','Linux','Nginx',
  'Git','GitHub','GitLab','CI/CD','Jest','Cypress','Playwright','Selenium',
  'Redux','Zustand','Webpack','Vite','Firebase','Supabase','Prisma','Mongoose',
  'SQL','NoSQL','Elasticsearch','Kafka','Socket.io','WebSockets','OAuth','JWT',
  'Figma','Jira','Agile','Scrum','Machine Learning','TensorFlow','PyTorch',
  'Pandas','NumPy','Scikit-learn','Power BI','Tableau',
];

const DEGREE_PATTERNS = [
  { re: /\bB\.?\s*Tech\b/i,                    norm: 'B.Tech' },
  { re: /\bB\.?\s*E\.?\b/i,                    norm: 'B.E.'   },
  { re: /\bB\.?\s*Sc\b/i,                      norm: 'B.Sc'   },
  { re: /\bBCA\b/i,                            norm: 'BCA'    },
  { re: /\bBBA\b/i,                            norm: 'BBA'    },
  { re: /\bM\.?\s*Tech\b/i,                    norm: 'M.Tech' },
  { re: /\bMCA\b/i,                            norm: 'MCA'    },
  { re: /\bMBA\b/i,                            norm: 'MBA'    },
  { re: /\bM\.?\s*Sc\b/i,                      norm: 'M.Sc'   },
  { re: /\bPh\.?\s*D\b/i,                      norm: 'Ph.D'   },
];

const BRANCH_PATTERNS = [
  { re: /computer\s*science|CSE|CS&E/i,                       norm: 'Computer Science Engineering'    },
  { re: /information\s*tech|ISE|IT\b/i,                       norm: 'Information Technology'          },
  { re: /electronics?(and\s*)?(commun|telecomm|electrical)|ECE/i, norm: 'Electronics & Communication' },
  { re: /electrical\s*(and\s*)?electronics|EEE/i,              norm: 'Electrical & Electronics'       },
  { re: /mechanical/i,                                         norm: 'Mechanical Engineering'         },
  { re: /civil/i,                                              norm: 'Civil Engineering'              },
  { re: /data\s*science/i,                                     norm: 'Data Science'                   },
  { re: /artificial\s*intelligence|AI\s*&?\s*ML/i,             norm: 'Artificial Intelligence & ML'  },
];

const CITIES = [
  'bangalore','bengaluru','mumbai','delhi','hyderabad','chennai','pune','kolkata',
  'ahmedabad','jaipur','kochi','noida','gurgaon','gurugram','indore','bhopal',
  'nagpur','lucknow','coimbatore','mysore','mysuru','vizag','visakhapatnam',
  'chandigarh','patna',
];

async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  return buffer.toString('utf8');
}

function parseResumeText(text) {
  const lines     = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const textLower = text.toLowerCase();

  // ── Name ──────────────────────────────────────────────────────────────────
  let name = '';
  const nameREs = [
    /^([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})$/,
    /^([A-Z]{2,}(?: [A-Z]{2,})+)$/,
  ];
  for (const line of lines.slice(0, 10)) {
    if (line.length < 4 || line.length > 60) continue;
    if (/[0-9@|\\/+]/.test(line)) continue;
    if (/resume|curriculum|vitae|profile|objective|summary/i.test(line)) continue;
    for (const re of nameREs) {
      const m = line.match(re);
      if (m) { name = m[1].replace(/\s+/g, ' ').trim(); break; }
    }
    if (name) break;
  }

  // ── Phone ──────────────────────────────────────────────────────────────────
  let phone = '';
  const phoneREs = [
    /(?:\+91[\s-]?)?([6-9]\d{9})/,
    /\b(\+\d{1,3}[\s-]?\d{6,12})\b/,
  ];
  for (const re of phoneREs) {
    const m = text.match(re);
    if (m) { phone = m[0].replace(/\s/g, ''); break; }
  }

  // ── URLs ───────────────────────────────────────────────────────────────────
  const githubMatch   = text.match(/(?:github\.com\/)([\\w-]+)/i);
  const linkedinMatch = text.match(/(?:linkedin\.com\/in\/)([\\w-]+)/i);
  const portfolioMatch = text.match(/(?:portfolio|website|www)[:\s]+([https]*(?:www\.)?[\w-]+\.(?:com|dev|io|me|co|in|net)(?:\/[\w-/]*)?)/i);

  const githubUrl   = githubMatch   ? `https://github.com/${githubMatch[1]}`        : '';
  const linkedinUrl = linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : '';
  const portfolioUrl = portfolioMatch
    ? (portfolioMatch[1].startsWith('http') ? portfolioMatch[1] : 'https://' + portfolioMatch[1])
    : '';

  // ── Skills ─────────────────────────────────────────────────────────────────
  const skills = SKILLS_LIST.filter(sk => {
    const esc = sk.replace(/[.+]/g, '\\$&').replace(/\//g, '\\/');
    return new RegExp(`(?<![\\w])${esc}(?![\\w])`, 'i').test(text);
  });

  // ── CGPA ───────────────────────────────────────────────────────────────────
  let cgpa = '';
  const cgpaREs = [
    /(?:cgpa|gpa)[:\s]+([0-9]\.[0-9]{1,2})/i,
    /([0-9]\.[0-9]{1,2})\s*(?:\/\s*(?:10|4))?\s*(?:cgpa|gpa)/i,
    /(?:aggregate|percentage)[:\s]+([0-9]{2,3}(?:\.[0-9]{1,2})?)\s*%?/i,
  ];
  for (const re of cgpaREs) {
    const m = text.match(re);
    if (m) { cgpa = m[1]; break; }
  }

  // ── Graduation Year ─────────────────────────────────────────────────────────
  const yearMatches   = text.match(/\b(20[1-3][0-9])\b/g);
  const graduationYear = yearMatches
    ? Math.max(...yearMatches.map(Number)).toString()
    : '';

  // ── College ─────────────────────────────────────────────────────────────────
  let college = '';
  const collegeKw = ['university','institute','college','iit','nit','vtu','bits','iim','iiit','vit'];
  for (const line of lines) {
    if (collegeKw.some(k => line.toLowerCase().includes(k)) && line.length > 5 && line.length < 120) {
      college = line; break;
    }
  }

  // ── Degree / Branch ─────────────────────────────────────────────────────────
  let degree = 'B.E.';
  for (const { re, norm } of DEGREE_PATTERNS) {
    if (re.test(text)) { degree = norm; break; }
  }
  let branch = 'Computer Science Engineering';
  for (const { re, norm } of BRANCH_PATTERNS) {
    if (re.test(text)) { branch = norm; break; }
  }

  // ── City ────────────────────────────────────────────────────────────────────
  let city = '';
  for (const c of CITIES) {
    if (textLower.includes(c)) { city = c.charAt(0).toUpperCase() + c.slice(1); break; }
  }

  // Return fields mapped exactly to User schema columns
  return {
    name:           name         || undefined,
    phone:          phone        || undefined,
    city:           city         || undefined,
    college:        college      || undefined,
    degree:         degree       || undefined,
    branch:         branch       || undefined,
    graduationYear: graduationYear || undefined,
    cgpa:           cgpa         || undefined,
    skills:         skills.length ? skills : undefined,
    githubUrl:      githubUrl    || undefined,
    linkedinUrl:    linkedinUrl  || undefined,
    portfolioUrl:   portfolioUrl || undefined,
  };
}

// Returns flat fields ready to merge into User record
async function parseResume(buffer, mimetype) {
  try {
    const text   = await extractText(buffer, mimetype);
    const parsed = parseResumeText(text);
    logger.info(`Resume parsed: name="${parsed.name}", skills=${parsed.skills?.length ?? 0}`);
    return parsed;    // returns the fields object directly (or null on error)
  } catch (err) {
    logger.error('Resume parse error:', err);
    return null;
  }
}

module.exports = { parseResume };
