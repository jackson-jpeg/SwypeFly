import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Supabase chain mock infrastructure ────────────────────────────────

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
    const result = {
      data: mockQueryResult.data,
      error: mockQueryResult.error,
      count: mockQueryResult.count ?? 0,
    };
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

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

import handler from '../../api/alerts';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
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

// ─── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/alerts?action=list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };
  });

  it('rejects non-GET methods', async () => {
    const req = makeReq({ method: 'POST', query: { action: 'list' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects unauthenticated requests', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);
    const req = makeReq({ query: { action: 'list' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns alerts list for authenticated user', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });
    mockQueryResult = {
      data: [
        {
          id: 'alert-1',
          destination_id: 'dest-1',
          target_price: 300,
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          triggered_at: null,
          triggered_price: null,
        },
        {
          id: 'alert-2',
          destination_id: 'dest-2',
          target_price: 500,
          is_active: false,
          created_at: '2026-01-02T00:00:00Z',
          triggered_at: '2026-01-10T00:00:00Z',
          triggered_price: 450,
        },
      ],
      error: null,
      count: 2,
    };

    const req = makeReq({
      method: 'GET',
      query: { action: 'list' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.alerts).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.alerts[0]).toEqual(
      expect.objectContaining({
        id: 'alert-1',
        destinationId: 'dest-1',
        targetPrice: 300,
        isActive: true,
      }),
    );
    expect(body.alerts[1]).toEqual(
      expect.objectContaining({
        id: 'alert-2',
        triggeredAt: '2026-01-10T00:00:00Z',
        triggeredPrice: 450,
      }),
    );
  });

  it('returns empty list when no alerts', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });
    mockQueryResult = { data: [], error: null, count: 0 };

    const req = makeReq({
      method: 'GET',
      query: { action: 'list' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.alerts).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('returns 500 on database error', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });
    mockQueryResult = { data: null, error: new Error('DB down'), count: 0 };

    const req = makeReq({
      method: 'GET',
      query: { action: 'list' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('DELETE /api/alerts?action=delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };
  });

  it('rejects GET method', async () => {
    const req = makeReq({ method: 'GET', query: { action: 'delete' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects unauthenticated requests', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);
    const req = makeReq({
      method: 'DELETE',
      query: { action: 'delete' },
      body: { alertId: 'alert-1' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects missing alertId in body', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });
    const req = makeReq({
      method: 'DELETE',
      query: { action: 'delete' },
      headers: { authorization: 'Bearer valid-token' },
      body: {},
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when alert not found', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });
    mockQueryResult = { data: null, error: new Error('Not found') };

    const req = makeReq({
      method: 'DELETE',
      query: { action: 'delete' },
      headers: { authorization: 'Bearer valid-token' },
      body: { alertId: 'nonexistent' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user does not own the alert', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });
    mockQueryResult = { data: { user_id: 'other-user' }, error: null };

    const req = makeReq({
      method: 'DELETE',
      query: { action: 'delete' },
      headers: { authorization: 'Bearer valid-token' },
      body: { alertId: 'alert-1' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('deletes alert owned by the user', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        // Fetch alert to verify ownership
        mockQueryResult = { data: { user_id: 'user-1' }, error: null };
      } else {
        // Delete succeeds
        mockQueryResult = { data: null, error: null };
      }
      return chain;
    });

    const req = makeReq({
      method: 'DELETE',
      query: { action: 'delete' },
      headers: { authorization: 'Bearer valid-token' },
      body: { alertId: 'alert-1' },
    });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({ deleted: true, alertId: 'alert-1' });
  });

  it('allows POST method for delete action', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        mockQueryResult = { data: { user_id: 'user-1' }, error: null };
      } else {
        mockQueryResult = { data: null, error: null };
      }
      return chain;
    });

    const req = makeReq({
      method: 'POST',
      query: { action: 'delete' },
      headers: { authorization: 'Bearer valid-token' },
      body: { alertId: 'alert-1' },
    });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({ deleted: true, alertId: 'alert-1' });
  });
});

describe('/api/alerts — invalid action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for unknown action', async () => {
    const req = makeReq({ query: { action: 'bogus' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for missing action', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('GET /api/alerts?action=check (cron)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };
  });

  it('rejects unauthorized cron requests', async () => {
    const req = makeReq({
      query: { action: 'check' },
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns checked/triggered counts on success with no alerts', async () => {
    mockQueryResult = { data: [], error: null };

    const req = makeReq({
      query: { action: 'check' },
      headers: { authorization: 'Bearer test-secret' },
    });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({ checked: 0, triggered: 0, total: 0 });
  });

  it('checks active alerts and processes them', async () => {
    // First call: get active alerts batch
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        // Active alerts batch - return one alert
        mockQueryResult = {
          data: [{
            id: 'alert-1',
            destination_id: 'dest-1',
            target_price: 500,
            email: null,
          }],
          error: null,
        };
      } else if (callCount === 2) {
        // Destination lookup
        mockQueryResult = {
          data: { iata_code: 'BCN', flight_price: 400 },
          error: null,
        };
      } else if (callCount === 3) {
        // Cached prices lookup - price below target
        mockQueryResult = {
          data: [{ price: 300, source: 'travelpayouts' }],
          error: null,
        };
      } else if (callCount === 4) {
        // ai_cache for price history
        mockQueryResult = { data: [], error: null };
      } else if (callCount === 5) {
        // Update alert as triggered
        mockQueryResult = { data: null, error: null };
      }
      return chain;
    });

    const req = makeReq({
      query: { action: 'check' },
      headers: { authorization: 'Bearer test-secret' },
    });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.checked).toBe(1);
    expect(body.triggered).toBe(1);
    expect(body.total).toBe(1);
  });
});
