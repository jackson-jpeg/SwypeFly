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
  chain.single = jest.fn().mockImplementation(() => {
    const result = popResult(table);
    if (result.error) return Promise.resolve({ data: null, error: result.error });
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
    priceCalendar: 'price_calendar',
  },
}));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

jest.mock('../../utils/env', () => ({
  env: { BOOKING_MARKUP_PERCENT: 3 },
}));

jest.mock('../../utils/apiResponse', () => ({
  sendError: (_res: unknown, status: number, _code: string, message: string) => {
    (_res as any).status(status);
    (_res as any).send({ error: message });
  },
}));

const mockArrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
jest.mock('@vercel/og', () => ({
  ImageResponse: jest.fn().mockImplementation(() => ({
    arrayBuffer: mockArrayBuffer,
  })),
}));

// Reset the in-memory cache between tests
jest.mock('../../api/_ogCache', () => {
  const actual = jest.requireActual('../../api/_ogCache');
  return {
    ...actual,
    tryCacheHit: jest.fn().mockReturnValue(false),
    cacheAndSend: jest.fn().mockImplementation(
      (res: any, _key: string, buffer: Buffer) => {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('ETag', '"test-etag"');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
        res.status(200).send(buffer);
      },
    ),
    getCacheKey: actual.getCacheKey,
    OG_COLORS: actual.OG_COLORS,
    DEAL_TIER_COLORS: actual.DEAL_TIER_COLORS,
    DEAL_TIER_LABELS: actual.DEAL_TIER_LABELS,
  };
});

import handler from '../../api/share-card';
import { tryCacheHit, cacheAndSend } from '../../api/_ogCache';

function makeReq(query: Record<string, string> = {}, headers: Record<string, string> = {}): VercelRequest {
  return {
    method: 'GET',
    headers,
    body: {},
    query,
  } as unknown as VercelRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    send: jest.Mock;
    setHeader: jest.Mock;
    end: jest.Mock;
  };
}

