// server/tests/scrapers.test.js
// Pure unit tests — no network calls, no DB. Tests normalisation logic only.

describe('Job type classifier', () => {
  function classifyJobType(title = '') {
    const t = title.toLowerCase();
    if (/fullstack|full.?stack|mern|mean|backend|node\.?js|express/.test(t)) return 'fullstack';
    if (/frontend|react|vue|angular|ui\b|next\.?js/.test(t))                 return 'frontend';
    return 'other';
  }

  test('classifies frontend roles', () => {
    expect(classifyJobType('React Developer')).toBe('frontend');
    expect(classifyJobType('Frontend Engineer')).toBe('frontend');
    expect(classifyJobType('Next.js Developer')).toBe('frontend');
    expect(classifyJobType('Vue.js Engineer')).toBe('frontend');
  });

  test('classifies fullstack roles', () => {
    expect(classifyJobType('Full Stack Developer')).toBe('fullstack');
    expect(classifyJobType('MERN Stack Engineer')).toBe('fullstack');
    expect(classifyJobType('Node.js Backend Developer')).toBe('fullstack');
    expect(classifyJobType('Express.js Engineer')).toBe('fullstack');
  });

  test('returns other for unclear roles', () => {
    expect(classifyJobType('Data Scientist')).toBe('other');
    expect(classifyJobType('QA Engineer')).toBe('other');
    expect(classifyJobType('DevOps Engineer')).toBe('other');
  });
});

describe('Pagination NaN guard', () => {
  function parsePagination(query) {
    return {
      page:  Math.max(1,   parseInt(query.page,  10) || 1),
      limit: Math.min(100, parseInt(query.limit, 10) || 30),
    };
  }

  test('handles NaN inputs', () => {
    expect(parsePagination({ page: 'NaN', limit: 'abc' })).toEqual({ page: 1, limit: 30 });
    expect(parsePagination({ page: undefined, limit: undefined })).toEqual({ page: 1, limit: 30 });
  });

  test('handles valid inputs', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10 });
  });

  test('clamps limit at 100', () => {
    expect(parsePagination({ page: '1', limit: '500' })).toEqual({ page: 1, limit: 100 });
  });
});
