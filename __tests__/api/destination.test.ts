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

const mockInsertCalls: Array<{ table: string; data: unknown }> = [];
const mockUpdateCalls: Array<{ table: string; data: unknown }> = [];
const mockUpsertCalls: Array<{ table: string; data: unknown; options?: unknown }> = [];

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
  chain.upsert = jest.fn().mockImplementation((data: unknown, options?: unknown) => {
    mockUpsertCalls.push({ table, data, options });
    return chain;
  });
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

jest.mock('../../services/travelpayouts', () => ({
  fetchPriceCalendar: jest.fn().mockResolvedValue([]),
  fetchMonthlyPrices: jest.fn().mockResolvedValue([]),
  fetchWeekMatrix: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/duffel', () => ({
  searchFlights: jest.fn().mockResolvedValue({ data: { offers: [] } }),
}));

import handler from '../../api/destination';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeDest(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    iata_code: 'BCN',
    city: 'Barcelona',
    country: 'Spain',
    tagline: 'Gothic quarter vibes',
    description: 'A beautiful city',
    image_url: 'https://example.com/bcn.jpg',
    image_urls: ['https://example.com/bcn.jpg'],
    flight_price: 450,
    hotel_price_per_night: 120,
    currency: 'USD',
    vibe_tags: ['city', 'culture'],
    rating: 4.7,
    review_count: 1200,
    best_months: ['May', 'June'],
    average_temp: 72,
    flight_duration: '8h 30m',
    available_flight_days: ['Mon', 'Wed', 'Fri'],
    ...overrides,
  };
}

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    body: {},
    query: { id: VALID_UUID, origin: 'JFK' },
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

/** Push empty results for the parallel tables in destination handler's Promise.all:
 *  [allPrices (cached_prices), hotelPrices (cached_hotel_prices), images (destination_images), similar (destinations)]
 */
function pushEmptyParallel() {
  pushResult('cached_prices', { data: [], error: null });
  pushResult('cached_hotel_prices', { data: [], error: null });
  pushResult('destination_images', { data: [], error: null });
  pushResult('destinations', { data: [], error: null });
}

describe('GET /api/destination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    mockInsertCalls.length = 0;
    mockUpdateCalls.length = 0;
    mockUpsertCalls.length = 0;
  });

  it('rejects non-GET methods', async () => {
    const req = makeReq({ method: 'POST' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects missing id', async () => {
    const req = makeReq({ query: { origin: 'JFK' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when destination not found', async () => {
    // .single() pops from destinations queue — push an error
    pushResult('destinations', { data: null, error: new Error('Not found') });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns destination with camelCase keys', async () => {
    // 1. Destination lookup via .single()
    pushResult('destinations', { data: makeDest(), error: null });
    // 2. Cached price lookup (via .then — chain await)
    pushResult('cached_prices', { data: [], error: null });
    // 3. Promise.all: [allPrices, hotelPrices, images, similar]
    pushEmptyParallel();

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.id).toBe(VALID_UUID);
    expect(body.city).toBe('Barcelona');
    // withMarkup(450) = Math.round(450 * 1.03) = 464
    expect(body.flightPrice).toBe(464);
    expect(body.vibeTags).toEqual(['city', 'culture']);
    expect(body.livePrice).toBeNull();
    expect(body.priceSource).toBe('estimate');
  });

  it('merges live price when available', async () => {
    // 1. Destination lookup via .single()
    pushResult('destinations', { data: makeDest(), error: null });
    // 2. Cached price lookup
    pushResult('cached_prices', {
      data: [
        {
          origin: 'JFK',
          destination_iata: 'BCN',
          price: 299,
          airline: 'TAP',
          duration: '7h 15m',
          source: 'travelpayouts',
          fetched_at: '2026-02-26T00:00:00Z',
          departure_date: '2026-04-01',
          return_date: '2026-04-08',
          trip_duration_days: 7,
          previous_price: 350,
          price_direction: 'down',
        },
      ],
      error: null,
    });
    // 3. Promise.all: [allPrices, hotelPrices, images, similar]
    pushEmptyParallel();

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    // withMarkup(299) = Math.round(299 * 1.03) = 308
    expect(body.livePrice).toBe(308);
    expect(body.flightPrice).toBe(308);
    expect(body.airline).toBe('TAP');
    expect(body.priceDirection).toBe('down');
    expect(body.priceSource).toBe('travelpayouts');
  });

  it('includes otherPrices from different origins', async () => {
    // 1. Destination lookup via .single()
    pushResult('destinations', { data: makeDest(), error: null });
    // 2. Cached price for this origin (empty)
    pushResult('cached_prices', { data: [], error: null });
    // 3. Promise.all: [allPrices, hotelPrices, images, similar]
    pushResult('cached_prices', {
      data: [
        { origin: 'LAX', destination_iata: 'BCN', price: 399, source: 'travelpayouts' },
        { origin: 'ORD', destination_iata: 'BCN', price: 450, source: 'amadeus' },
      ],
      error: null,
    });
    pushResult('cached_hotel_prices', { data: [], error: null });
    pushResult('destination_images', { data: [], error: null });
    pushResult('destinations', { data: [], error: null }); // similar destinations

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.otherPrices).toHaveLength(2);
    expect(body.otherPrices[0].origin).toBe('LAX');
    expect(body.otherPrices[0].price).toBe(399);
  });

  it('defaults origin to TPA when not provided', async () => {
    // 1. Destination lookup via .single()
    pushResult('destinations', { data: makeDest(), error: null });
    // 2. Cached price lookup
    pushResult('cached_prices', { data: [], error: null });
    // 3. Promise.all
    pushEmptyParallel();

    const req = makeReq({ query: { id: VALID_UUID } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sets Cache-Control header', async () => {
    // 1. Destination lookup via .single()
    pushResult('destinations', { data: makeDest(), error: null });
    // 2. Cached price lookup
    pushResult('cached_prices', { data: [], error: null });
    // 3. Promise.all
    pushEmptyParallel();

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader).toBeDefined();
    expect(cacheHeader![1]).toContain('s-maxage');
  });
});
