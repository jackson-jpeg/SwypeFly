import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock env module so STUB_MODE = false in tests (we mock Duffel ourselves)
jest.mock('../../utils/env', () => ({
  env: {
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    DUFFEL_API_KEY: 'test-key',
    APPWRITE_ENDPOINT: 'https://test.appwrite.io/v1',
    APPWRITE_PROJECT_ID: 'test-project',
    APPWRITE_API_KEY: 'test-key',
    BOOKING_MARKUP_PERCENT: 3,
  },
  STUB_MODE: false,
}));

const mockListDocuments = jest.fn();
const mockCreateDocument = jest.fn();
const mockUpdateDocument = jest.fn();

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    listDocuments: mockListDocuments,
    createDocument: mockCreateDocument,
    updateDocument: mockUpdateDocument,
  })),
  Users: jest.fn().mockImplementation(() => ({})),
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    orderAsc: jest.fn((field: string) => `orderAsc:${field}`),
    limit: jest.fn((n: number) => `limit:${n}`),
  },
  ID: { unique: jest.fn(() => 'unique-id') },
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
    $id: 'doc-1',
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
    mockListDocuments.mockResolvedValueOnce({ documents: [cachedDoc] });

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ cached: true, price: 310, airline: 'Avianca' });
    expect(mockSearchFlights).not.toHaveBeenCalled();
  });

  it('calls Duffel when no cache, returns result and caches it', async () => {
    // First listDocuments: cache check — empty
    mockListDocuments.mockResolvedValueOnce({ documents: [] });
    // Second listDocuments: upsert check — empty (create new)
    mockListDocuments.mockResolvedValueOnce({ documents: [] });
    mockCreateDocument.mockResolvedValueOnce({ $id: 'new-doc' });

    const offer = makeDuffelOffer();
    mockSearchFlights.mockResolvedValueOnce({ data: [offer] });

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({
      cached: false,
      price: 310,
      airline: 'Avianca',
      airlineCode: 'AV',
    });
    expect(mockSearchFlights).toHaveBeenCalledTimes(1);
    expect(mockCreateDocument).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when Duffel returns no offers', async () => {
    mockListDocuments.mockResolvedValueOnce({ documents: [] });
    mockSearchFlights.mockResolvedValueOnce({ data: [] });

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(404);
    expect(res._json).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'No flights found' } });
  });

  it('returns 500 on Duffel error', async () => {
    mockListDocuments.mockResolvedValueOnce({ documents: [] });
    mockSearchFlights.mockRejectedValueOnce(new Error('Duffel down'));

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(500);
    expect(res._json).toEqual({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Search failed' } });
  });

  it('updates existing cached doc instead of creating new one', async () => {
    // Cache check — stale (fetched 1 hour ago)
    const staleDoc = makeCachedDoc({
      fetched_at: new Date(Date.now() - 3600000).toISOString(),
    });
    mockListDocuments.mockResolvedValueOnce({ documents: [staleDoc] });

    // Duffel returns offer
    mockSearchFlights.mockResolvedValueOnce({ data: [makeDuffelOffer()] });

    // Upsert check — existing doc found
    mockListDocuments.mockResolvedValueOnce({ documents: [{ $id: 'doc-1' }] });
    mockUpdateDocument.mockResolvedValueOnce({});

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ cached: false });
    expect(mockUpdateDocument).toHaveBeenCalledTimes(1);
    expect(mockCreateDocument).not.toHaveBeenCalled();
  });
});
