// server/services/socketService.js
const logger = require('../middleware/logger');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Client authenticates with userId after Google OAuth
    socket.on('auth', ({ userId }) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
      socket.userId = userId;
      logger.info(`Socket ${socket.id} joined room user:${userId}`);
      socket.emit('auth:ok', { message: 'Real-time connected' });
    });

    // Client requests live job count
    socket.on('jobs:subscribe', () => {
      socket.join('jobs:live');
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

// Broadcast new jobs to all subscribed clients
function broadcastNewJobs(jobs) {
  if (!global.io) return;
  global.io.to('jobs:live').emit('jobs:new', { jobs, count: jobs.length });
}

// Push a notification to a specific user
function pushNotification(userId, notification) {
  if (!global.io) return;
  global.io.to(`user:${userId}`).emit('notification', notification);
}

module.exports = { setupSocketHandlers, broadcastNewJobs, pushNotification };
