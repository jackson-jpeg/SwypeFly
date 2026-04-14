/**
 * Tests for destination action routes not covered by destination.test.ts:
 * - calendar, monthly, week-matrix, price-history actions
 * - Error paths and edge cases
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Supabase mock infrastructure ────────────────────────────────────

const mockResultQueues = new Map<string, Array<{ data: unknown; error: unknown }>>();

function pushResult(table: string, result: { data: unknown; error: unknown }) {
  if (!mockResultQueues.has(table)) mockResultQueues.set(table, []);
  mockResultQueues.get(table)!.push(result);
}

function popResult(table: string): { data: unknown; error: unknown } {
  const queue = mockResultQueues.get(table);
  if (queue && queue.length > 0) return queue.shift()!;
  return { data: [], error: null };
}

const createChain = (table: string) => {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'eq', 'neq', 'in', 'contains', 'ilike',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'range', 'match',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.insert = jest.fn().mockImplementation(() => chain);
  chain.update = jest.fn().mockImplementation(() => chain);
  chain.delete = jest.fn().mockImplementation(() => chain);
  chain.upsert = jest.fn().mockImplementation(() => chain);
  chain.single = jest.fn().mockImplementation(() => {
    const result = popResult(table);
    return Promise.resolve({
      data: result.error ? null : (Array.isArray(result.data) ? (result.data as unknown[])[0] ?? null : result.data),
      error: result.error,
    });
  });
  (chain as any).then = jest.fn().mockImplementation((resolve: any) => {
    const result = popResult(table);
    if (resolve) return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  });
  return chain;
};

const mockFrom = jest.fn().mockImplementation((table: string) => createChain(table));

jest.mock('../../services/supabaseServer', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  TABLES: {
    destinations: 'destinations',
    cachedPrices: 'cached_prices',
    cachedHotelPrices: 'cached_hotel_prices',
    destinationImages: 'destination_images',
    priceCalendar: 'price_calendar',
    aiCache: 'ai_cache',
    priceHistoryStats: 'price_history_stats',
  },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('../../utils/env', () => ({
  env: {
    BOOKING_MARKUP_PERCENT: 3,
    CRON_SECRET: 'test',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  },
}));

const mockFetchPriceCalendar = jest.fn().mockResolvedValue([]);
const mockFetchMonthlyPrices = jest.fn().mockResolvedValue([]);
const mockFetchWeekMatrix = jest.fn().mockResolvedValue([]);

jest.mock('../../services/travelpayouts', () => ({
  fetchPriceCalendar: (...args: unknown[]) => mockFetchPriceCalendar(...args),
  fetchMonthlyPrices: (...args: unknown[]) => mockFetchMonthlyPrices(...args),
  fetchWeekMatrix: (...args: unknown[]) => mockFetchWeekMatrix(...args),
}));

jest.mock('../../services/duffel', () => ({
  searchFlights: jest.fn().mockResolvedValue({ data: { offers: [] } }),
}));

import handler from '../../api/destination';

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

// ─── Calendar action ────────────────────────────────────────────────────

describe('GET /api/destination?action=calendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
  });

  it('rejects missing origin', async () => {
    const req = makeReq({ query: { action: 'calendar', destination: 'BCN' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing destination', async () => {
    const req = makeReq({ query: { action: 'calendar', origin: 'JFK' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns cached calendar data when available', async () => {
    pushResult('price_calendar', {
      data: [
        { date: '2026-05-01', price: 300, airline: 'DL' },
        { date: '2026-05-02', price: 250, airline: 'AA' },
        { date: '2026-05-10', price: 280, airline: 'UA' },
      ],
      error: null,
    });

    const req = makeReq({
      query: { action: 'calendar', origin: 'JFK', destination: 'BCN', month: '2026-05' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.calendar).toHaveLength(3);
    expect(body.cheapestDate).toBe('2026-05-02');
    // Price with 3% markup: Math.round(250 * 1.03) = 258
    expect(body.cheapestPrice).toBe(258);
    // Each price should have markup applied
    expect(body.calendar[0].price).toBe(309); // Math.round(300 * 1.03)
    expect(body.calendar[1].price).toBe(258);
  });

  it('does not fall back to Travelpayouts when no cached data (Phase 4)', async () => {
    pushResult('price_calendar', { data: [], error: null });
    mockFetchPriceCalendar.mockResolvedValueOnce([
      { date: '2026-05-15', price: 400, airline: 'BA', transferCount: 0 },
    ]);

    const req = makeReq({
      query: { action: 'calendar', origin: 'JFK', destination: 'BCN', month: '2026-05' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    // Phase 4: Travelpayouts calendar fallback removed.
    expect(mockFetchPriceCalendar).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.calendar).toBeNull();
    expect(body.cheapestDate).toBeNull();
    expect(body.cheapestPrice).toBeNull();
    expect(body.reason).toBe('not_yet_indexed');
  });

  it('returns not_yet_indexed when no calendar data cached', async () => {
    pushResult('price_calendar', { data: [], error: null });
    mockFetchPriceCalendar.mockResolvedValueOnce([]);

    const req = makeReq({
      query: { action: 'calendar', origin: 'JFK', destination: 'BCN', month: '2026-06' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.calendar).toBeNull();
    expect(body.cheapestDate).toBeNull();
    expect(body.cheapestPrice).toBeNull();
    expect(body.reason).toBe('not_yet_indexed');
    // Travelpayouts fallback is gone.
    expect(mockFetchPriceCalendar).not.toHaveBeenCalled();
  });

  it('sets Cache-Control header', async () => {
    pushResult('price_calendar', {
      data: [{ date: '2026-05-01', price: 300, airline: 'DL' }],
      error: null,
    });

    const req = makeReq({
      query: { action: 'calendar', origin: 'JFK', destination: 'BCN', month: '2026-05' },
    });
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader).toBeDefined();
    expect(cacheHeader![1]).toContain('s-maxage');
  });
});

// ─── Monthly action ────────────────────────────────────────────────────

describe('GET /api/destination?action=monthly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
  });

  it('rejects missing origin', async () => {
    const req = makeReq({ query: { action: 'monthly', destination: 'BCN' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns not_yet_indexed (Travelpayouts removed in Phase 4)', async () => {
    mockFetchMonthlyPrices.mockResolvedValueOnce([
      { month: '2026-05', price: 350 },
      { month: '2026-06', price: 280 },
      { month: '2026-07', price: 420 },
    ]);

    const req = makeReq({
      query: { action: 'monthly', origin: 'JFK', destination: 'BCN' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    // Phase 4: monthly overview no longer backed by Travelpayouts; returns empty with reason.
    expect(body.months).toHaveLength(0);
    expect(body.cheapestMonth).toBeNull();
    expect(body.cheapestPrice).toBeNull();
    expect(body.reason).toBe('not_yet_indexed');
    expect(mockFetchMonthlyPrices).not.toHaveBeenCalled();
  });

  it('returns empty months with not_yet_indexed reason', async () => {
    mockFetchMonthlyPrices.mockResolvedValueOnce([]);

    const req = makeReq({
      query: { action: 'monthly', origin: 'JFK', destination: 'BCN' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.months).toHaveLength(0);
    expect(body.cheapestMonth).toBeNull();
    expect(body.reason).toBe('not_yet_indexed');
  });
});

// ─── Week matrix action ────────────────────────────────────────────────

describe('GET /api/destination?action=week-matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
  });

  it('rejects missing departDate', async () => {
    const req = makeReq({
      query: { action: 'week-matrix', origin: 'JFK', destination: 'BCN', returnDate: '2026-05-08' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing returnDate', async () => {
    const req = makeReq({
      query: { action: 'week-matrix', origin: 'JFK', destination: 'BCN', departDate: '2026-05-01' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns not_yet_indexed on valid request (Travelpayouts removed in Phase 4)', async () => {
    mockFetchWeekMatrix.mockResolvedValueOnce([
      { departDate: '2026-05-01', returnDate: '2026-05-08', price: 320 },
      { departDate: '2026-05-02', returnDate: '2026-05-09', price: 290 },
    ]);

    const req = makeReq({
      query: {
        action: 'week-matrix',
        origin: 'JFK',
        destination: 'BCN',
        departDate: '2026-05-01',
        returnDate: '2026-05-08',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    // Phase 4: week-matrix is no longer backed by Travelpayouts.
    expect(body.matrix).toHaveLength(0);
    expect(body.cheapest).toBeNull();
    expect(body.reason).toBe('not_yet_indexed');
    expect(mockFetchWeekMatrix).not.toHaveBeenCalled();
  });

  it('returns null cheapest when matrix is empty', async () => {
    mockFetchWeekMatrix.mockResolvedValueOnce([]);

    const req = makeReq({
      query: {
        action: 'week-matrix',
        origin: 'JFK',
        destination: 'BCN',
        departDate: '2026-05-01',
        returnDate: '2026-05-08',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.matrix).toHaveLength(0);
    expect(body.cheapest).toBeNull();
  });
});

// ─── Price history action ──────────────────────────────────────────────

describe('GET /api/destination?action=price-history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
  });

  it('rejects missing origin', async () => {
    const req = makeReq({ query: { action: 'price-history', destination: 'BCN' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing destination', async () => {
    const req = makeReq({ query: { action: 'price-history', origin: 'JFK' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns price history with stats', async () => {
    // Use unique route to avoid in-memory cache collisions
    // ai_cache query returns history entries
    // Note: the handler filters by key ending with -${destination}, so all origins match
    pushResult('ai_cache', {
      data: [
        {
          key: 'JFK-MAD',
          content: JSON.stringify({ price: 300, source: 'travelpayouts', airline: 'DL', timestamp: '2026-03-01' }),
          created_at: '2026-03-01T00:00:00Z',
        },
        {
          key: 'JFK-MAD',
          content: JSON.stringify({ price: 280, source: 'travelpayouts', airline: 'AA', timestamp: '2026-03-02' }),
          created_at: '2026-03-02T00:00:00Z',
        },
        {
          key: 'LAX-MAD',
          content: JSON.stringify({ price: 350, source: 'amadeus', airline: 'UA' }),
          created_at: '2026-03-03T00:00:00Z',
        },
      ],
      error: null,
    });

    // cached_prices for current price
    pushResult('cached_prices', {
      data: [{ price: 270, source: 'travelpayouts' }],
      error: null,
    });

    const req = makeReq({
      query: { action: 'price-history', origin: 'JFK', destination: 'MAD' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('history');
    expect(body).toHaveProperty('currentPrice', 270);
    expect(body).toHaveProperty('avgPrice');
    expect(body).toHaveProperty('minPrice');
    expect(body).toHaveProperty('maxPrice');
    expect(body).toHaveProperty('trend');
    // All entries with key ending in -MAD are included (both JFK-MAD and LAX-MAD)
    expect(body.history).toHaveLength(3);
    expect(body.minPrice).toBe(280);
    expect(body.maxPrice).toBe(350);
  });

  it('returns empty history when no data', async () => {
    // Use unique route to avoid in-memory cache from prior test
    pushResult('ai_cache', { data: [], error: null });
    pushResult('cached_prices', { data: [], error: null });

    const req = makeReq({
      query: { action: 'price-history', origin: 'JFK', destination: 'CDG' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.history).toHaveLength(0);
    expect(body.currentPrice).toBeNull();
    expect(body.avgPrice).toBeNull();
    expect(body.trend).toBe('stable');
  });
});

// ─── Error edge cases ──────────────────────────────────────────────────

describe('destination handler — error paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
  });

  it('calendar swallows DB errors and returns not_yet_indexed (Phase 4)', async () => {
    // Force the price_calendar query to fail. The handler now catches the DB
    // error internally, returns an empty cached set, and reports not_yet_indexed
    // (since there is no Travelpayouts fallback to trigger).
    pushResult('price_calendar', { data: null, error: new Error('DB down') });
    mockFetchPriceCalendar.mockRejectedValueOnce(new Error('Travelpayouts timeout'));

    const req = makeReq({
      query: { action: 'calendar', origin: 'JFK', destination: 'BCN' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.calendar).toBeNull();
    expect(body.reason).toBe('not_yet_indexed');
    // Travelpayouts is not touched even on DB failure.
    expect(mockFetchPriceCalendar).not.toHaveBeenCalled();
  });

  it('monthly no longer throws: Travelpayouts path removed (Phase 4)', async () => {
    // Even if Travelpayouts would error, the handler never calls it anymore,
    // so the response is the stable not_yet_indexed shape.
    mockFetchMonthlyPrices.mockRejectedValueOnce(new Error('API failure'));

    const req = makeReq({
      query: { action: 'monthly', origin: 'JFK', destination: 'BCN' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.months).toHaveLength(0);
    expect(body.reason).toBe('not_yet_indexed');
    expect(mockFetchMonthlyPrices).not.toHaveBeenCalled();
  });

  it('week-matrix no longer throws: Travelpayouts path removed (Phase 4)', async () => {
    mockFetchWeekMatrix.mockRejectedValueOnce(new Error('API failure'));

    const req = makeReq({
      query: {
        action: 'week-matrix',
        origin: 'JFK',
        destination: 'BCN',
        departDate: '2026-05-01',
        returnDate: '2026-05-08',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.matrix).toHaveLength(0);
    expect(body.cheapest).toBeNull();
    expect(body.reason).toBe('not_yet_indexed');
    expect(mockFetchWeekMatrix).not.toHaveBeenCalled();
  });
});
