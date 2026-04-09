import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resetRateLimits } from '../../utils/rateLimit';

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/diagnostics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    body: {},
    query: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
  });

  it('rejects non-POST methods (405)', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: 'METHOD_NOT_ALLOWED' }),
      }),
    );
  });

  it('rejects missing required fields (400)', async () => {
    const req = makeReq({
      method: 'POST',
      body: { appVersion: '1.0.0' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
    );
  });

  it('rejects when type is missing but payload is present', async () => {
    const req = makeReq({
      method: 'POST',
      body: { payload: 'crash data' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects when payload is missing but type is present', async () => {
    const req = makeReq({
      method: 'POST',
      body: { type: 'crash' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('successfully receives diagnostic report (200)', async () => {
    const req = makeReq({
      method: 'POST',
      body: {
        type: 'crash',
        appVersion: '2.1.0',
        buildNumber: '42',
        osVersion: '17.4',
        deviceModel: 'iPhone 15 Pro',
        payload: 'EXC_BAD_ACCESS at 0x00000001',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('accepts minimal required fields (type + payload only)', async () => {
    const req = makeReq({
      method: 'POST',
      body: {
        type: 'hang',
        payload: { duration: 5000 },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('rate limiting works (429)', async () => {
    // Exhaust the rate limit (20 per minute per IP)
    for (let i = 0; i < 20; i++) {
      const req = makeReq({
        method: 'POST',
        headers: { 'x-real-ip': '10.0.0.1' },
        body: { type: 'crash', payload: `report-${i}` },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    }

    // 21st request should be rate limited
    const req = makeReq({
      method: 'POST',
      headers: { 'x-real-ip': '10.0.0.1' },
      body: { type: 'crash', payload: 'one-too-many' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: 'RATE_LIMITED' }),
      }),
    );
  });

  it('handles errors gracefully (500)', async () => {
    // Cause an error by making req.body a getter that throws
    const req = makeReq({
      method: 'POST',
      headers: { 'x-real-ip': '10.0.0.2' },
    });
    // Override body to throw on destructuring
    Object.defineProperty(req, 'body', {
      get() {
        throw new Error('Unexpected parsing error');
      },
    });

    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
    );
  });
});
