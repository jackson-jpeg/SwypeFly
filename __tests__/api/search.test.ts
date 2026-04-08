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
const mockDeleteCalls: Array<{ table: string }> = [];

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
  chain.delete = jest.fn().mockImplementation(() => {
    mockDeleteCalls.push({ table });
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
    cachedPrices: 'cached_prices',
    destinations: 'destinations',
  },
}));

// Mock env module so STUB_MODE = false in tests
jest.mock('../../utils/env', () => ({
  env: {
    SUPABASE_URL: 'http://test',
    SUPABASE_SERVICE_ROLE_KEY: 'test',
    DUFFEL_API_KEY: 'test',
    BOOKING_MARKUP_PERCENT: 3,
  },
  STUB_MODE: false,
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

const mockSearchFlights = jest.fn();
jest.mock('../../services/duffel', () => ({
  searchFlights: (...args: unknown[]) => mockSearchFlights(...args),
}));

const mockCheckRateLimit = jest.fn();
const mockGetClientIp = jest.fn();
jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

import handler from '../../api/search';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    query: { origin: 'JFK', destination: 'LIM' },
    headers: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes(): VercelResponse & { _status: number; _json: unknown; _headers: Record<string, string> } {
  const res: any = { _status: 0, _json: null, _headers: {} };
  res.status = jest.fn((code: number) => { res._status = code; return res; });
  res.json = jest.fn((data: unknown) => { res._json = data; return res; });
  res.end = jest.fn(() => res);
  res.setHeader = jest.fn((key: string, value: string) => { res._headers[key] = value; return res; });
  return res;
}

function makeDuffelOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'off_001',
    total_amount: '310.00',
    total_currency: 'USD',
    expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
    slices: [
      {
        segments: [
          {
            operating_carrier: { name: 'Avianca', iata_code: 'AV' },
            operating_carrier_flight_number: 'AV123',
            departing_at: '2026-04-02T08:00:00Z',
            arriving_at: '2026-04-02T15:10:00Z',
            origin: { iata_code: 'JFK' },
            destination: { iata_code: 'LIM' },
            aircraft: { name: 'Boeing 787' },
          },
        ],
      },
      {
        segments: [
          {
            operating_carrier: { name: 'Avianca', iata_code: 'AV' },
            operating_carrier_flight_number: 'AV456',
            departing_at: '2026-04-09T09:00:00Z',
            arriving_at: '2026-04-09T18:30:00Z',
            origin: { iata_code: 'LIM' },
            destination: { iata_code: 'JFK' },
            aircraft: { name: 'Boeing 787' },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeCachedDoc(overrides: Record<string, unknown> = {}) {
  const offer = makeDuffelOffer();
  return {
    id: 'doc-1',
    origin: 'JFK',
    destination_iata: 'LIM',
    price: 310,
    currency: 'USD',
    airline: 'Avianca',
    airline_code: 'AV',
    source: 'duffel',
    departure_date: '2026-04-02',
    return_date: '2026-04-09',
    offer_json: JSON.stringify({
      id: offer.id,
      total_amount: offer.total_amount,
      total_currency: offer.total_currency,
      expires_at: offer.expires_at,
      slices: offer.slices.map((s: any) => ({
        segments: s.segments.map((seg: any) => ({
          operating_carrier: seg.operating_carrier,
          operating_carrier_flight_number: seg.operating_carrier_flight_number,
          departing_at: seg.departing_at,
          arriving_at: seg.arriving_at,
          origin: { iata_code: seg.origin.iata_code },
          destination: { iata_code: seg.destination.iata_code },
          aircraft: seg.aircraft,
        })),
      })),
    }),
    offer_expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
    fetched_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResultQueues.clear();
  mockInsertCalls.length = 0;
  mockUpdateCalls.length = 0;
  mockDeleteCalls.length = 0;
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  mockGetClientIp.mockReturnValue('127.0.0.1');
});

describe('GET /api/search', () => {
  it('returns 400 for missing params', async () => {
    const res = makeRes();
    await handler(makeReq({ query: {} }), res);
    expect(res._status).toBe(400);
  });

  it('returns 400 for lowercase IATA codes', async () => {
    const res = makeRes();
    await handler(makeReq({ query: { origin: 'jfk', destination: 'lim' } }), res);
    expect(res._status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(429);
    expect(res._headers['Retry-After']).toBeDefined();
  });

  it('returns cached result if fresh (does not call Duffel)', async () => {
    const cachedDoc = makeCachedDoc();
    // Cache check: returns fresh doc
    pushResult('cached_prices', { data: [cachedDoc], error: null });

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    // Price should have markup applied: 310 * 1.03 = 319.3 → rounded to 319
    expect(res._json).toMatchObject({ cached: true, airline: 'Avianca' });
    expect(mockSearchFlights).not.toHaveBeenCalled();
  });

  it('calls Duffel when no cache, returns result and caches it', async () => {
    // Cache check — empty
    pushResult('cached_prices', { data: [], error: null });
    // Existing doc check — empty (will create)
    pushResult('cached_prices', { data: [], error: null });
    // Insert result
    pushResult('cached_prices', { data: null, error: null });

    const offer = makeDuffelOffer();
    mockSearchFlights.mockResolvedValueOnce({ offers: [offer] });

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({
      cached: false,
      airline: 'Avianca',
      airlineCode: 'AV',
    });
    expect(mockSearchFlights).toHaveBeenCalledTimes(1);
    expect(mockInsertCalls.length).toBe(1);
    expect(mockInsertCalls[0].table).toBe('cached_prices');
  });

  it('returns 404 when Duffel returns no offers', async () => {
    // Cache check — empty
    pushResult('cached_prices', { data: [], error: null });
    mockSearchFlights.mockResolvedValueOnce({ offers: [] });

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(404);
    expect(res._json).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'No flights found' } });
  });

  it('returns 500 on Duffel error', async () => {
    // Cache check — empty
    pushResult('cached_prices', { data: [], error: null });
    mockSearchFlights.mockRejectedValueOnce(new Error('Duffel down'));

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(500);
    expect(res._json).toEqual({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Search failed' } });
  });

  it('updates existing cached doc instead of creating new one', async () => {
    // Cache check — stale doc (old fetched_at, will fail isFreshCache)
    const staleDoc = makeCachedDoc({
      fetched_at: new Date(Date.now() - 3600000).toISOString(),
      offer_expires_at: new Date(Date.now() - 1000).toISOString(), // expired
    });
    pushResult('cached_prices', { data: [staleDoc], error: null });

    // Duffel returns offer
    mockSearchFlights.mockResolvedValueOnce({ offers: [makeDuffelOffer()] });

    // Existing doc check — found existing
    pushResult('cached_prices', { data: [{ id: 'doc-1' }], error: null });
    // Update result
    pushResult('cached_prices', { data: null, error: null });

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ cached: false });
    expect(mockUpdateCalls.length).toBe(1);
    expect(mockUpdateCalls[0].table).toBe('cached_prices');
    expect(mockInsertCalls.length).toBe(0);
  });
});
