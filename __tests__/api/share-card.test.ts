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

import handler from '../../api/share-card';

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

describe('GET /api/share-card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
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

  it('sets 1-hour cache headers on response', async () => {
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

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader).toBeDefined();
    expect(cacheHeader![1]).toContain('s-maxage=3600');
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
});