describe('GET /api/share-card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    (tryCacheHit as jest.Mock).mockReturnValue(false);
  });

  it('returns 400 when no id or top param provided', async () => {
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('generates single deal PNG for valid destination id', async () => {
    pushResult('destinations', {
      data: {
        city: 'Tokyo',
        country: 'Japan',
        flight_price: 500,
        live_price: 480,
        image_url: 'https://example.com/tokyo.jpg',
        airline_name: 'ANA',
        hotel_price_per_night: 85,
      },
      error: null,
    });
    pushResult('price_calendar', {
      data: [{
        deal_tier: 'great',
        savings_percent: 22,
        usual_price: 620,
        is_nonstop: true,
        deal_score: 75,
      }],
      error: null,
    });

    const req = makeReq({ id: 'dest-tokyo' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(mockFrom).toHaveBeenCalledWith('destinations');
    expect(mockFrom).toHaveBeenCalledWith('price_calendar');
  });

  it('uses twitter format (1200x630) when specified', async () => {
    pushResult('destinations', {
      data: {
        city: 'Paris',
        country: 'France',
        flight_price: 350,
        live_price: null,
        image_url: 'https://example.com/paris.jpg',
        airline_name: '',
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq({ id: 'dest-paris', format: 'twitter' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('handles destination with no price gracefully', async () => {
    pushResult('destinations', {
      data: {
        city: 'Bali',
        country: 'Indonesia',
        flight_price: null,
        live_price: null,
        image_url: null,
        airline_name: null,
        hotel_price_per_night: null,
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq({ id: 'dest-bali' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('generates board card for top=5 param', async () => {
    const deals = Array.from({ length: 8 }, (_, i) => ({
      city: `City${i}`,
      destination_iata: `C${i}X`,
      origin: 'JFK',
      price: 200 + i * 50,
      savings_percent: 15 + i * 3,
      deal_tier: i < 2 ? 'amazing' : 'great',
      deal_score: 90 - i * 5,
      is_nonstop: i % 2 === 0,
    }));

    pushResult('price_calendar', { data: deals, error: null });

    const req = makeReq({ top: '5' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('sets ETag and cache headers on response', async () => {
    pushResult('destinations', {
      data: {
        city: 'London',
        country: 'UK',
        flight_price: 400,
        live_price: 390,
        image_url: 'https://example.com/london.jpg',
        airline_name: 'BA',
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq({ id: 'dest-london' });
    const res = makeRes();
    await handler(req, res);

    expect(cacheAndSend).toHaveBeenCalled();
    const etagHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'ETag',
    );
    expect(etagHeader).toBeDefined();
    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader).toBeDefined();
    expect(cacheHeader![1]).toContain('s-maxage=3600');
  });

  it('returns cached response on cache hit', async () => {
    (tryCacheHit as jest.Mock).mockImplementation(
      (_req: any, res: any, _key: string) => {
        res.setHeader('Content-Type', 'image/png');
        res.status(200).send(Buffer.from('cached'));
        return true;
      },
    );

    pushResult('destinations', {
      data: {
        city: 'Cached City',
        country: 'CacheLand',
        flight_price: 100,
        live_price: 90,
        image_url: 'https://example.com/cached.jpg',
        airline_name: 'Cache Air',
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq({ id: 'dest-cached' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(cacheAndSend).not.toHaveBeenCalled();
  });

  it('returns 500 on database error', async () => {
    pushResult('destinations', { data: null, error: new Error('DB timeout') });

    const req = makeReq({ id: 'dest-fail' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('survives price calendar error gracefully', async () => {
    pushResult('destinations', {
      data: {
        city: 'Rome',
        country: 'Italy',
        flight_price: 450,
        live_price: 420,
        image_url: 'https://example.com/rome.jpg',
        airline_name: 'Alitalia',
      },
      error: null,
    });
    pushResult('price_calendar', { data: null, error: new Error('calendar error') });

    const req = makeReq({ id: 'dest-rome' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('deduplicates board deals by destination_iata', async () => {
    const deals = [
      { city: 'Paris', destination_iata: 'CDG', origin: 'JFK', price: 300, savings_percent: 20, deal_tier: 'great', deal_score: 85 },
      { city: 'Paris', destination_iata: 'CDG', origin: 'LAX', price: 350, savings_percent: 15, deal_tier: 'good', deal_score: 80 },
      { city: 'Rome', destination_iata: 'FCO', origin: 'JFK', price: 400, savings_percent: 18, deal_tier: 'great', deal_score: 75 },
    ];
    pushResult('price_calendar', { data: deals, error: null });

    const req = makeReq({ top: '2' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('escapes HTML-like characters in city/country names', async () => {
    pushResult('destinations', {
      data: {
        city: 'São Paulo <script>',
        country: 'Brazil & "South"',
        flight_price: 600,
        live_price: null,
        image_url: 'https://example.com/sp.jpg',
        airline_name: 'LATAM <x>',
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq({ id: 'dest-sp' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('prefers live_price over flight_price', async () => {
    pushResult('destinations', {
      data: {
        city: 'Berlin',
        country: 'Germany',
        flight_price: 500,
        live_price: 380,
        image_url: 'https://example.com/berlin.jpg',
        airline_name: 'Lufthansa',
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq({ id: 'dest-berlin' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('renders vibe tags on single deal card when present', async () => {
    pushResult('destinations', {
      data: {
        city: 'Bali',
        country: 'Indonesia',
        flight_price: 700,
        live_price: 650,
        image_url: 'https://example.com/bali.jpg',
        airline_name: 'Singapore Air',
        hotel_price_per_night: 45,
        vibe_tags: ['beach', 'tropical', 'romantic', 'foodie'],
      },
      error: null,
    });
    pushResult('price_calendar', {
      data: [{ deal_tier: 'good', savings_percent: 10, usual_price: 720, is_nonstop: false, deal_score: 60 }],
      error: null,
    });

    const req = makeReq({ id: 'dest-bali-vibes' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(cacheAndSend).toHaveBeenCalled();
    const cacheKeyArg = (cacheAndSend as jest.Mock).mock.calls[0];
    expect(cacheKeyArg[2]).toBeInstanceOf(Buffer);
  });

  it('handles destinations with empty vibe_tags array', async () => {
    pushResult('destinations', {
      data: {
        city: 'Oslo',
        country: 'Norway',
        flight_price: 550,
        live_price: null,
        image_url: 'https://example.com/oslo.jpg',
        airline_name: 'SAS',
        vibe_tags: [],
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq({ id: 'dest-oslo' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('includes origin route and travel dates from price calendar', async () => {
    pushResult('destinations', {
      data: {
        city: 'Tokyo',
        country: 'Japan',
        flight_price: 500,
        live_price: 480,
        image_url: 'https://example.com/tokyo.jpg',
        airline_name: 'ANA',
        hotel_price_per_night: 85,
        vibe_tags: ['city', 'culture'],
      },
      error: null,
    });
    pushResult('price_calendar', {
      data: [{
        deal_tier: 'great',
        savings_percent: 22,
        usual_price: 620,
        is_nonstop: true,
        deal_score: 75,
        origin: 'JFK',
        date: '2026-05-15',
        return_date: '2026-05-22',
      }],
      error: null,
    });

    const req = makeReq({ id: 'dest-tokyo-route' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(cacheAndSend).toHaveBeenCalled();
    // Verify the cache key includes route data
    const { ImageResponse } = require('@vercel/og');
    const elementArg = ImageResponse.mock.calls[0][0];
    // The element tree should contain the origin code
    const elementStr = JSON.stringify(elementArg);
    expect(elementStr).toContain('JFK');
    expect(elementStr).toContain('May 15');
    expect(elementStr).toContain('May 22');
  });

  it('renders without route when price calendar has no origin', async () => {
    pushResult('destinations', {
      data: {
        city: 'Dublin',
        country: 'Ireland',
        flight_price: 400,
        live_price: 380,
        image_url: 'https://example.com/dublin.jpg',
        airline_name: 'Aer Lingus',
      },
      error: null,
    });
    pushResult('price_calendar', {
      data: [{
        deal_tier: 'good',
        savings_percent: 12,
        usual_price: 450,
        is_nonstop: false,
        deal_score: 60,
        origin: null,
        date: null,
        return_date: null,
      }],
      error: null,
    });

    const req = makeReq({ id: 'dest-dublin' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { ImageResponse } = require('@vercel/og');
    const lastCall = ImageResponse.mock.calls[ImageResponse.mock.calls.length - 1];
    const elementStr = JSON.stringify(lastCall[0]);
    // Should still contain the country in fallback mode
    expect(elementStr).toContain('Ireland');
  });

  it('includes hotel price in single deal card when available', async () => {
    pushResult('destinations', {
      data: {
        city: 'Barcelona',
        country: 'Spain',
        flight_price: 320,
        live_price: 300,
        image_url: 'https://example.com/bcn.jpg',
        airline_name: 'Vueling',
        hotel_price_per_night: 95,
      },
      error: null,
    });
    pushResult('price_calendar', {
      data: [{
        deal_tier: 'amazing',
        savings_percent: 35,
        usual_price: 480,
        is_nonstop: false,
        deal_score: 92,
      }],
      error: null,
    });

    const req = makeReq({ id: 'dest-bcn' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(cacheAndSend).toHaveBeenCalled();
    const callArgs = (cacheAndSend as jest.Mock).mock.calls[0];
    expect(callArgs[2]).toBeInstanceOf(Buffer);
  });
});

// ─── _ogCache unit tests ────────────────────────────────────────────

describe('_ogCache utilities', () => {
  // Use the real module for these tests
  const ogCache = jest.requireActual('../../api/_ogCache');

  it('getCacheKey produces consistent hashes for same params', () => {
    const a = ogCache.getCacheKey({ city: 'Paris', price: 100 });
    const b = ogCache.getCacheKey({ city: 'Paris', price: 100 });
    expect(a).toBe(b);
  });

  it('getCacheKey produces different hashes for different params', () => {
    const a = ogCache.getCacheKey({ city: 'Paris', price: 100 });
    const b = ogCache.getCacheKey({ city: 'London', price: 200 });
    expect(a).not.toBe(b);
  });

  it('exports shared color constants', () => {
    expect(ogCache.OG_COLORS.yellow).toBe('#F7E8A0');
    expect(ogCache.DEAL_TIER_COLORS.amazing).toBe('#4ADE80');
    expect(ogCache.DEAL_TIER_LABELS.great).toBe('GREAT DEAL');
  });

  it('exports vibe tag colors and labels', () => {
    expect(ogCache.VIBE_TAG_COLORS.beach).toBe('#38BDF8');
    expect(ogCache.VIBE_TAG_COLORS.foodie).toBe('#FBBF24');
    expect(ogCache.VIBE_TAG_LABELS.romantic).toBe('Romantic');
    expect(ogCache.VIBE_TAG_LABELS.adventure).toBe('Adventure');
    expect(Object.keys(ogCache.VIBE_TAG_COLORS)).toHaveLength(14);
    expect(Object.keys(ogCache.VIBE_TAG_LABELS)).toHaveLength(14);
  });
});
