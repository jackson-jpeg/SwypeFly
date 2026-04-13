import type { VercelRequest, VercelResponse } from '@vercel/node';

// Configurable mock results per table
const mockResults = new Map<string, { data: unknown; error: unknown }>();

function getResult(table: string) {
  return mockResults.get(table) ?? { data: [], error: null };
}

const createChain = (table: string) => {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'upsert', 'update', 'delete',
    'eq', 'neq', 'in', 'contains', 'ilike',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'range',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  (chain as any).then = jest.fn().mockImplementation((resolve: any) => {
    const result = getResult(table);
    if (resolve) return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  });
  return chain;
};

const mockFrom = jest.fn().mockImplementation((table: string) => createChain(table));

jest.mock('../../services/supabaseServer', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  TABLES: {
    savedTrips: 'saved_trips',
    destinations: 'destinations',
    cachedPrices: 'cached_prices',
  },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

const mockCheckRateLimit = jest.fn().mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 });
jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

import handler from '../../api/leaderboard';

function makeReq(query: Record<string, string> = {}, method = 'GET') {
  return {
    method,
    query,
    headers: {},
  } as unknown as VercelRequest;
}

function makeRes() {
  const res: Partial<VercelResponse> & { _status: number; _json: unknown } = {
    _status: 0,
    _json: null,
    status(code: number) {
      res._status = code;
      return res as VercelResponse;
    },
    json(body: unknown) {
      res._json = body;
      return res as VercelResponse;
    },
    setHeader: jest.fn().mockReturnThis() as any,
    getHeader: jest.fn() as any,
  };
  return res;
}

beforeEach(() => {
  mockResults.clear();
  mockFrom.mockClear();
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 });
});

