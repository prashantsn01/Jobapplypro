// server/tests/applications.test.js
// These are integration tests that require a real test database.
// Run: TEST_DATABASE_URL=... npm test

const request = require('supertest');

// Mock passport so we don't need real OAuth in tests
jest.mock('../middleware/passport', () => {});
jest.mock('../services/jobAggregator', () => ({
  runFullScrape: jest.fn().mockResolvedValue({ saved: 0, fresh: 0 }),
  getJobsFromDB: jest.fn().mockResolvedValue({ jobs: [], total: 0, page: 1, pages: 0 }),
}));
jest.mock('../services/gmailService', () => ({
  syncGmailForUser: jest.fn().mockResolvedValue({ matched: 0, fetched: 0 }),
}));
jest.mock('../jobs/queueManager', () => ({
  initQueues:      jest.fn().mockResolvedValue(null),
  addGmailSyncJob: jest.fn(),
}));

describe('Applications Route', () => {
  test('GET /api/applications returns 401 when not authenticated', async () => {
    const { app } = require('../index');
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /health returns 200', async () => {
    const { app } = require('../index');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});

describe('Pagination helpers', () => {
  function parsePagination(query) {
    const page  = Math.max(1,   parseInt(query.page,  10) || 1);
    const limit = Math.min(100, parseInt(query.limit, 10) || 50);
    return { page, limit };
  }

  test('defaults to page 1 limit 50', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 50 });
  });

  test('guards against NaN page/limit', () => {
    expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 50 });
  });

  test('clamps limit to 100', () => {
    expect(parsePagination({ page: '2', limit: '9999' })).toEqual({ page: 2, limit: 100 });
  });

  test('clamps page to minimum 1', () => {
    expect(parsePagination({ page: '-5', limit: '20' })).toEqual({ page: 1, limit: 20 });
  });
});
