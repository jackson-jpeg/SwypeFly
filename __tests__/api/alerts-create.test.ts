import type { VercelRequest, VercelResponse } from '@vercel/node';

// Track what supabase mock returns per call
let mockQueryResult: { data: unknown; error: unknown; count?: number } = {
  data: [],
  error: null,
  count: 0,
};

// We need a configurable mock chain for supabase
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
  // single() and maybeSingle() resolve immediately
  chain.single = jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: Array.isArray(mockQueryResult.data)
        ? mockQueryResult.data[0] ?? null
        : mockQueryResult.data,
      error: mockQueryResult.error,
    }),
  );
  // The chain itself is thenable for queries without .single()
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
  env: { CRON_SECRET: 'test-secret', BOOKING_MARKUP_PERCENT: 0 },
}));

import handler from '../../api/alerts';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    body: {},
    query: { action: 'create' },
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

describe('POST /api/alerts?action=create', () => {
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

  it('rejects requests without auth or email', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);
    const req = makeReq({
      headers: {},
      body: { destination_id: 'dest-1', target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid body (missing destination_id)', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });
    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid body (negative target_price)', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });
    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { destination_id: 'dest-1', target_price: -50 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a new alert for authenticated user', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });

    // First call: list existing alerts -> none found
    // Second call: insert new alert
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        // Existing alert query - return empty
        mockQueryResult = { data: [], error: null };
      } else {
        // Insert - return created alert
        mockQueryResult = {
          data: { id: 'alert-1', destination_id: 'dest-1', target_price: 300, user_id: 'user-123' },
          error: null,
        };
      }
      return chain;
    });

    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { destination_id: 'dest-1', target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created: true }));
  });

  it('updates existing active alert instead of creating duplicate', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        // Existing alert query - return one alert
        mockQueryResult = {
          data: [{ id: 'existing-alert', target_price: 400, user_id: 'user-123' }],
          error: null,
        };
      } else {
        // Update - return updated alert
        mockQueryResult = {
          data: { id: 'existing-alert', target_price: 250, user_id: 'user-123' },
          error: null,
        };
      }
      return chain;
    });

    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { destination_id: 'dest-1', target_price: 250 },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ updated: true }));
  });

  it('allows guest with email to create alert', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);

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
      headers: {},
      body: { destination_id: 'dest-1', target_price: 200, email: 'test@example.com' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created: true }));
  });
});
