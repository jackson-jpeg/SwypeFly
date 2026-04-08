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
    cachedHotelPrices: 'cached_hotel_prices',
    destinationImages: 'destination_images',
    priceCalendar: 'price_calendar',
    userPreferences: 'user_preferences',
    swipeHistory: 'swipe_history',
    aiCache: 'ai_cache',
    priceHistoryStats: 'price_history_stats',
  },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('../../utils/priceStats', () => ({
  bulkGetRouteStats: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('../../services/duffel', () => ({
  searchFlights: jest.fn().mockResolvedValue({ data: { offers: [] } }),
}));

jest.mock('../../services/travelpayouts', () => ({
  fetchByPriceRange: jest.fn().mockResolvedValue([]),
  detectOriginAirport: jest.fn().mockResolvedValue(null),
  fetchPriceCalendar: jest.fn().mockResolvedValue([]),
  fetchMonthlyPrices: jest.fn().mockResolvedValue([]),
  fetchWeekMatrix: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../utils/env', () => ({
  env: {
    BOOKING_MARKUP_PERCENT: 3,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  },
}));

import handler from '../../api/feed';

// Each test uses a unique origin to avoid the in-memory cache in feed.ts
let originCounter = 0;
function uniqueOrigin(): string {
  originCounter++;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = letters[originCounter % 26];
  const b = letters[Math.floor(originCounter / 26) % 26];
  const c = letters[Math.floor(originCounter / 676) % 26];
  return `${c}${b}${a}`;
}

function makeDest(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'dest-1',
    iata_code: 'BCN',
    city: 'Barcelona',
    country: 'Spain',
    continent: 'Europe',
    tagline: 'Gothic quarter vibes',
    description: 'A beautiful city',
    image_url: 'https://example.com/bcn.jpg',
    image_urls: ['https://example.com/bcn.jpg'],
    flight_price: 450,
    hotel_price_per_night: 120,
    currency: 'USD',
    vibe_tags: ['city', 'culture', 'foodie'],
    rating: 4.7,
    review_count: 1200,
    best_months: ['May', 'June'],
    average_temp: 72,
    flight_duration: '8h 30m',
    is_active: true,
    beach_score: 0.6,
    city_score: 0.9,
    adventure_score: 0.3,
    culture_score: 0.8,
    nightlife_score: 0.7,
    nature_score: 0.2,
    food_score: 0.8,
    popularity_score: 0.85,
    ...overrides,
  };
}

/** Push empty results for the 4 parallel feed tables */
function pushEmptyParallel() {
  pushResult('price_calendar', { data: [], error: null });
  pushResult('cached_prices', { data: [], error: null });
  pushResult('cached_hotel_prices', { data: [], error: null });
  pushResult('destination_images', { data: [], error: null });
}

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

describe('GET /api/feed', () => {
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

  it('rejects invalid origin format', async () => {
    const req = makeReq({ query: { origin: 'invalid' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns paginated destinations with default origin', async () => {
    const dests = Array.from({ length: 3 }, (_, i) =>
      makeDest({ id: `dest-${i}`, iata_code: `D${i}X`, city: `City${i}` }),
    );
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const req = makeReq({ query: { origin: uniqueOrigin() } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(3);
    expect(body.nextCursor).toBeNull();
    // Verify camelCase transformation
    expect(body.destinations[0]).toHaveProperty('city');
    expect(body.destinations[0]).toHaveProperty('flightPrice');
    expect(body.destinations[0]).toHaveProperty('vibeTags');
  });

  it('applies maxPrice filter', async () => {
    const dests = [
      makeDest({ id: 'cheap', flight_price: 200 }),
      makeDest({ id: 'mid', flight_price: 500 }),
      makeDest({ id: 'expensive', flight_price: 900 }),
    ];
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, maxPrice: '400' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(1);
    // flight_price=200 + 3% markup = 206
    expect(body.destinations[0].flightPrice).toBe(206);
  });

  it('applies vibeFilter', async () => {
    const dests = [
      makeDest({ id: 'beach1', vibe_tags: ['beach', 'tropical'] }),
      makeDest({ id: 'city1', vibe_tags: ['city', 'nightlife'] }),
    ];
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, vibeFilter: 'beach' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(1);
    expect(body.destinations[0].id).toBe('beach1');
  });

  it('sorts by cheapest when sortPreset=cheapest', async () => {
    const dests = [
      makeDest({ id: 'a', flight_price: 800, city: 'A' }),
      makeDest({ id: 'b', flight_price: 200, city: 'B' }),
      makeDest({ id: 'c', flight_price: 500, city: 'C' }),
    ];
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, sortPreset: 'cheapest' } });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    // 3% markup: 200→206, 500→515, 800→824
    expect(body.destinations[0].flightPrice).toBe(206);
    expect(body.destinations[1].flightPrice).toBe(515);
    expect(body.destinations[2].flightPrice).toBe(824);
  });

  it('handles pagination with cursor', async () => {
    // First page loads PAGE_SIZE * 2 = 20 items, so we need >20 dests to trigger pagination
    const dests = Array.from({ length: 25 }, (_, i) =>
      makeDest({ id: `d-${i}`, iata_code: `X${String(i).padStart(2, '0')}`, city: `City${i}` }),
    );
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req1 = makeReq({ query: { origin, sortPreset: 'cheapest' } });
    const res1 = makeRes();
    await handler(req1, res1);
    const body1 = res1.json.mock.calls[0][0];
    expect(body1.destinations).toHaveLength(20);
    expect(body1.nextCursor).toBe('20');
  });

  it('merges live prices from cached_prices collection', async () => {
    const dests = [makeDest({ id: 'dest-bcn', iata_code: 'BCN', flight_price: 450 })];
    const prices = [
      {
        destination_iata: 'BCN',
        price: 299,
        airline: 'TAP',
        duration: '7h 15m',
        source: 'duffel',
        fetched_at: new Date().toISOString(),
        departure_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        return_date: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
        trip_duration_days: 7,
        previous_price: 350,
        price_direction: 'down',
      },
    ];
    pushResult('destinations', { data: dests, error: null });
    pushResult('price_calendar', { data: [], error: null });
    pushResult('cached_prices', { data: prices, error: null });
    pushResult('cached_hotel_prices', { data: [], error: null });
    pushResult('destination_images', { data: [], error: null });

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin } });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    // live_price=299 + 3% markup = 308
    expect(body.destinations[0].livePrice).toBe(308);
    expect(body.destinations[0].flightPrice).toBe(308);
    expect(body.destinations[0].airline).toBe('TAP');
    expect(body.destinations[0].priceDirection).toBe('down');
  });

  it('returns 500 on database error', async () => {
    pushResult('destinations', { data: null, error: new Error('DB down') });

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets Cache-Control with s-maxage for anonymous requests', async () => {
    pushResult('destinations', { data: [], error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin } });
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader).toBeDefined();
    expect(cacheHeader![1]).toContain('s-maxage');
  });

  it('filters by city name with search param', async () => {
    const dests = [
      makeDest({ id: 'bcn', city: 'Barcelona', country: 'Spain' }),
      makeDest({ id: 'par', city: 'Paris', country: 'France' }),
      makeDest({ id: 'tok', city: 'Tokyo', country: 'Japan' }),
    ];
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, search: 'barcelona' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(1);
    expect(body.destinations[0].city).toBe('Barcelona');
  });

  it('filters by country name with search param', async () => {
    const dests = [
      makeDest({ id: 'bcn2', city: 'Barcelona', country: 'Spain' }),
      makeDest({ id: 'par2', city: 'Paris', country: 'France' }),
      makeDest({ id: 'mad2', city: 'Madrid', country: 'Spain' }),
    ];
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, search: 'Spain' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(2);
    const cities = body.destinations.map((d: any) => d.city).sort();
    expect(cities).toEqual(['Barcelona', 'Madrid']);
  });

  it('excludes cheap destinations with minPrice filter', async () => {
    const dests = [
      makeDest({ id: 'cheap2', flight_price: 150 }),
      makeDest({ id: 'mid2', flight_price: 500 }),
      makeDest({ id: 'exp2', flight_price: 900 }),
    ];
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, minPrice: '400', sortPreset: 'cheapest' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(2);
    // 3% markup: 500→515, 900→927
    expect(body.destinations[0].flightPrice).toBe(515);
    expect(body.destinations[1].flightPrice).toBe(927);
  });

  it('combines minPrice and maxPrice for price range', async () => {
    const dests = [
      makeDest({ id: 'p1', flight_price: 100 }),
      makeDest({ id: 'p2', flight_price: 300 }),
      makeDest({ id: 'p3', flight_price: 600 }),
      makeDest({ id: 'p4', flight_price: 900 }),
    ];
    pushResult('destinations', { data: dests, error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, minPrice: '200', maxPrice: '700', sortPreset: 'cheapest' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(2);
    // 3% markup: 300→309, 600→618
    expect(body.destinations[0].flightPrice).toBe(309);
    expect(body.destinations[1].flightPrice).toBe(618);
  });

  it('sets no-store for session-based requests', async () => {
    pushResult('destinations', { data: [], error: null });
    pushEmptyParallel();

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, sessionId: 'abc-123' } });
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader![1]).toBe('no-store');
  });
});
