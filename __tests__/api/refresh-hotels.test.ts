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
  chain.delete = jest.fn().mockImplementation(() => chain);
  chain.upsert = jest.fn().mockReturnValue(chain);
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
    cachedHotelPrices: 'cached_hotel_prices',
  },
}));

jest.mock('../../utils/env', () => ({
  env: {
    get CRON_SECRET() {
      return process.env.CRON_SECRET;
    },
  },
  STUB_MODE: false,
}));

jest.mock('../../utils/config', () => ({
  HOTEL_BATCH_SIZE: 3,
  HOTEL_BATCH_DELAY_MS: 0,
  HOTEL_SEARCH_RADIUS_KM: 10,
  HOTEL_STAY_NIGHTS: 3,
  HOTEL_TOP_RESULTS: 5,
}));

jest.mock('../../utils/apiLogger', () => ({ logApiError: jest.fn() }));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

jest.mock('../../utils/validation', () => ({
  hotelPricesQuerySchema: {},
  validateRequest: jest.fn((_schema: unknown, data: unknown) => ({
    success: true,
    data: data || {},
  })),
}));

jest.mock('../../utils/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

jest.mock('../../utils/apiResponse', () => ({
  sendError: jest.fn(
    (res: VercelResponse, status: number, _code: string, message: string, extra?: unknown) => {
      res.status(status).json({ ok: false, error: { message, ...((extra as any) || {}) } });
    },
  ),
}));

const mockSearchStays = jest.fn();
jest.mock('../../services/duffel', () => ({
  searchStays: (...args: unknown[]) => mockSearchStays(...args),
}));

import handler from '../../api/prices/refresh-hotels';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function makeStayResult(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Hotel Test',
    rating: 4,
    reviewScore: 8.5,
    reviewCount: 200,
    cheapestTotalAmount: 450,
    currency: 'USD',
    photoUrl: 'https://example.com/photo.jpg',
    boardType: 'room_only',
    accommodationId: 'acc_001',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('api/prices/refresh-hotels', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    mockInsertCalls.length = 0;
    mockUpdateCalls.length = 0;
    process.env = { ...OLD_ENV };
    process.env.CRON_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns 401 without authorization header', async () => {
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

  test('successfully refreshes hotel prices', async () => {
    // 1. destinations query
    pushResult('destinations', {
      data: [
        { id: 'd1', iata_code: 'BCN', city: 'Barcelona', latitude: 41.39, longitude: 2.17 },
        { id: 'd2', iata_code: 'CDG', city: 'Paris', latitude: 48.86, longitude: 2.35 },
      ],
      error: null,
    });

    // 2. cached_hotel_prices (existing docs lookup)
    pushResult('cached_hotel_prices', { data: [], error: null });

    // 3. cached_hotel_prices insert for BCN
    pushResult('cached_hotel_prices', { data: null, error: null });
    // 4. cached_hotel_prices insert for CDG
    pushResult('cached_hotel_prices', { data: null, error: null });

    mockSearchStays.mockImplementation((params: { latitude: number }) => {
      if (params.latitude === 41.39) {
        return Promise.resolve([
          makeStayResult({ name: 'Hotel Barcelona', cheapestTotalAmount: 450 }),
          makeStayResult({ name: 'Hotel Ramblas', cheapestTotalAmount: 600 }),
        ]);
      }
      if (params.latitude === 48.86) {
        return Promise.resolve([
          makeStayResult({ name: 'Hotel Paris', cheapestTotalAmount: 300 }),
        ]);
      }
      return Promise.resolve([]);
    });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.fetched).toBe(2);
    expect(body.total).toBe(2);
    expect(body.source).toBe('duffel');

    // Verify searchStays was called for each destination
    expect(mockSearchStays).toHaveBeenCalledTimes(2);

    // Verify inserts into cached_hotel_prices
    const hotelInserts = mockInsertCalls.filter((c) => c.table === 'cached_hotel_prices');
    expect(hotelInserts).toHaveLength(2);
    // BCN: cheapest per night = 450 / 3 = 150
    expect((hotelInserts[0].data as any).destination_iata).toBe('BCN');
    expect((hotelInserts[0].data as any).price_per_night).toBe(150);
    expect((hotelInserts[0].data as any).source).toBe('duffel');
    // CDG: cheapest per night = 300 / 3 = 100
    expect((hotelInserts[1].data as any).destination_iata).toBe('CDG');
    expect((hotelInserts[1].data as any).price_per_night).toBe(100);
  });

  test('handles empty destinations list gracefully', async () => {
    pushResult('destinations', { data: [], error: null });
    // cached_hotel_prices existing docs
    pushResult('cached_hotel_prices', { data: [], error: null });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.fetched).toBe(0);
    expect(body.total).toBe(0);
    expect(mockSearchStays).not.toHaveBeenCalled();
  });

  test('handles hotel API errors gracefully without crashing', async () => {
    pushResult('destinations', {
      data: [
        { id: 'd1', iata_code: 'BCN', city: 'Barcelona', latitude: 41.39, longitude: 2.17 },
        { id: 'd2', iata_code: 'CDG', city: 'Paris', latitude: 48.86, longitude: 2.35 },
      ],
      error: null,
    });

    pushResult('cached_hotel_prices', { data: [], error: null });
    // CDG insert (BCN fails so no insert for it)
    pushResult('cached_hotel_prices', { data: null, error: null });

    // BCN fails, CDG succeeds
    mockSearchStays.mockImplementation((params: { latitude: number }) => {
      if (params.latitude === 41.39) {
        return Promise.reject(new Error('Duffel API rate limited'));
      }
      return Promise.resolve([
        makeStayResult({ name: 'Hotel Paris', cheapestTotalAmount: 300 }),
      ]);
    });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    // Only CDG succeeded
    expect(body.fetched).toBe(1);
    expect(body.total).toBe(2);
  });

  test('returns 500 on database error fetching destinations', async () => {
    pushResult('destinations', {
      data: null,
      error: { message: 'DB connection failed' },
    });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('skips destinations without coordinates', async () => {
    pushResult('destinations', {
      data: [
        { id: 'd1', iata_code: 'BCN', city: 'Barcelona', latitude: 41.39, longitude: 2.17 },
        { id: 'd2', iata_code: 'CDG', city: 'Paris', latitude: null, longitude: null },
        { id: 'd3', iata_code: 'NRT', city: 'Tokyo', latitude: 35.77, longitude: 140.39 },
      ],
      error: null,
    });

    pushResult('cached_hotel_prices', { data: [], error: null });
    // BCN insert
    pushResult('cached_hotel_prices', { data: null, error: null });
    // NRT insert
    pushResult('cached_hotel_prices', { data: null, error: null });

    mockSearchStays.mockResolvedValue([
      makeStayResult({ cheapestTotalAmount: 300 }),
    ]);

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    // CDG was filtered out — only BCN and NRT remain
    expect(body.total).toBe(2);
    expect(body.fetched).toBe(2);
    expect(mockSearchStays).toHaveBeenCalledTimes(2);
  });

  test('updates existing hotel price doc instead of inserting', async () => {
    pushResult('destinations', {
      data: [
        { id: 'd1', iata_code: 'BCN', city: 'Barcelona', latitude: 41.39, longitude: 2.17 },
      ],
      error: null,
    });

    // Existing doc for BCN
    pushResult('cached_hotel_prices', {
      data: [{ id: 'existing-bcn', destination_iata: 'BCN' }],
      error: null,
    });
    // update result
    pushResult('cached_hotel_prices', { data: null, error: null });

    mockSearchStays.mockResolvedValue([
      makeStayResult({ cheapestTotalAmount: 450 }),
    ]);

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    // Should update, not insert
    const updates = mockUpdateCalls.filter((c) => c.table === 'cached_hotel_prices');
    expect(updates).toHaveLength(1);
    expect((updates[0].data as any).price_per_night).toBe(150);
    const inserts = mockInsertCalls.filter((c) => c.table === 'cached_hotel_prices');
    expect(inserts).toHaveLength(0);
  });
});
