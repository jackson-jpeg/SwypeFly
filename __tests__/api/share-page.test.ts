import type { VercelRequest, VercelResponse } from '@vercel/node';

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

import handler from '../../api/share/[id]';

function makeReq(
  id: string,
  userAgent = 'Twitterbot/1.0',
): VercelRequest {
  return {
    method: 'GET',
    headers: { 'user-agent': userAgent },
    body: {},
    query: { id },
  } as unknown as VercelRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    send: jest.Mock;
    setHeader: jest.Mock;
    redirect: jest.Mock;
  };
}

describe('GET /api/share/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
  });

  it('redirects real users (non-bot) to SPA destination page', async () => {
    const req = makeReq('dest-123', 'Mozilla/5.0 Chrome');
    const res = makeRes();
    await handler(req, res);
    expect(res.redirect).toHaveBeenCalledWith(302, '/destination/dest-123');
  });

  it('returns HTML with OG tags for bot user agents', async () => {
    pushResult('destinations', {
      data: {
        city: 'Tokyo',
        country: 'Japan',
        tagline: 'Neon lights',
        flight_price: 500,
        live_price: 480,
        hotel_price_per_night: 90,
        airline_name: 'ANA',
      },
      error: null,
    });
    pushResult('price_calendar', {
      data: [{
        deal_tier: 'amazing',
        savings_percent: 30,
        deal_score: 95,
      }],
      error: null,
    });

    const req = makeReq('dest-tokyo', 'Twitterbot/1.0');
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('og:title');
    expect(html).toContain('Tokyo');
    expect(html).toContain('og:image');
    expect(html).toContain('/api/og?id=dest-tokyo');
    expect(html).toContain('Incredible Deal');
    expect(html).toContain('30% below average');
    expect(html).toContain('og:image:width');
    expect(html).toContain('application/ld+json');
  });

  it('includes live_price in OG title when available', async () => {
    pushResult('destinations', {
      data: {
        city: 'Paris',
        country: 'France',
        tagline: 'City of light',
        flight_price: 600,
        live_price: 350,
        hotel_price_per_night: 150,
        airline_name: 'Air France',
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq('dest-paris', 'facebookexternalhit/1.0');
    const res = makeRes();
    await handler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('$361');
  });

  it('rejects invalid destination IDs', async () => {
    const req = makeReq('../etc/passwd', 'Twitterbot/1.0');
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('redirects bot on database error', async () => {
    pushResult('destinations', { data: null, error: new Error('DB error') });

    const req = makeReq('dest-fail', 'Slackbot-LinkExpanding');
    const res = makeRes();
    await handler(req, res);
    expect(res.redirect).toHaveBeenCalledWith(302, '/destination/dest-fail');
  });

  it('works without price calendar data', async () => {
    pushResult('destinations', {
      data: {
        city: 'Bali',
        country: 'Indonesia',
        tagline: 'Tropical paradise',
        flight_price: 700,
        live_price: null,
        hotel_price_per_night: 40,
        airline_name: null,
      },
      error: null,
    });
    pushResult('price_calendar', { data: null, error: new Error('no data') });

    const req = makeReq('dest-bali', 'Discordbot/2.0');
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('Bali');
    expect(html).not.toContain('Incredible Deal');
  });

  it('includes JSON-LD structured data with price', async () => {
    pushResult('destinations', {
      data: {
        city: 'London',
        country: 'UK',
        tagline: 'Royal city',
        flight_price: 400,
        live_price: 380,
        hotel_price_per_night: 200,
        airline_name: 'BA',
      },
      error: null,
    });
    pushResult('price_calendar', { data: [], error: null });

    const req = makeReq('dest-london', 'LinkedInBot/1.0');
    const res = makeRes();
    await handler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('"@type": "TravelAction"');
    expect(html).toContain('"priceCurrency": "USD"');
  });

  it('detects various bot user agents', async () => {
    const bots = [
      'Twitterbot/1.0',
      'facebookexternalhit/1.1',
      'LinkedInBot/1.0',
      'Slackbot-LinkExpanding 1.0',
      'Discordbot/2.0',
      'TelegramBot',
      'WhatsApp/2.0',
    ];

    for (const bot of bots) {
      mockResultQueues.clear();
      pushResult('destinations', {
        data: {
          city: 'Test',
          country: 'Land',
          tagline: 'Testing',
          flight_price: 100,
          live_price: null,
          hotel_price_per_night: 50,
          airline_name: null,
        },
        error: null,
      });
      pushResult('price_calendar', { data: [], error: null });

      const req = makeReq('test-id', bot);
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    }
  });
});
