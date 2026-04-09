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
    priceCalendar: 'price_calendar',
  },
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 })),
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../utils/env', () => ({
  env: {
    BOOKING_MARKUP_PERCENT: 3,
    FRONTEND_URL: 'http://localhost:8081',
  },
}));

import handler from '../../api/top-deals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
}

function makeDealRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deal-1',
    destination_id: 'dest-1',
    city: 'Barcelona',
    country: 'Spain',
    destination_iata: 'BCN',
    origin: 'JFK',
    price: 287,
    deal_score: 85,
    deal_tier: 'great',
    savings_percent: 30,
    usual_price: 410,
    is_nonstop: true,
    airline: 'Delta',
    departure_date: '2026-05-15',
    return_date: '2026-05-22',
    trip_days: 7,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/top-deals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };
  });

  it('rejects non-GET methods', async () => {
    const req = makeReq({ method: 'POST' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns deals with correct structure', async () => {
    mockQueryResult = {
      data: [makeDealRow()],
      error: null,
    };

    const req = makeReq({ method: 'GET', query: { limit: '5' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('deals');
    expect(body).toHaveProperty('total', 1);
    expect(body).toHaveProperty('generatedAt');
    expect(body.deals[0]).toHaveProperty('city', 'Barcelona');
    expect(body.deals[0]).toHaveProperty('country', 'Spain');
    expect(body.deals[0]).toHaveProperty('iata', 'BCN');
    expect(body.deals[0]).toHaveProperty('dealScore', 85);
    expect(body.deals[0]).toHaveProperty('dealTier', 'great');
    // Price should have 3% markup: 287 * 1.03 = 296 (rounded)
    expect(body.deals[0].price).toBe(296);
  });

  it('deduplicates by destination', async () => {
    mockQueryResult = {
      data: [
        makeDealRow({ destination_iata: 'BCN', deal_score: 90 }),
        makeDealRow({ id: 'deal-2', destination_iata: 'BCN', deal_score: 80, origin: 'LAX' }),
        makeDealRow({ id: 'deal-3', destination_iata: 'CDG', city: 'Paris', deal_score: 75 }),
      ],
      error: null,
    };

    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    // BCN appears twice but should be deduplicated
    expect(body.deals).toHaveLength(2);
  });

  it('respects limit parameter', async () => {
    const deals = [];
    for (let i = 0; i < 20; i++) {
      deals.push(makeDealRow({
        id: `deal-${i}`,
        destination_iata: `D${String(i).padStart(2, '0')}`,
        city: `City${i}`,
      }));
    }
    mockQueryResult = { data: deals, error: null };

    const req = makeReq({ method: 'GET', query: { limit: '3' } });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.deals.length).toBeLessThanOrEqual(3);
  });

  it('caps limit at 25', async () => {
    mockQueryResult = { data: [], error: null };
    const req = makeReq({ method: 'GET', query: { limit: '100' } });
    const res = makeRes();
    await handler(req, res);

    // Should call supabase with limit * 3 = 75 (25 * 3)
    expect(mockChain.limit).toHaveBeenCalledWith(75);
  });

  it('filters by origin when provided', async () => {
    mockQueryResult = { data: [], error: null };
    const req = makeReq({ method: 'GET', query: { origin: 'jfk' } });
    const res = makeRes();
    await handler(req, res);

    // Should call eq with uppercased origin
    expect(mockChain.eq).toHaveBeenCalledWith('origin', 'JFK');
  });

  it('sets Cache-Control header', async () => {
    mockQueryResult = { data: [], error: null };
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300, s-maxage=300');
  });

  it('returns empty deals array when no data', async () => {
    mockQueryResult = { data: [], error: null };
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.deals).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('returns 500 on database error', async () => {
    mockQueryResult = { data: null, error: { message: 'DB connection failed' } };
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
