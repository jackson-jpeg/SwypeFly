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

/**
 * Build a synthetic Duffel-sourced cached_prices row for a destination.
 * Phase 4: feed excludes destinations lacking a fresh Duffel price, so
 * test fixtures must attach one per destination.
 */
let __iataCounter = 0;
function makeDuffelPrice(dest: Record<string, unknown>) {
  const price = (dest.flight_price as number) ?? 450;
  // Assign a unique IATA code per destination so that cached_prices (keyed by
  // iata_code) join 1:1 with destinations even when tests reuse the default
  // IATA across multiple fixtures.
  const n = __iataCounter++;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const iata = `${letters[Math.floor(n / 676) % 26]}${letters[Math.floor(n / 26) % 26]}${letters[n % 26]}`;
  dest.iata_code = iata;
  const now = new Date();
  const dep = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
  const ret = new Date(now.getTime() + 21 * 86400000).toISOString().split('T')[0];
  return {
    destination_iata: iata,
    price,
    airline: 'TestAir',
    duration: '8h 0m',
    source: 'duffel',
    fetched_at: now.toISOString(),
    offer_expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    departure_date: dep,
    return_date: ret,
    trip_duration_days: 7,
  };
}

/**
 * Push parallel-fetch results with Duffel prices auto-generated from the
 * destinations list so they survive the Phase 4 Duffel-only feed filter.
 */
function pushParallelWithPrices(dests: Array<Record<string, unknown>>) {
  pushResult('price_calendar', { data: [], error: null });
  pushResult('cached_prices', { data: dests.map(makeDuffelPrice), error: null });
  pushResult('cached_hotel_prices', { data: [], error: null });
  pushResult('destination_images', { data: [], error: null });
}

/**
 * Push parallel-table results. Auto-derives Duffel cached_prices from the
 * most recently pushed `destinations` queue entry so tests don't have to
 * spell them out. Phase 4 requires a fresh Duffel price per destination
 * or the feed excludes it.
 *
 * Pass `{ noPrices: true }` to keep cached_prices empty (for tests
 * asserting the Duffel-only exclusion behaviour).
 */
