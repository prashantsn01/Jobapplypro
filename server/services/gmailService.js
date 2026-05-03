// server/services/gmailService.js
const { google }  = require('googleapis');
const prisma      = require('../lib/prisma');
const { decrypt } = require('./cryptoService');
const logger      = require('../middleware/logger');

// ── OAuth client factory ────────────────────────────────────────────────────
async function getGmailClient(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const refreshToken = decrypt(user.refreshToken);
  if (!refreshToken) throw new Error('No valid refresh token. Please reconnect Gmail.');

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Explicitly refresh to get a new access token
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// ── Email classification ────────────────────────────────────────────────────
function classifyEmail(subject = '', snippet = '') {
  const text = (subject + ' ' + snippet).toLowerCase();

  const offerKw = [
    'offer letter', 'offer of employment', 'pleased to offer',
    'we are delighted to offer', 'joining date', 'onboarding details',
    'welcome aboard', 'compensation package', 'employment offer'
  ];
  const interviewKw = [
    'interview scheduled', 'schedule your interview', 'interview invitation',
    'invite you for an interview', 'technical interview', 'coding assessment',
    'coding round', 'technical round', 'hr round', 'shortlisted for',
    'next round', 'assessment link', 'hackerrank', 'codility', 'hackerearth',
    'availability for interview', 'slot confirmation'
  ];
  const rejectionKw = [
    'not moving forward', 'not selected', 'unfortunately', 'regret to inform',
    'not a match', 'we have decided', 'other candidates', 'position has been filled',
    'no longer considering', 'not shortlisted', 'not progressing'
  ];

  if (offerKw.some(k => text.includes(k)))      return 'offer';
  if (interviewKw.some(k => text.includes(k)))  return 'interview';
  if (rejectionKw.some(k => text.includes(k)))  return 'rejection';
  return 'other';
}

// ── Strict domain matching ──────────────────────────────────────────────────
// The old code used string.includes() which was too fuzzy:
// e.g. company "apple" would match "snapple.com"
// New approach: tokenize both and require exact token match at domain root.
function domainMatchesCompany(senderEmail = '', companyName = '') {
  if (!senderEmail || !companyName) return false;

  // Extract domain from "Name <email@domain.com>" or "email@domain.com"
  const emailMatch = senderEmail.match(/<([^>]+)>/) || senderEmail.match(/\S+@\S+/);
  if (!emailMatch) return false;
  const emailAddr = emailMatch[1] || emailMatch[0];
  const atIdx     = emailAddr.lastIndexOf('@');
  if (atIdx === -1) return false;
  const domain = emailAddr.slice(atIdx + 1).toLowerCase().trim();

  // Ignore generic email providers
  const GENERIC_DOMAINS = new Set([
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'noreply.com', 'mailer.com', 'sendgrid.net', 'mailchimp.com',
    'amazonses.com', 'bounce.com', 'notifications.com',
  ]);
  if (GENERIC_DOMAINS.has(domain)) return false;

  // Root domain (strip TLD and subdomains for comparison)
  const domainRoot = domain.split('.')[0];

  // Normalise company name into tokens: "Google India Pvt Ltd" → ["google","india","pvt","ltd"]
  const companyTokens = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));

  if (!companyTokens.length) return false;

  // The primary company identifier is the first substantive token
  const primaryToken = companyTokens[0];

  // Match if domain root equals the primary company token exactly (≥4 chars)
  // OR if domain contains the full primary token and token is ≥5 chars
  // Exact match: primaryToken === domainRoot (e.g. "google" === "google")
  if (primaryToken.length >= 4 && domainRoot === primaryToken) return true;

  // Prefix match: domainRoot starts with primaryToken
  // e.g. "tataconsultancy".startsWith("tata") → true
  // IMPORTANT: must be startsWith, NOT includes — "snapple".startsWith("apple") → false ✅
  if (primaryToken.length >= 4 && domainRoot.startsWith(primaryToken)) return true;

  return false;
}

const STOPWORDS = new Set(['pvt','ltd','inc','llc','corp','company','technologies',
  'solutions','services','software','systems','tech','india','global','group','digital']);

