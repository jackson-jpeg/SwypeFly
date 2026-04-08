import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Supabase mock infrastructure ──────────────────────────────────────────

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

const mockInsertCalls: Array<{ table: string; data: unknown }> = [];
const mockUpdateCalls: Array<{ table: string; data: unknown }> = [];
const mockUpsertCalls: Array<{ table: string; data: unknown; options?: unknown }> = [];
const mockDeleteCalls: Array<{ table: string }> = [];

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
  chain.insert = jest.fn().mockImplementation((data: unknown) => {
    mockInsertCalls.push({ table, data });
    return chain;
  });
  chain.update = jest.fn().mockImplementation((data: unknown) => {
    mockUpdateCalls.push({ table, data });
    return chain;
  });
  chain.delete = jest.fn().mockImplementation(() => {
    mockDeleteCalls.push({ table });
    return chain;
  });
  chain.upsert = jest.fn().mockImplementation((data: unknown, options?: unknown) => {
    mockUpsertCalls.push({ table, data, options });
    return chain;
  });
  chain.single = jest.fn().mockImplementation(() => {
    const result = popResult(table);
    if (result.error) return Promise.reject(result.error);
    return Promise.resolve({
      data: Array.isArray(result.data) ? (result.data as unknown[])[0] ?? null : result.data,
      error: null,
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
    userPreferences: 'user_preferences',
    priceCalendar: 'price_calendar',
    priceHistoryStats: 'price_history_stats',
  },
}));

jest.mock('../../utils/env', () => ({
  env: {
    get CRON_SECRET() {
      return process.env.CRON_SECRET;
    },
  },
}));

jest.mock('../../utils/apiLogger', () => ({ logApiError: jest.fn() }));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

