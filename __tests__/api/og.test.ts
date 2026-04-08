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

const mockArrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
jest.mock('@vercel/og', () => ({
  ImageResponse: jest.fn().mockImplementation(() => ({
    arrayBuffer: mockArrayBuffer,
  })),
}));

import handler from '../../api/og';

function makeReq(query: Record<string, string> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
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

describe('GET /api/og', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
  });

  it('returns PNG with default content when no params', async () => {
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('returns PNG with query params for city, country, price', async () => {
    const req = makeReq({ city: 'Paris', country: 'France', price: '299' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('fetches destination by id from database', async () => {
    pushResult('destinations', {
      data: {
        city: 'Tokyo',
        country: 'Japan',
        tagline: 'Neon lights and ancient temples',
        image_url: 'https://example.com/tokyo.jpg',
        flight_price: 650,
        live_price: null,
        rating: 4.8,
        flight_duration: '14h',
        hotel_price_per_night: 90,
      },
      error: null,
    });
    // Empty price_calendar result
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq({ id: 'dest-123' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    // Verify DB was queried
    expect(mockFrom).toHaveBeenCalledWith('destinations');
    expect(mockFrom).toHaveBeenCalledWith('price_calendar');
  });

  it('falls back gracefully when destination not found', async () => {
    pushResult('destinations', { data: null, error: new Error('Not found') });

    const req = makeReq({ id: 'nonexistent' });
    const res = makeRes();
    await handler(req, res);

    // Handler catches DB error, uses defaults, still generates PNG
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('sets long cache headers', async () => {
    const req = makeReq({ city: 'Test' });
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader![1]).toContain('s-maxage=86400');
  });

  it('returns 302 redirect when image generation fails', async () => {
    mockArrayBuffer.mockRejectedValueOnce(new Error('generation failed'));

    const req = makeReq({ city: 'Test' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(302);
  });
});