// ── Main sync function ──────────────────────────────────────────────────────
async function syncGmailForUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.gmailConnected || !user.refreshToken) {
    logger.warn(`Gmail sync skipped for ${userId}: not connected`);
    return { matched: 0, fetched: 0 };
  }

  // Only look at applications that haven't got a reply yet
  const applications = await prisma.application.findMany({
    where:  { userId, replyDetected: false },
    select: { id: true, company: true, platform: true },
  });
  if (!applications.length) return { matched: 0, fetched: 0 };

  // Build Gmail search query from company names
  const companyNames = [...new Set(applications.map(a => a.company))].slice(0, 15);
  // Search for emails that mention any company name in subject or from field
  const gmailQuery = companyNames
    .map(c => `"${c.replace(/"/g, '')}"`)
    .join(' OR ');

  let gmail;
  try {
    gmail = await getGmailClient(user);
  } catch (err) {
    logger.error(`Gmail client init failed for ${userId}: ${err.message}`);
    await prisma.emailSync.upsert({
      where:  { userId },
      update: { status: 'error', errorMsg: err.message },
      create: { userId, status: 'error', errorMsg: err.message },
    });
    throw err;
  }

  await prisma.emailSync.upsert({
    where:  { userId },
    update: { status: 'running', errorMsg: null },
    create: { userId, status: 'running' },
  });

  const listRes = await gmail.users.messages.list({
    userId:     'me',
    q:          `(${gmailQuery}) newer_than:60d`,
    maxResults: 100,
  });

  const messages = listRes.data.messages || [];
  logger.info(`Gmail sync for ${user.email}: ${messages.length} candidate messages`);

  let matched  = 0;
  const notifications = [];

  for (const msg of messages) {
    try {
      const detail  = await gmail.users.messages.get({
        userId,
        id:     msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = detail.data.payload?.headers || [];
      const from    = headers.find(h => h.name === 'From')?.value    || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const snippet = detail.data.snippet || '';
      const dateStr = headers.find(h => h.name === 'Date')?.value;

      const replyType = classifyEmail(subject, snippet);

      for (const app of applications) {
        if (domainMatchesCompany(from, app.company)) {
          const newStatus = replyType === 'interview' ? 'interview'
            : replyType === 'offer'                  ? 'offer'
            : replyType === 'rejection'              ? 'rejected'
            : undefined;

          await prisma.application.update({
            where: { id: app.id },
            data: {
              replyDetected:   true,
              replyType,
              replyEmailId:    msg.id,
              replySnippet:    subject.slice(0, 120),
              replyDetectedAt: dateStr ? new Date(dateStr) : new Date(),
              ...(newStatus ? { status: newStatus } : {}),
            },
          });

          const emoji = replyType === 'offer'      ? '🏆'
            : replyType === 'interview'            ? '🎉'
            : replyType === 'rejection'            ? '📩'
            : '📬';

          notifications.push({
            userId,
            type:    'gmail_reply',
            title:   `${app.company} replied!`,
            message: replyType === 'interview' ? `${emoji} Interview invite from ${app.company}!`
              : replyType === 'offer'          ? `${emoji} Offer letter from ${app.company}!`
              : replyType === 'rejection'      ? `${emoji} Update from ${app.company}: not selected`
              : `${emoji} Email from ${app.company}`,
            metadata: { applicationId: app.id, replyType, subject: subject.slice(0, 100) },
          });

          matched++;
          break;  // don't double-match the same email to multiple apps
        }
      }
    } catch (err) {
      logger.warn(`Error processing message ${msg.id}: ${err.message}`);
    }
  }

  if (notifications.length) {
    await prisma.notification.createMany({ data: notifications });
  }

  await prisma.emailSync.upsert({
    where:  { userId },
    update: {
      lastSyncedAt: new Date(),
      totalFetched: messages.length,
      totalMatched: matched,
      status:       'done',
      errorMsg:     null,
    },
    create: { userId, totalFetched: messages.length, totalMatched: matched, status: 'done' },
  });

  if (global.io) {
    if (notifications.length) {
      notifications.forEach(n => global.io.to(`user:${userId}`).emit('notification', n));
    }
    global.io.to(`user:${userId}`).emit('gmail:synced', { matched, fetched: messages.length });
  }

  logger.info(`Gmail sync complete for ${user.email}: ${matched} matched / ${messages.length} fetched`);
  return { matched, fetched: messages.length };
}

module.exports = { syncGmailForUser, classifyEmail, domainMatchesCompany };