describe('GET /api/leaderboard', () => {
  it('returns 405 for non-GET', async () => {
    const res = makeRes();
    await handler(makeReq({}, 'POST'), res as unknown as VercelResponse);
    expect(res._status).toBe(405);
  });

  it('returns empty leaderboard when no saved trips', async () => {
    mockResults.set('saved_trips', { data: [], error: null });
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
    const body = res._json as any;
    expect(body.ok).toBe(true);
    expect(body.data.leaderboard).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it('returns ranked leaderboard sorted by score', async () => {
    mockResults.set('saved_trips', {
      data: [
        { user_id: 'user-aaa1', destination_id: 'dest-1' },
        { user_id: 'user-aaa1', destination_id: 'dest-2' },
        { user_id: 'user-aaa1', destination_id: 'dest-3' },
        { user_id: 'user-bbb2', destination_id: 'dest-1' },
      ],
      error: null,
    });
    mockResults.set('destinations', {
      data: [
        { id: 'dest-1', city: 'Tokyo', country: 'Japan', iata_code: 'TYO' },
        { id: 'dest-2', city: 'Paris', country: 'France', iata_code: 'CDG' },
        { id: 'dest-3', city: 'Bali', country: 'Indonesia', iata_code: 'DPS' },
      ],
      error: null,
    });
    mockResults.set('cached_prices', {
      data: [
        { destination_iata: 'TYO', price: 400, usual_price: 800, fetched_at: '2026-04-01' },
        { destination_iata: 'CDG', price: 300, usual_price: 600, fetched_at: '2026-04-01' },
        { destination_iata: 'DPS', price: 500, usual_price: 700, fetched_at: '2026-04-01' },
      ],
      error: null,
    });

    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
    const body = res._json as any;
    expect(body.ok).toBe(true);
    expect(body.data.leaderboard.length).toBe(2);
    // user-aaa1 has 3 saves, user-bbb2 has 1 save — aaa1 should rank first
    expect(body.data.leaderboard[0].rank).toBe(1);
    expect(body.data.leaderboard[0].user_id).toBe('user-aaa1');
    expect(body.data.leaderboard[0].total_saves).toBe(3);
    expect(body.data.leaderboard[1].rank).toBe(2);
    expect(body.data.leaderboard[1].user_id).toBe('user-bbb2');
  });

  it('respects limit query param', async () => {
    mockResults.set('saved_trips', {
      data: [
        { user_id: 'u1', destination_id: 'd1' },
        { user_id: 'u2', destination_id: 'd2' },
        { user_id: 'u3', destination_id: 'd3' },
      ],
      error: null,
    });
    mockResults.set('destinations', {
      data: [
        { id: 'd1', city: 'A', country: 'B', iata_code: 'AAA' },
        { id: 'd2', city: 'C', country: 'D', iata_code: 'BBB' },
        { id: 'd3', city: 'E', country: 'F', iata_code: 'CCC' },
      ],
      error: null,
    });
    mockResults.set('cached_prices', { data: [], error: null });

    const res = makeRes();
    await handler(makeReq({ limit: '2' }), res as unknown as VercelResponse);
    const body = res._json as any;
    expect(body.data.leaderboard.length).toBe(2);
    expect(body.data.total).toBe(3);
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 });
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(429);
  });

  it('returns 500 on database error', async () => {
    mockResults.set('saved_trips', { data: null, error: { message: 'connection failed' } });
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(500);
  });

  it('sets cache headers on success with data', async () => {
    mockResults.set('saved_trips', {
      data: [{ user_id: 'user-cache', destination_id: 'dest-1' }],
      error: null,
    });
    mockResults.set('destinations', {
      data: [{ id: 'dest-1', city: 'Rome', country: 'Italy', iata_code: 'FCO' }],
      error: null,
    });
    mockResults.set('cached_prices', { data: [], error: null });
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('max-age'));
  });

  it('generates anonymous username from user_id suffix', async () => {
    mockResults.set('saved_trips', {
      data: [{ user_id: 'user_abc1234f', destination_id: 'dest-1' }],
      error: null,
    });
    mockResults.set('destinations', {
      data: [{ id: 'dest-1', city: 'Berlin', country: 'Germany', iata_code: 'BER' }],
      error: null,
    });
    mockResults.set('cached_prices', { data: [], error: null });

    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    const body = res._json as any;
    expect(body.data.leaderboard[0].username).toBe('Traveler 234F');
  });

  it('caps limit at 100 even with large input', async () => {
    mockResults.set('saved_trips', { data: [], error: null });
    const res = makeRes();
    await handler(makeReq({ limit: '9999' }), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
  });

  it('computes savings_percent correctly from price/usual_price', async () => {
    mockResults.set('saved_trips', {
      data: [{ user_id: 'user-s1', destination_id: 'dest-cheap' }],
      error: null,
    });
    mockResults.set('destinations', {
      data: [{ id: 'dest-cheap', city: 'Lima', country: 'Peru', iata_code: 'LIM' }],
      error: null,
    });
    mockResults.set('cached_prices', {
      data: [{ destination_iata: 'LIM', price: 200, usual_price: 500, fetched_at: '2026-04-01' }],
      error: null,
    });

    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    const entry = (res._json as any).data.leaderboard[0];
    // (500 - 200) / 500 = 60%
    expect(entry.avg_savings_percent).toBe(60);
    // score = avg_savings * total_saves = 60 * 1
    expect(entry.score).toBe(60);
  });

  it('skips entries with missing user_id or destination_id', async () => {
    mockResults.set('saved_trips', {
      data: [
        { user_id: null, destination_id: 'dest-1' },
        { user_id: 'user-ok', destination_id: null },
        { user_id: 'user-ok', destination_id: 'dest-1' },
      ],
      error: null,
    });
    mockResults.set('destinations', {
      data: [{ id: 'dest-1', city: 'Lisbon', country: 'Portugal', iata_code: 'LIS' }],
      error: null,
    });
    mockResults.set('cached_prices', { data: [], error: null });

    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    const body = res._json as any;
    expect(body.data.leaderboard.length).toBe(1);
    expect(body.data.leaderboard[0].user_id).toBe('user-ok');
  });
});
