// server/jobs/queueManager.js
const cron   = require('node-cron');
const logger = require('../middleware/logger');

let Queue      = null;
let scrapeQueue = null;
let gmailQueue  = null;

async function initQueues() {
  try {
    Queue = require('bull');
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

    scrapeQueue = new Queue('scrape',     REDIS_URL);
    gmailQueue  = new Queue('gmail-sync', REDIS_URL);

    // Process job scraping
    scrapeQueue.process(1, async (job) => {
      const { runFullScrape } = require('../services/jobAggregator');
      logger.info('Bull: running full scrape job', job.id);
      return runFullScrape(job.data?.userProfile || {});
    });

    // Process gmail sync for a single user
    gmailQueue.process(5, async (job) => {
      const { syncGmailForUser } = require('../services/gmailService');
      logger.info(`Bull: gmail sync for user ${job.data.userId}`);
      return syncGmailForUser(job.data.userId);
    });

    scrapeQueue.on('failed', (job, err) => logger.error(`Scrape job ${job.id} failed: ${err.message}`));
    gmailQueue.on('failed',  (job, err) => logger.error(`Gmail job ${job.id} failed: ${err.message}`));

    // Schedule scrape every 30 minutes via Bull
    await scrapeQueue.add({}, { repeat: { cron: '*/30 * * * *' }, jobId: 'auto-scrape' });

    logger.info('✅ Bull queues initialized');
    return { scrapeQueue, gmailQueue };
  } catch (err) {
    logger.warn(`⚠️  Bull unavailable (${err.message}), falling back to node-cron`);
    initCronFallback();
    return null;
  }
}

function initCronFallback() {
  // Run a scrape every 30 minutes even without Redis
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { runFullScrape } = require('../services/jobAggregator');
      logger.info('Cron: running full scrape');
      await runFullScrape({});
    } catch (err) {
      logger.error('Cron scrape failed:', err.message);
    }
  });

  // Sync all Gmail-connected users every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    try {
      const prisma = require('../lib/prisma');
      const { syncGmailForUser } = require('../services/gmailService');
      const users = await prisma.user.findMany({ where: { gmailConnected: true }, select: { id: true } });
      logger.info(`Cron: syncing Gmail for ${users.length} users`);
      for (const u of users) {
        await syncGmailForUser(u.id).catch(e => logger.warn(`Gmail sync error for ${u.id}: ${e.message}`));
      }
    } catch (err) {
      logger.error('Cron gmail sync failed:', err.message);
    }
  });

  logger.info('✅ node-cron fallback scheduled');
}

async function addGmailSyncJob(userId) {
  if (gmailQueue) {
    await gmailQueue.add({ userId }, { attempts: 3, backoff: 5000, removeOnComplete: true });
  } else {
    const { syncGmailForUser } = require('../services/gmailService');
    syncGmailForUser(userId).catch(e => logger.warn(`Inline gmail sync failed: ${e.message}`));
  }
}

module.exports = { initQueues, addGmailSyncJob };
