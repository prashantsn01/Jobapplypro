// server/tests/gmail.test.js
const { classifyEmail, domainMatchesCompany } = require('../services/gmailService');

describe('classifyEmail()', () => {
  test('detects offer letters', () => {
    expect(classifyEmail('Offer Letter from Acme Corp', '')).toBe('offer');
    expect(classifyEmail('Your Offer of Employment', '')).toBe('offer');
    expect(classifyEmail('Welcome aboard!', 'joining date is Monday')).toBe('offer');
  });

  test('detects interview invites', () => {
    expect(classifyEmail('Interview Scheduled for Wednesday', '')).toBe('interview');
    expect(classifyEmail('Technical Round Invite', 'shortlisted for next round')).toBe('interview');
    expect(classifyEmail('HackerRank Assessment', '')).toBe('interview');
    expect(classifyEmail('Coding Round', 'codility test link')).toBe('interview');
  });

  test('detects rejections', () => {
    expect(classifyEmail('Unfortunately...', 'we are not moving forward')).toBe('rejection');
    expect(classifyEmail('Application Update', 'not a match at this time')).toBe('rejection');
    expect(classifyEmail('Regret to inform you', '')).toBe('rejection');
  });

  test('returns other for unmatched', () => {
    expect(classifyEmail('Your application was received', '')).toBe('other');
    expect(classifyEmail('Team newsletter', '')).toBe('other');
  });
});

describe('domainMatchesCompany()', () => {
  test('matches company to its own domain', () => {
    expect(domainMatchesCompany('hr@google.com', 'Google')).toBe(true);
    expect(domainMatchesCompany('recruiter@amazon.com', 'Amazon')).toBe(true);
    expect(domainMatchesCompany('careers@flipkart.com', 'Flipkart')).toBe(true);
    expect(domainMatchesCompany('no-reply@razorpay.com', 'Razorpay')).toBe(true);
  });

  test('does NOT match generic/unrelated domains', () => {
    // The old false-positive: "apple" should NOT match "snapple.com"
    expect(domainMatchesCompany('info@snapple.com', 'Apple')).toBe(false);
    expect(domainMatchesCompany('hr@gmail.com', 'Acme Corp')).toBe(false);
    expect(domainMatchesCompany('noreply@sendgrid.net', 'Infosys')).toBe(false);
  });

  test('handles formatted email addresses', () => {
    expect(domainMatchesCompany('Google Careers <jobs@google.com>', 'Google')).toBe(true);
  });

  test('handles missing/empty inputs gracefully', () => {
    expect(domainMatchesCompany('', 'Google')).toBe(false);
    expect(domainMatchesCompany('hr@google.com', '')).toBe(false);
    expect(domainMatchesCompany(null, 'Google')).toBe(false);
  });

  test('handles company with stopwords', () => {
    // "Tata Consultancy Services" → primary token "tata"
    expect(domainMatchesCompany('careers@tcs.com', 'Tata Consultancy Services')).toBe(false); // "tcs" ≠ "tata"
    expect(domainMatchesCompany('careers@tataconsultancy.com', 'Tata Consultancy Services')).toBe(true);
  });
});
