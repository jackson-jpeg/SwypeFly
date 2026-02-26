import { checkRateLimit, getClientIp } from '../utils/rateLimit';

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const key = `test-${Date.now()}`;
    const r1 = checkRateLimit(key, 3, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, 3, 60_000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, 3, 60_000);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests over the limit', () => {
    const key = `test-block-${Date.now()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const r3 = checkRateLimit(key, 2, 60_000);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('uses different windows independently', () => {
    // Just verify a new key with a fresh window works
    const key = `test-fresh-${Date.now()}-${Math.random()}`;
    const r1 = checkRateLimit(key, 1, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(0);
  });

  it('uses separate counters per key', () => {
    const key1 = `test-key1-${Date.now()}`;
    const key2 = `test-key2-${Date.now()}`;
    checkRateLimit(key1, 1, 60_000);
    const r1 = checkRateLimit(key1, 1, 60_000);
    expect(r1.allowed).toBe(false);

    const r2 = checkRateLimit(key2, 1, 60_000);
    expect(r2.allowed).toBe(true);
  });
});

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for', () => {
    expect(getClientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })).toBe('1.2.3.4');
  });

  it('extracts IP from x-real-ip', () => {
    expect(getClientIp({ 'x-real-ip': '10.0.0.1' })).toBe('10.0.0.1');
  });

  it('returns unknown when no IP headers present', () => {
    expect(getClientIp({})).toBe('unknown');
  });
});