function pushEmptyParallel(opts: { noPrices?: boolean } = {}) {
  pushResult('price_calendar', { data: [], error: null });
  if (opts.noPrices) {
    pushResult('cached_prices', { data: [], error: null });
  } else {
    const destQueue = mockResultQueues.get('destinations');
    const lastDestsEntry = destQueue && destQueue.length > 0 ? destQueue[destQueue.length - 1] : null;
    const dests = Array.isArray(lastDestsEntry?.data) ? (lastDestsEntry!.data as Array<Record<string, unknown>>) : [];
    pushResult('cached_prices', { data: dests.map(makeDuffelPrice), error: null });
  }
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

  // ─── Pagination edge cases ─────────────────────────────────────────

  describe('pagination', () => {
    it('returns second page when cursor=20 is passed', async () => {
      const dests = Array.from({ length: 30 }, (_, i) =>
        makeDest({
          id: `pg-${i}`,
          iata_code: `P${String(i).padStart(2, '0')}`,
          city: `PageCity${i}`,
          flight_price: 100 + i * 10,
        }),
      );
      const origin = uniqueOrigin();

      // First request to populate the in-memory destCache
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();
      const req1 = makeReq({ query: { origin, sortPreset: 'cheapest' } });
      const res1 = makeRes();
      await handler(req1, res1);
      const body1 = res1.json.mock.calls[0][0];
      expect(body1.destinations).toHaveLength(20);
      expect(body1.nextCursor).toBe('20');

      // Second request with cursor=20 — uses cached destinations
      const req2 = makeReq({ query: { origin, cursor: '20', sortPreset: 'cheapest' } });
      const res2 = makeRes();
      await handler(req2, res2);
      const body2 = res2.json.mock.calls[0][0];
      expect(body2.destinations).toHaveLength(10);
      expect(body2.nextCursor).toBeNull();
    });

    it('returns null nextCursor when all results fit on first page', async () => {
      const dests = Array.from({ length: 5 }, (_, i) =>
        makeDest({
          id: `small-${i}`,
          iata_code: `S${String(i).padStart(2, '0')}`,
          city: `SmallCity${i}`,
        }),
      );
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin } });
      const res = makeRes();
      await handler(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.destinations.length).toBeLessThanOrEqual(20);
      expect(body.nextCursor).toBeNull();
    });

    it('rejects negative cursor values', async () => {
      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, cursor: '-5' } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects non-numeric cursor values', async () => {
      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, cursor: 'abc' } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── Filter edge cases ────────────────────────────────────────────

  describe('filters', () => {
    it('filters by regionFilter', async () => {
      const dests = [
        makeDest({ id: 'fr1', country: 'France', iata_code: 'CDG' }),
        makeDest({ id: 'jp1', country: 'Japan', iata_code: 'NRT' }),
        makeDest({ id: 'mx1', country: 'Mexico', iata_code: 'CUN' }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, regionFilter: 'eu-west' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(1);
      expect(body.destinations[0].country).toBe('France');
    });

    it('filters by multiple comma-separated vibes', async () => {
      const dests = [
        makeDest({ id: 'v1', vibe_tags: ['beach', 'tropical'] }),
        makeDest({ id: 'v2', vibe_tags: ['city', 'nightlife'] }),
        makeDest({ id: 'v3', vibe_tags: ['adventure', 'nature'] }),
        makeDest({ id: 'v4', vibe_tags: ['beach', 'adventure'] }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, vibeFilter: 'adventure' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(2);
      const ids = body.destinations.map((d: any) => d.id).sort();
      expect(ids).toEqual(['v3', 'v4']);
    });

    it('filters nonstop flights via vibeFilter=nonstop', async () => {
      const origin = uniqueOrigin();
      const dests = [
        makeDest({ id: 'ns1', iata_code: 'NS1', vibe_tags: ['beach'] }),
        makeDest({ id: 'ns2', iata_code: 'NS2', vibe_tags: ['beach'] }),
        makeDest({ id: 'ns3', iata_code: 'NS3', vibe_tags: ['city'] }),
      ];
      // is_nonstop comes from cached_prices, not destinations
      const prices = [
        {
          destination_iata: 'NS1', origin, price: 300, airline: 'AA',
          duration: '3h', source: 'duffel',
          fetched_at: new Date().toISOString(),
          departure_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          return_date: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
          trip_duration_days: 7, is_nonstop: true, total_stops: 0,
        },
        {
          destination_iata: 'NS2', origin, price: 400, airline: 'UA',
          duration: '5h', source: 'duffel',
          fetched_at: new Date().toISOString(),
          departure_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          return_date: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
          trip_duration_days: 7, is_nonstop: false, total_stops: 1,
        },
      ];
      pushResult('destinations', { data: dests, error: null });
      pushResult('price_calendar', { data: [], error: null });
      pushResult('cached_prices', { data: prices, error: null });
      pushResult('cached_hotel_prices', { data: [], error: null });
      pushResult('destination_images', { data: [], error: null });

      const req = makeReq({ query: { origin, vibeFilter: 'nonstop' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(1);
      expect(body.destinations[0].id).toBe('ns1');
    });

    it('filters by durationFilter=weekend (1-3 days)', async () => {
      const origin = uniqueOrigin();
      const dests = [
        makeDest({ id: 'dur1', iata_code: 'D01' }),
        makeDest({ id: 'dur2', iata_code: 'D02' }),
        makeDest({ id: 'dur3', iata_code: 'D03' }),
        makeDest({ id: 'dur4', iata_code: 'D04' }),
      ];
      // trip_duration_days comes from cached_prices
      const now = new Date();
      const futureDate = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
      const makePrice = (iata: string, days: number) => ({
        destination_iata: iata, origin, price: 300, airline: 'AA',
        duration: '4h', source: 'duffel', fetched_at: now.toISOString(),
        departure_date: futureDate,
        return_date: new Date(now.getTime() + (14 + days) * 86400000).toISOString().split('T')[0],
        trip_duration_days: days,
      });
      const prices = [
        makePrice('D01', 2),  // weekend
        makePrice('D02', 5),  // week
        makePrice('D03', 12), // extended
        // D04 has no price entry → no trip_duration_days → excluded
      ];
      pushResult('destinations', { data: dests, error: null });
      pushResult('price_calendar', { data: [], error: null });
      pushResult('cached_prices', { data: prices, error: null });
      pushResult('cached_hotel_prices', { data: [], error: null });
      pushResult('destination_images', { data: [], error: null });

      const req = makeReq({ query: { origin, durationFilter: 'weekend' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(1);
      expect(body.destinations[0].id).toBe('dur1');
    });

    it('filters by durationFilter=week (4-8 days)', async () => {
      const origin = uniqueOrigin();
      const dests = [
        makeDest({ id: 'dw1', iata_code: 'W01' }),
        makeDest({ id: 'dw2', iata_code: 'W02' }),
        makeDest({ id: 'dw3', iata_code: 'W03' }),
        makeDest({ id: 'dw4', iata_code: 'W04' }),
      ];
      const now = new Date();
      const futureDate = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
      const makePrice = (iata: string, days: number) => ({
        destination_iata: iata, origin, price: 300, airline: 'AA',
        duration: '4h', source: 'duffel', fetched_at: now.toISOString(),
        departure_date: futureDate,
        return_date: new Date(now.getTime() + (14 + days) * 86400000).toISOString().split('T')[0],
        trip_duration_days: days,
      });
      const prices = [
        makePrice('W01', 2),  // weekend
        makePrice('W02', 5),  // week
        makePrice('W03', 7),  // week
        makePrice('W04', 12), // extended
      ];
      pushResult('destinations', { data: dests, error: null });
      pushResult('price_calendar', { data: [], error: null });
      pushResult('cached_prices', { data: prices, error: null });
      pushResult('cached_hotel_prices', { data: [], error: null });
      pushResult('destination_images', { data: [], error: null });

      const req = makeReq({ query: { origin, durationFilter: 'week' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(2);
      const ids = body.destinations.map((d: any) => d.id).sort();
      expect(ids).toEqual(['dw2', 'dw3']);
    });

    it('filters by durationFilter=extended (9+ days)', async () => {
      const origin = uniqueOrigin();
      const dests = [
        makeDest({ id: 'de1', iata_code: 'E01' }),
        makeDest({ id: 'de2', iata_code: 'E02' }),
        makeDest({ id: 'de3', iata_code: 'E03' }),
        makeDest({ id: 'de4', iata_code: 'E04' }),
      ];
      const now = new Date();
      const futureDate = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
      const makePrice = (iata: string, days: number) => ({
        destination_iata: iata, origin, price: 300, airline: 'AA',
        duration: '4h', source: 'duffel', fetched_at: now.toISOString(),
        departure_date: futureDate,
        return_date: new Date(now.getTime() + (14 + days) * 86400000).toISOString().split('T')[0],
        trip_duration_days: days,
      });
      const prices = [
        makePrice('E01', 3),  // weekend
        makePrice('E02', 7),  // week
        makePrice('E03', 10), // extended
        makePrice('E04', 14), // extended
      ];
      pushResult('destinations', { data: dests, error: null });
      pushResult('price_calendar', { data: [], error: null });
      pushResult('cached_prices', { data: prices, error: null });
      pushResult('cached_hotel_prices', { data: [], error: null });
      pushResult('destination_images', { data: [], error: null });

      const req = makeReq({ query: { origin, durationFilter: 'extended' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(2);
      const ids = body.destinations.map((d: any) => d.id).sort();
      expect(ids).toEqual(['de3', 'de4']);
    });

    it('excludes destinations by excludeIds', async () => {
      const dests = [
        makeDest({ id: 'ex1', iata_code: 'AA1', city: 'Alpha' }),
        makeDest({ id: 'ex2', iata_code: 'BB1', city: 'Beta' }),
        makeDest({ id: 'ex3', iata_code: 'CC1', city: 'Gamma' }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, excludeIds: 'ex1,ex3' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(1);
      expect(body.destinations[0].id).toBe('ex2');
    });

    it('filters out low deal_score destinations (< 30)', async () => {
      const origin = uniqueOrigin();
      const dests = [
        makeDest({ id: 'ds1', iata_code: 'Q01' }),
        makeDest({ id: 'ds2', iata_code: 'Q02' }),
        makeDest({ id: 'ds3', iata_code: 'Q03' }),
        makeDest({ id: 'ds4', iata_code: 'Q04' }),
      ];
      // deal_score comes from cached_prices
      const now = new Date();
      const futureDate = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
      const returnDate = new Date(now.getTime() + 21 * 86400000).toISOString().split('T')[0];
      const prices = [
        { destination_iata: 'Q01', origin, price: 300, airline: 'AA', duration: '4h', source: 'duffel', fetched_at: now.toISOString(), departure_date: futureDate, return_date: returnDate, trip_duration_days: 7, deal_score: 80 },
        { destination_iata: 'Q02', origin, price: 300, airline: 'AA', duration: '4h', source: 'duffel', fetched_at: now.toISOString(), departure_date: futureDate, return_date: returnDate, trip_duration_days: 7, deal_score: 15 },
        // Q03 has no price entry → Phase 4 excludes it from the feed (Duffel-only)
        { destination_iata: 'Q04', origin, price: 300, airline: 'AA', duration: '4h', source: 'duffel', fetched_at: now.toISOString(), departure_date: futureDate, return_date: returnDate, trip_duration_days: 7, deal_score: 30 },
      ];
      pushResult('destinations', { data: dests, error: null });
      pushResult('price_calendar', { data: [], error: null });
      pushResult('cached_prices', { data: prices, error: null });
      pushResult('cached_hotel_prices', { data: [], error: null });
      pushResult('destination_images', { data: [], error: null });

      const req = makeReq({ query: { origin } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      const ids = body.destinations.map((d: any) => d.id);
      expect(ids).toContain('ds1');
      expect(ids).not.toContain('ds2');
      // Phase 4: destinations without a Duffel cached price are excluded
      // from the feed (no Travelpayouts/indicative fallback).
      expect(ids).not.toContain('ds3');
      expect(ids).toContain('ds4');
    });

    it('returns count when countOnly=true', async () => {
      const dests = [
        makeDest({ id: 'co1', vibe_tags: ['beach'] }),
        makeDest({ id: 'co2', vibe_tags: ['city'] }),
        makeDest({ id: 'co3', vibe_tags: ['beach', 'tropical'] }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, vibeFilter: 'beach', countOnly: 'true' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.count).toBe(2);
      expect(body.destinations).toBeUndefined();
    });
  });

  // ─── Sort presets ─────────────────────────────────────────────────

  describe('sort presets', () => {
    it('sorts by trending (popularity_score descending)', async () => {
      const dests = [
        makeDest({ id: 'tr1', popularity_score: 0.3, city: 'Low' }),
        makeDest({ id: 'tr2', popularity_score: 0.95, city: 'High' }),
        makeDest({ id: 'tr3', popularity_score: 0.6, city: 'Mid' }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, sortPreset: 'trending' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations[0].city).toBe('High');
      expect(body.destinations[1].city).toBe('Mid');
      expect(body.destinations[2].city).toBe('Low');
    });

    it('sorts by best-deals (deal_score descending)', async () => {
      const origin = uniqueOrigin();
      const dests = [
        makeDest({ id: 'bd1', iata_code: 'BD1', city: 'Fair' }),
        makeDest({ id: 'bd2', iata_code: 'BD2', city: 'Amazing' }),
        makeDest({ id: 'bd3', iata_code: 'BD3', city: 'Great' }),
      ];
      const now = new Date();
      const futureDate = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
      const returnDate = new Date(now.getTime() + 21 * 86400000).toISOString().split('T')[0];
      const prices = [
        { destination_iata: 'BD1', origin, price: 300, airline: 'AA', duration: '4h', source: 'duffel', fetched_at: now.toISOString(), departure_date: futureDate, return_date: returnDate, trip_duration_days: 7, deal_score: 40 },
        { destination_iata: 'BD2', origin, price: 300, airline: 'AA', duration: '4h', source: 'duffel', fetched_at: now.toISOString(), departure_date: futureDate, return_date: returnDate, trip_duration_days: 7, deal_score: 95 },
        { destination_iata: 'BD3', origin, price: 300, airline: 'AA', duration: '4h', source: 'duffel', fetched_at: now.toISOString(), departure_date: futureDate, return_date: returnDate, trip_duration_days: 7, deal_score: 70 },
      ];
      pushResult('destinations', { data: dests, error: null });
      pushResult('price_calendar', { data: [], error: null });
      pushResult('cached_prices', { data: prices, error: null });
      pushResult('cached_hotel_prices', { data: [], error: null });
      pushResult('destination_images', { data: [], error: null });

      const req = makeReq({ query: { origin, sortPreset: 'best-deals' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations[0].city).toBe('Amazing');
      expect(body.destinations[1].city).toBe('Great');
      expect(body.destinations[2].city).toBe('Fair');
    });

    it('cheapest sort excludes destinations with zero price', async () => {
      const dests = [
        makeDest({ id: 'zp1', flight_price: 0, city: 'Free' }),
        makeDest({ id: 'zp2', flight_price: 300, city: 'Mid' }),
        makeDest({ id: 'zp3', flight_price: 100, city: 'Cheap' }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, sortPreset: 'cheapest' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      // Zero-price destination should be filtered out by cheapest sort
      const cities = body.destinations.map((d: any) => d.city);
      expect(cities).not.toContain('Free');
      expect(body.destinations[0].city).toBe('Cheap');
    });
  });

  // ─── Search edge cases ────────────────────────────────────────────

  describe('search', () => {
    it('search matches vibe tags', async () => {
      const dests = [
        makeDest({ id: 'sv1', city: 'Rome', vibe_tags: ['culture', 'foodie', 'historic'] }),
        makeDest({ id: 'sv2', city: 'Cancun', vibe_tags: ['beach', 'nightlife'] }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, search: 'foodie' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(1);
      expect(body.destinations[0].city).toBe('Rome');
    });

    it('search is case-insensitive', async () => {
      const dests = [
        makeDest({ id: 'ci1', city: 'Tokyo', country: 'Japan' }),
        makeDest({ id: 'ci2', city: 'Berlin', country: 'Germany' }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, search: 'JAPAN' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(1);
      expect(body.destinations[0].city).toBe('Tokyo');
    });

    it('search with no matches returns empty', async () => {
      const dests = [
        makeDest({ id: 'nm1', city: 'Paris', country: 'France' }),
        makeDest({ id: 'nm2', city: 'London', country: 'United Kingdom' }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, search: 'zzzznotexist' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(0);
    });

    it('search matches partial city names', async () => {
      const dests = [
        makeDest({ id: 'pc1', city: 'Barcelona', country: 'Spain' }),
        makeDest({ id: 'pc2', city: 'Barranquilla', country: 'Colombia' }),
        makeDest({ id: 'pc3', city: 'Paris', country: 'France' }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, search: 'bar' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(2);
      const cities = body.destinations.map((d: any) => d.city).sort();
      expect(cities).toEqual(['Barcelona', 'Barranquilla']);
    });
  });

  // ─── Error handling ───────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 500 when destinations query throws', async () => {
      pushResult('destinations', { data: null, error: new Error('Connection refused') });

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('returns 429 when rate limited', async () => {
      const { checkRateLimit } = require('../../utils/rateLimit');
      checkRateLimit.mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
      });

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('gracefully handles parallel query failures (prices, images)', async () => {
      const dests = [makeDest({ id: 'gh1', flight_price: 300 })];
      pushResult('destinations', { data: dests, error: null });
      // Push errors for parallel queries — they should not crash the handler
      pushResult('price_calendar', { data: null, error: new Error('timeout') });
      pushResult('cached_prices', { data: null, error: new Error('timeout') });
      pushResult('cached_hotel_prices', { data: null, error: new Error('timeout') });
      pushResult('destination_images', { data: null, error: new Error('timeout') });

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin } });
      const res = makeRes();
      await handler(req, res);

      // Should still return 200 with the base destination data
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── Empty results ────────────────────────────────────────────────

  describe('empty results', () => {
    it('returns empty array when no destinations exist', async () => {
      pushResult('destinations', { data: [], error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it('returns empty array when all destinations are filtered out by maxPrice', async () => {
      const dests = [
        makeDest({ id: 'ep1', flight_price: 500 }),
        makeDest({ id: 'ep2', flight_price: 800 }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, maxPrice: '50' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(0);
    });

    it('returns empty array when vibeFilter matches nothing', async () => {
      const dests = [
        makeDest({ id: 'ev1', vibe_tags: ['city', 'culture'] }),
        makeDest({ id: 'ev2', vibe_tags: ['nightlife'] }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, vibeFilter: 'beach' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(0);
    });

    it('returns empty array when regionFilter matches nothing', async () => {
      const dests = [
        makeDest({ id: 'er1', country: 'France' }),
        makeDest({ id: 'er2', country: 'Spain' }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, regionFilter: 'asia-east' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(0);
    });

    it('returns empty array when durationFilter matches nothing', async () => {
      const origin = uniqueOrigin();
      const dests = [
        makeDest({ id: 'ed1', iata_code: 'F01' }),
        makeDest({ id: 'ed2', iata_code: 'F02' }),
      ];
      const now = new Date();
      const futureDate = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];
      const returnDate = new Date(now.getTime() + 21 * 86400000).toISOString().split('T')[0];
      // Both have week-length trips — extended filter should match nothing
      const prices = [
        { destination_iata: 'F01', origin, price: 300, airline: 'AA', duration: '4h', source: 'duffel', fetched_at: now.toISOString(), departure_date: futureDate, return_date: returnDate, trip_duration_days: 7 },
        { destination_iata: 'F02', origin, price: 400, airline: 'UA', duration: '5h', source: 'duffel', fetched_at: now.toISOString(), departure_date: futureDate, return_date: returnDate, trip_duration_days: 5 },
      ];
      pushResult('destinations', { data: dests, error: null });
      pushResult('price_calendar', { data: [], error: null });
      pushResult('cached_prices', { data: prices, error: null });
      pushResult('cached_hotel_prices', { data: [], error: null });
      pushResult('destination_images', { data: [], error: null });

      const req = makeReq({ query: { origin, durationFilter: 'extended' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(0);
    });
  });

  // ─── Combined filters ────────────────────────────────────────────

  describe('combined filters', () => {
    it('applies vibeFilter + maxPrice together', async () => {
      const dests = [
        makeDest({ id: 'cf1', vibe_tags: ['beach'], flight_price: 200 }),
        makeDest({ id: 'cf2', vibe_tags: ['beach'], flight_price: 800 }),
        makeDest({ id: 'cf3', vibe_tags: ['city'], flight_price: 200 }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, vibeFilter: 'beach', maxPrice: '500' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(1);
      expect(body.destinations[0].id).toBe('cf1');
    });

    it('applies search + sortPreset together', async () => {
      const dests = [
        makeDest({ id: 'cs1', city: 'Madrid', country: 'Spain', flight_price: 600 }),
        makeDest({ id: 'cs2', city: 'Malaga', country: 'Spain', flight_price: 200 }),
        makeDest({ id: 'cs3', city: 'Tokyo', country: 'Japan', flight_price: 100 }),
      ];
      pushResult('destinations', { data: dests, error: null });
      pushEmptyParallel();

      const origin = uniqueOrigin();
      const req = makeReq({ query: { origin, search: 'spain', sortPreset: 'cheapest' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.destinations).toHaveLength(2);
      // Malaga (200+markup=206) should come before Madrid (600+markup=618)
      expect(body.destinations[0].city).toBe('Malaga');
      expect(body.destinations[1].city).toBe('Madrid');
    });
  });
});
