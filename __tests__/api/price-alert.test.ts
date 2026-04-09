import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Mock setup ───────────────────────────────────────────────────────────────

let mockQueryResult: { data: unknown; error: unknown; count?: number } = {
  data: [],
  error: null,
  count: 0,
};

const createChain = () => {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'upsert', 'update', 'delete',
    'eq', 'neq', 'in', 'contains', 'ilike',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'range',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.single = jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: Array.isArray(mockQueryResult.data)
        ? mockQueryResult.data[0] ?? null
        : mockQueryResult.data,
      error: mockQueryResult.error,
    }),
  );
  (chain as any).then = jest.fn().mockImplementation((resolve: any) => {
    const result = { data: mockQueryResult.data, error: mockQueryResult.error, count: mockQueryResult.count ?? 0 };
    if (resolve) return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  });
  return chain;
};

let mockChain = createChain();
const mockFrom = jest.fn().mockReturnValue(mockChain);

jest.mock('../../services/supabaseServer', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  TABLES: {
    destinations: 'destinations',
    cachedPrices: 'cached_prices',
    aiCache: 'ai_cache',
    priceAlerts: 'price_alerts',
  },
}));

const mockVerifyClerkToken = jest.fn();
jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 })),
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../utils/env', () => ({
  env: { CRON_SECRET: 'test-secret', BOOKING_MARKUP_PERCENT: 0, FRONTEND_URL: 'http://localhost:8081' },
}));

import handler from '../../api/price-alert';

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
  return res as unknown as VercelResponse & { status: jest.Mock; json: jest.Mock };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/price-alert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };
  });

  it('rejects non-POST methods', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects invalid body (missing destination_id)', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    const req = makeReq({
      headers: { authorization: 'Bearer token' },
      body: { target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid body (negative target_price)', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    const req = makeReq({
      headers: { authorization: 'Bearer token' },
      body: { destination_id: 'dest-1', target_price: -50 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('requires email for guest users', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce(null);
    const req = makeReq({
      body: { destination_id: 'dest-1', target_price: 200 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toContain('Email required');
  });

  it('creates a new alert for authenticated user', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        // Existing alert query - none found
        mockQueryResult = { data: [], error: null };
      } else {
        // Insert
        mockQueryResult = {
          data: { id: 'alert-1', destination_id: 'dest-1', target_price: 300, user_id: 'user-1' },
          error: null,
        };
      }
      return chain;
    });

    const req = makeReq({
      headers: { authorization: 'Bearer token' },
      body: { destination_id: 'dest-1', target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveProperty('created', true);
  });

  it('updates existing alert instead of creating duplicate', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        // Existing alert found
        mockQueryResult = {
          data: [{ id: 'existing-alert', target_price: 400, user_id: 'user-1' }],
          error: null,
        };
      } else {
        // Update
        mockQueryResult = {
          data: { id: 'existing-alert', target_price: 250, user_id: 'user-1' },
          error: null,
        };
      }
      return chain;
    });

    const req = makeReq({
      headers: { authorization: 'Bearer token' },
      body: { destination_id: 'dest-1', target_price: 250 },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveProperty('updated', true);
  });

  it('allows guest with email to create alert', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce(null);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        mockQueryResult = { data: [], error: null };
      } else {
        mockQueryResult = {
          data: { id: 'alert-2', destination_id: 'dest-1', target_price: 200, user_id: 'guest', email: 'test@example.com' },
          error: null,
        };
      }
      return chain;
    });

    const req = makeReq({
      body: { destination_id: 'dest-1', target_price: 200, email: 'test@example.com' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveProperty('created', true);
  });

  it('returns 500 on database error', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    mockFrom.mockImplementation(() => {
      const chain = createChain();
      mockQueryResult = { data: null, error: { message: 'DB error' } };
      return chain;
    });

    const req = makeReq({
      headers: { authorization: 'Bearer token' },
      body: { destination_id: 'dest-1', target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
