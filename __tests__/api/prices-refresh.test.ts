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
    cachedPrices: 'cached_prices',
    userPreferences: 'user_preferences',
    aiCache: 'ai_cache',
    priceHistoryStats: 'price_history_stats',
  },
}));

jest.mock('../../utils/env', () => ({
  env: {
    get CRON_SECRET() {
      return process.env.CRON_SECRET;
    },
    BOOKING_MARKUP_PERCENT: 3,
  },
}));

jest.mock('../../utils/config', () => ({
  REFRESH_BATCH_SIZE: 30,
  DUFFEL_CONCURRENCY: 15,
  PRICE_CHANGE_THRESHOLD: 0.05,
}));

jest.mock('../../utils/apiLogger', () => ({ logApiError: jest.fn() }));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

jest.mock('../../utils/validation', () => ({
  pricesQuerySchema: {},
  validateRequest: jest.fn((_schema: unknown, data: unknown) => ({
    success: true,
    data: data || {},
  })),
}));

// Mock retry to call function directly (no delays)
jest.mock('../../utils/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

// Mock priceStats — the handler calls these for deal quality scoring
const mockGetRouteStats = jest.fn().mockResolvedValue(null);
const mockComputePricePercentile = jest.fn().mockReturnValue(50);
const mockUpdateRouteStats = jest.fn().mockResolvedValue(undefined);
const mockClearStatsCache = jest.fn();
jest.mock('../../utils/priceStats', () => ({
  getRouteStats: (...args: unknown[]) => mockGetRouteStats(...args),
  computePricePercentile: (...args: unknown[]) => mockComputePricePercentile(...args),
  updateRouteStats: (...args: unknown[]) => mockUpdateRouteStats(...args),
  clearStatsCache: (...args: unknown[]) => mockClearStatsCache(...args),
}));

// Mock dealQuality — always pass for simplicity
jest.mock('../../utils/dealQuality', () => ({
  evaluateDealQuality: jest.fn().mockReturnValue({
    pass: true,
    dealScore: 80,
    dealTier: 'good',
    qualityScore: 75,
    rejectReason: null,
    savingsPercent: 10,
  }),
  extractSegmentData: jest.fn().mockReturnValue({
    airlineCode: 'TA',
    totalStops: 0,
    totalTravelTimeMinutes: 600,
    maxLayoverMinutes: 0,
    departureHour: 8,
    isNonstop: true,
  }),
  US_AIRPORTS: new Set(['JFK', 'LAX', 'ORD', 'ATL', 'SFO', 'MIA', 'DFW', 'SEA', 'BOS', 'TPA']),
}));

const mockSearchFlights = jest.fn();
jest.mock('../../services/duffel', () => ({
  searchFlights: (...args: unknown[]) => mockSearchFlights(...args),
}));

import handler from '../../api/prices/refresh';

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

function makeDuffelOffer(dest: string, price: number, airline = 'TestAir') {
  return {
    id: `off_${dest}`,
    total_amount: String(price),
    total_currency: 'USD',
    expires_at: '2026-04-01T15:00:00Z',
    slices: [
      {
        segments: [
          {
            operating_carrier: { name: airline, iata_code: 'TA' },
            operating_carrier_flight_number: '100',
            departing_at: '2026-04-01T08:00:00',
            arriving_at: '2026-04-01T18:00:00',
            origin: { iata_code: 'JFK' },
            destination: { iata_code: dest },
            aircraft: { name: 'Boeing 737' },
          },
        ],
      },
      {
        segments: [
          {
            operating_carrier: { name: airline, iata_code: 'TA' },
            operating_carrier_flight_number: '101',
            departing_at: '2026-04-08T10:00:00',
            arriving_at: '2026-04-08T20:00:00',
            origin: { iata_code: dest },
            destination: { iata_code: 'JFK' },
            aircraft: { name: 'Boeing 737' },
          },
        ],
      },
    ],
    passengers: [{ id: 'pas_001', type: 'adult' }],
  };
}

describe('api/prices/refresh', () => {
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

  test('succeeds with Duffel as primary source', async () => {
    // 1. destinations (active IATA codes) — called from main handler
    pushResult('destinations', {
      data: [
        { iata_code: 'BCN' },
        { iata_code: 'CDG' },
      ],
      error: null,
    });

    // 2. user_preferences (getActiveOrigins)
    pushResult('user_preferences', { data: [], error: null });

    // 3. cached_prices (pickNextOrigins staleness check) — not needed since origin=JFK is explicit
    // but pickStalestDestinations calls it:
    // 3a. cached_prices — existing prices for origin (pickStalestDestinations currentPriceMap)
    pushResult('cached_prices', { data: [], error: null });
    // 3b. cached_prices — staleness data (pickStalestDestinations fetchedAtMap)
    pushResult('cached_prices', { data: [], error: null });

    // 4. destinations (getDestMeta — for deal quality)
    pushResult('destinations', {
      data: [
        { iata_code: 'BCN', country: 'Spain', popularity_score: 0.8, best_months: ['June', 'July'] },
        { iata_code: 'CDG', country: 'France', popularity_score: 0.9, best_months: ['May', 'June'] },
      ],
      error: null,
    });

    // For each destination's refreshOneDest:
    // BCN: cached_prices insert (new) + ai_cache insert (snapshot)
    pushResult('cached_prices', { data: null, error: null }); // insert
    pushResult('ai_cache', { data: null, error: null }); // snapshot
    // CDG: cached_prices insert + ai_cache insert
    pushResult('cached_prices', { data: null, error: null }); // insert
    pushResult('ai_cache', { data: null, error: null }); // snapshot

    // Duffel returns offers for each destination
    mockSearchFlights.mockImplementation((params: { destination: string }) => {
      if (params.destination === 'BCN') {
        return Promise.resolve({ offers: [makeDuffelOffer('BCN', 350, 'Iberia')] });
      }
      if (params.destination === 'CDG') {
        return Promise.resolve({ offers: [makeDuffelOffer('CDG', 420, 'Air France')] });
      }
      return Promise.resolve({ offers: [] });
    });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.origins).toHaveLength(1);
    expect(responseData.origins[0].origin).toBe('JFK');
    expect(responseData.origins[0].sources.duffel).toBe(2);
    expect(responseData.batchSize).toBe(30);

    // Verify Duffel was called for each destination
    expect(mockSearchFlights).toHaveBeenCalledTimes(2);

    // Verify cached_prices inserts (one per destination)
    const cachedPriceInserts = mockInsertCalls.filter((c) => c.table === 'cached_prices');
    expect(cachedPriceInserts.length).toBe(2);
    expect((cachedPriceInserts[0].data as any).source).toBe('duffel');
    expect((cachedPriceInserts[0].data as any).offer_json).toBeTruthy();
    expect((cachedPriceInserts[0].data as any).offer_expires_at).toBeTruthy();
    // Deal quality fields should be present
    expect((cachedPriceInserts[0].data as any).deal_score).toBeDefined();
    expect((cachedPriceInserts[0].data as any).deal_tier).toBeDefined();

    // Verify price history snapshots in ai_cache
    const snapshotInserts = mockInsertCalls.filter((c) => c.table === 'ai_cache');
    expect(snapshotInserts.length).toBe(2);
    expect((snapshotInserts[0].data as any).type).toBe('price_history');
  });

  test('returns null source when Duffel fails', async () => {
    // destinations
    pushResult('destinations', {
      data: [{ iata_code: 'BCN' }],
      error: null,
    });
    // user_preferences
    pushResult('user_preferences', { data: [], error: null });
    // cached_prices (pickStalestDestinations: currentPriceMap)
    pushResult('cached_prices', { data: [], error: null });
    // cached_prices (pickStalestDestinations: fetchedAtMap)
    pushResult('cached_prices', { data: [], error: null });
    // destinations (getDestMeta)
    pushResult('destinations', {
      data: [{ iata_code: 'BCN', country: 'Spain', popularity_score: 0.8, best_months: [] }],
      error: null,
    });

    // Duffel fails
    mockSearchFlights.mockRejectedValue(new Error('Duffel API error'));

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.origins[0].sources.duffel).toBe(0);
    expect(responseData.origins[0].fetched).toBe(0);

    // No cached_prices or snapshots should be created when Duffel fails
    const cachedPriceInserts = mockInsertCalls.filter((c) => c.table === 'cached_prices');
    expect(cachedPriceInserts.length).toBe(0);
  });

  test('tracks price history with direction', async () => {
    // destinations (active IATA codes)
    pushResult('destinations', {
      data: [{ iata_code: 'BCN' }],
      error: null,
    });
    // user_preferences
    pushResult('user_preferences', { data: [], error: null });
    // cached_prices (pickStalestDestinations: currentPriceMap) — has existing price
    pushResult('cached_prices', {
      data: [
        {
          id: 'price-bcn',
          destination_iata: 'BCN',
          price: 400,
        },
      ],
      error: null,
    });
    // cached_prices (pickStalestDestinations: fetchedAtMap)
    pushResult('cached_prices', {
      data: [
        { destination_iata: 'BCN', fetched_at: '2026-03-01T00:00:00Z' },
      ],
      error: null,
    });
    // destinations (getDestMeta)
    pushResult('destinations', {
      data: [{ iata_code: 'BCN', country: 'Spain', popularity_score: 0.8, best_months: ['June'] }],
      error: null,
    });

    // cached_prices update result
    pushResult('cached_prices', { data: null, error: null });
    // ai_cache snapshot insert
    pushResult('ai_cache', { data: null, error: null });

    // Duffel returns cheaper price (>5% drop)
    mockSearchFlights.mockResolvedValue({
      offers: [makeDuffelOffer('BCN', 350, 'Iberia')],
    });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    // Verify update for cached_prices with price direction
    const priceUpdates = mockUpdateCalls.filter((c) => c.table === 'cached_prices');
    expect(priceUpdates.length).toBe(1);
    expect((priceUpdates[0].data as any).price).toBe(350);
    expect((priceUpdates[0].data as any).previous_price).toBe(400);
    expect((priceUpdates[0].data as any).price_direction).toBe('down');

    // Verify price snapshot was also recorded in ai_cache
    const snapshotInserts = mockInsertCalls.filter((c) => c.table === 'ai_cache');
    expect(snapshotInserts.length).toBe(1);
    expect((snapshotInserts[0].data as any).type).toBe('price_history');
  });
});