// Mock retry to call function directly (no delays)
jest.mock('../../utils/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

// Mock priceStats
const mockGetRouteStats = jest.fn().mockResolvedValue({ medianPrice: 400, p20Price: 300, p5Price: 250, p80Price: 500, minPriceEver: 200, maxPriceEver: 600, sampleCount: 10, last30dAvg: 380 });
const mockComputePricePercentile = jest.fn().mockReturnValue(50);
const mockUpdateRouteStats = jest.fn().mockResolvedValue(undefined);
const mockClearStatsCache = jest.fn();
jest.mock('../../utils/priceStats', () => ({
  getRouteStats: (...args: unknown[]) => mockGetRouteStats(...args),
  computePricePercentile: (...args: unknown[]) => mockComputePricePercentile(...args),
  updateRouteStats: (...args: unknown[]) => mockUpdateRouteStats(...args),
  clearStatsCache: (...args: unknown[]) => mockClearStatsCache(...args),
}));

// Mock dealQuality — always pass
jest.mock('../../utils/dealQuality', () => ({
  evaluateDealQuality: jest.fn().mockReturnValue({
    pass: true,
    dealScore: 80,
    dealTier: 'good',
    qualityScore: 75,
    rejectReason: null,
    savingsPercent: 10,
  }),
  US_AIRPORTS: new Set(['JFK', 'LAX', 'ORD', 'ATL', 'SFO', 'MIA', 'DFW', 'SEA', 'BOS', 'TPA']),
}));

const mockFetchAllCheapPrices = jest.fn();
const mockFetchLatestPrices = jest.fn().mockResolvedValue(new Map());
const mockFetchByPriceRange = jest.fn().mockResolvedValue([]);
jest.mock('../../services/travelpayouts', () => ({
  fetchAllCheapPrices: (...args: unknown[]) => mockFetchAllCheapPrices(...args),
  fetchLatestPrices: (...args: unknown[]) => mockFetchLatestPrices(...args),
  fetchByPriceRange: (...args: unknown[]) => mockFetchByPriceRange(...args),
}));

import handler from '../../api/prices/refresh-calendar';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes(): VercelResponse {
  const res: Partial<VercelResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res as VercelResponse;
}

describe('api/prices/refresh-calendar', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    mockInsertCalls.length = 0;
    mockUpdateCalls.length = 0;
    mockUpsertCalls.length = 0;
    mockDeleteCalls.length = 0;
    process.env = { ...OLD_ENV };
    process.env.CRON_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns 503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  test('returns 401 without authorization', async () => {
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 with wrong secret', async () => {
    const req = makeReq({
      headers: { authorization: 'Bearer wrong-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('fetches bulk prices then upserts calendar entries', async () => {
    // fetchAllCheapPrices returns two destinations
    // Use dates far in the future so they pass the dep >= today filter
    const futureDate = new Date(Date.now() + 14 * 86400000).toISOString();
    const futureReturn = new Date(Date.now() + 21 * 86400000).toISOString();
    mockFetchAllCheapPrices.mockResolvedValue(
      new Map([
        [
          'BCN',
          {
            destination: 'BCN',
            price: 350,
            airline: 'IB',
            departureAt: futureDate,
            returnAt: futureReturn,
            foundAt: new Date().toISOString(),
          },
        ],
        [
          'CDG',
          {
            destination: 'CDG',
            price: 420,
            airline: 'AF',
            departureAt: futureDate,
            returnAt: futureReturn,
            foundAt: new Date().toISOString(),
          },
        ],
      ]),
    );

    // destinations (our destination IATA codes for sorting)
    pushResult('destinations', {
      data: [
        { iata_code: 'BCN' },
        { iata_code: 'CDG' },
      ],
      error: null,
    });

    // destinations (getDestMeta — for deal quality)
    pushResult('destinations', {
      data: [
        { iata_code: 'BCN', country: 'Spain', popularity_score: 0.8, best_months: ['June'] },
        { iata_code: 'CDG', country: 'France', popularity_score: 0.9, best_months: ['May'] },
      ],
      error: null,
    });

    // For each upsertCalendarEntry:
    // BCN: price_calendar previous price check, then upsert
    pushResult('price_calendar', { data: [], error: null }); // previous price check
    pushResult('price_calendar', { data: null, error: null }); // upsert
    // CDG: price_calendar previous price check, then upsert
    pushResult('price_calendar', { data: [], error: null }); // previous price check
    pushResult('price_calendar', { data: null, error: null }); // upsert

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = (res.json as jest.Mock).mock.calls[0][0];
    expect(data.origins).toHaveLength(1);
    expect(data.origins[0].origin).toBe('JFK');

    // Should have called fetchAllCheapPrices once for JFK
    expect(mockFetchAllCheapPrices).toHaveBeenCalledWith('JFK');

    // Verify upsert calls for price_calendar
    const calendarUpserts = mockUpsertCalls.filter((c) => c.table === 'price_calendar');
    expect(calendarUpserts.length).toBe(2);

    // Verify upsert data shape
    const firstUpsert = calendarUpserts[0].data as any;
    expect(firstUpsert.origin).toBe('JFK');
    expect(firstUpsert.source).toBe('travelpayouts');
    expect(firstUpsert.trip_days).toBe(7);
    expect(firstUpsert.fetched_at).toBeDefined();
    // Deal quality fields should be present
    expect(firstUpsert.deal_score).toBeDefined();
    expect(firstUpsert.deal_tier).toBeDefined();
  });

  test('handles fetchAllCheapPrices returning empty map', async () => {
    mockFetchAllCheapPrices.mockResolvedValue(new Map());

    // destinations (for IATA codes) — still queried even if bulk is empty
    pushResult('destinations', { data: [], error: null });
    // getDestMeta
    pushResult('destinations', { data: [], error: null });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = (res.json as jest.Mock).mock.calls[0][0];
    expect(data.origins[0].bulkDestinations).toBe(0);
    // No upserts should happen
    const calendarUpserts = mockUpsertCalls.filter((c) => c.table === 'price_calendar');
    expect(calendarUpserts.length).toBe(0);
  });

  test('picks stalest origins when no origin param provided', async () => {
    // 1. user_preferences (getActiveOrigins)
    pushResult('user_preferences', { data: [], error: null });
    // 2. price_calendar (pickNextOrigins staleness check)
    pushResult('price_calendar', {
      data: [
        { origin: 'TPA', fetched_at: '2026-01-01T00:00:00Z' },
        { origin: 'LAX', fetched_at: '2026-03-18T00:00:00Z' },
      ],
      error: null,
    });

    // For each origin that gets processed, fetchAllCheapPrices returns empty
    mockFetchAllCheapPrices.mockResolvedValue(new Map());

    // Each origin will query destinations + getDestMeta
    // Origin 1: destinations for IATA codes
    pushResult('destinations', { data: [], error: null });
    // Origin 1: getDestMeta
    pushResult('destinations', { data: [], error: null });
    // Origin 2: destinations for IATA codes
    pushResult('destinations', { data: [], error: null });
    // Origin 2: getDestMeta  (may use cached from first call)
    pushResult('destinations', { data: [], error: null });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: {},
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = (res.json as jest.Mock).mock.calls[0][0];
    // Should pick 2 origins (pickNextOrigins(2) in the handler)
    expect(data.origins).toHaveLength(2);
  });
});
