// __tests__/api/feed-countOnly.test.ts
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
    trip_duration_days: 5,
    ...overrides,
  };
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

describe('feed countOnly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    mockInsertCalls.length = 0;
    mockUpdateCalls.length = 0;
    mockUpsertCalls.length = 0;
  });

  it('returns count instead of full results when countOnly=true', async () => {
    const dests = [
      makeDest({ id: 'co-1', flight_price: 200, vibe_tags: ['beach'] }),
      makeDest({ id: 'co-2', flight_price: 600, vibe_tags: ['city'] }),
      makeDest({ id: 'co-3', flight_price: 100, vibe_tags: ['beach'] }),
    ];

    pushResult('destinations', { data: dests, error: null });
    pushResult('price_calendar', { data: [], error: null });
    pushResult('cached_prices', { data: [], error: null });
    pushResult('cached_hotel_prices', { data: [], error: null });
    pushResult('destination_images', { data: [], error: null });

    const req = makeReq({ query: { origin: 'QQQ', countOnly: 'true', maxPrice: '300' } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ count: 2 });
  });
});
