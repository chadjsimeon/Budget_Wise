import { describe, test, expect } from 'vitest';
import { generateResetToken, hashResetToken, resetLinkBase } from './resetToken';

describe('reset tokens', () => {
  test('the stored hash is stable and is not the token itself', () => {
    // Given: a freshly generated token
    const token = generateResetToken();

    // When: it is hashed for storage
    const hash = hashResetToken(token);

    // Then: the same token always finds the same row, and the row can't be used as a link
    expect(hash).toBe(hashResetToken(token));
    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(generateResetToken())).not.toBe(hash);
  });
});

describe('reset link base URL', () => {
  const forgedOrigin = 'https://evil.example';

  test('uses APP_URL and ignores the request host', () => {
    expect(resetLinkBase({ NODE_ENV: 'production', APP_URL: 'https://wantnot.app/' }, forgedOrigin))
      .toBe('https://wantnot.app');
  });

  test('falls back to the Railway domain when APP_URL is unset', () => {
    expect(resetLinkBase({ NODE_ENV: 'production', RAILWAY_PUBLIC_DOMAIN: 'app.up.railway.app' }, forgedOrigin))
      .toBe('https://app.up.railway.app');
  });

  test('never trusts the request host in production', () => {
    // Given: production with no configured base URL
    // When: a request arrives with a forged Host header
    // Then: there is no base URL, so no email goes out
    expect(resetLinkBase({ NODE_ENV: 'production' }, forgedOrigin)).toBeUndefined();
    expect(resetLinkBase({ NODE_ENV: 'production', APP_URL: '  ' }, forgedOrigin)).toBeUndefined();
  });

  test('uses the request host in development', () => {
    expect(resetLinkBase({ NODE_ENV: 'development' }, 'http://localhost:5050'))
      .toBe('http://localhost:5050');
  });
});
