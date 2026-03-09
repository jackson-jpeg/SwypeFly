const mockDatabases = {
  listDocuments: jest.fn(),
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
  getDocument: jest.fn(),
};

jest.mock('../../services/appwriteServer', () => ({
  serverDatabases: mockDatabases,
  DATABASE_ID: 'sogojet',
  COLLECTIONS: {
    destinations: 'destinations',
    cachedPrices: 'cached_prices',
    userPreferences: 'user_preferences',
  },
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
    orderAsc: jest.fn((f: string) => `orderAsc:${f}`),
    orderDesc: jest.fn((f: string) => `orderDesc:${f}`),
  },
}));

jest.mock('node-appwrite', () => ({
  ID: { unique: jest.fn(() => 'unique-id') },
}));

jest.mock('../../utils/apiLogger', () => ({ logApiError: jest.fn() }));

const mockSearchFlights = jest.fn();
jest.mock('../../services/duffel', () => ({
  searchFlights: (...args: unknown[]) => mockSearchFlights(...args),
}));

const mockFetchCheapPrices = jest.fn();
jest.mock('../../services/travelpayouts', () => ({
  fetchCheapPrices: (...args: unknown[]) => mockFetchCheapPrices(...args),
}));

jest.mock('../../utils/validation', () => ({
  pricesQuerySchema: {},
  validateRequest: jest.fn((_schema: unknown, data: unknown) => ({
    success: true,
    data: data || {},
  })),
}));

import handler from '../../api/prices/refresh';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes(): VercelResponse {
  const res: Partial<VercelResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res as VercelResponse;
}

function makeDuffelOffer(dest: string, price: number, airline = 'TestAir') {
  return {
    id: `off_${dest}`,
    total_amount: String(price),
    total_currency: 'USD',
    expires_at: '2026-04-01T15:00:00Z',
    owner: { name: airline, iata_code: 'TA' },
    slices: [
      {
        segments: [
          {
            operating_carrier: { name: airline, iata_code: 'TA' },
            operating_carrier_flight_number: '100',
            departing_at: '2026-04-01T08:00:00',
            arriving_at: '2026-04-01T18:00:00',
            origin: { iata_code: 'JFK' },
            destination: { iata_code: dest },
            aircraft: { name: 'Boeing 737' },
          },
        ],
      },
      {
        segments: [
          {
            operating_carrier: { name: airline, iata_code: 'TA' },
            operating_carrier_flight_number: '101',
            departing_at: '2026-04-08T10:00:00',
            arriving_at: '2026-04-08T20:00:00',
            origin: { iata_code: dest },
            destination: { iata_code: 'JFK' },
            aircraft: { name: 'Boeing 737' },
          },
        ],
      },
    ],
    passengers: [{ id: 'pas_001', type: 'adult' }],
  };
}

describe('api/prices/refresh', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.CRON_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns 503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  test('returns 401 without authorization', async () => {
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 with wrong secret', async () => {
    const req = makeReq({
      headers: { authorization: 'Bearer wrong-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('succeeds with Duffel as primary source', async () => {
    // listDocuments calls:
    // 1. destinations (active)
    // 2. cachedPrices (stalest destinations - currentPriceMap)
    // 3. cachedPrices (stalest destinations - fetchedAtMap)
    // 4. userPreferences (getActiveOrigins via pickNextOrigins - won't be called since origin is specified)
    mockDatabases.listDocuments.mockResolvedValue({
      documents: [
        { $id: 'dest-1', iata_code: 'BCN', is_active: true },
        { $id: 'dest-2', iata_code: 'CDG', is_active: true },
      ],
      total: 2,
    });

    // Duffel returns offers for each destination
    mockSearchFlights.mockImplementation((params: { destination: string }) => {
      if (params.destination === 'BCN') {
        return Promise.resolve({ offers: [makeDuffelOffer('BCN', 350, 'Iberia')] });
      }
      if (params.destination === 'CDG') {
        return Promise.resolve({ offers: [makeDuffelOffer('CDG', 420, 'Air France')] });
      }
      return Promise.resolve({ offers: [] });
    });

    mockDatabases.createDocument.mockResolvedValue({ $id: 'price-1' });
    mockDatabases.updateDocument.mockResolvedValue({ $id: 'price-1' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.origins).toHaveLength(1);
    expect(responseData.origins[0].origin).toBe('JFK');
    expect(responseData.origins[0].sources.duffel).toBe(2);
    expect(responseData.batchSize).toBe(20);

    // Verify Duffel was called for each destination
    expect(mockSearchFlights).toHaveBeenCalledTimes(2);

    // Verify createDocument was called with Duffel source and offer_json
    const createCalls = mockDatabases.createDocument.mock.calls;
    expect(createCalls.length).toBe(2);
    expect(createCalls[0][3].source).toBe('duffel');
    expect(createCalls[0][3].offer_json).toBeTruthy();
    expect(createCalls[0][3].offer_expires_at).toBeTruthy();
  });

  test('falls back to Travelpayouts when Duffel fails', async () => {
    mockDatabases.listDocuments.mockResolvedValue({
      documents: [{ $id: 'dest-1', iata_code: 'BCN', is_active: true }],
      total: 1,
    });

    // Duffel fails
    mockSearchFlights.mockRejectedValue(new Error('Duffel API error'));

    // Travelpayouts succeeds
    mockFetchCheapPrices.mockResolvedValue({
      destination: 'BCN',
      price: 380,
      airline: 'IB',
      departureAt: '2026-04-01',
      returnAt: '2026-04-08',
    });

    mockDatabases.createDocument.mockResolvedValue({ $id: 'price-1' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.origins[0].sources.travelpayouts).toBe(1);
    expect(responseData.origins[0].sources.duffel).toBe(0);

    // Verify fallback was called
    expect(mockFetchCheapPrices).toHaveBeenCalledWith('JFK', 'BCN');

    // Verify stored with travelpayouts source
    const createCalls = mockDatabases.createDocument.mock.calls;
    expect(createCalls[0][3].source).toBe('travelpayouts');
    expect(createCalls[0][3].offer_json).toBe('');
  });

  test('tracks price history with direction', async () => {
    // First call: destinations
    // Second/third calls: cachedPrices with existing price
    mockDatabases.listDocuments.mockImplementation(
      (_db: string, collection: string, _queries: unknown[]) => {
        if (collection === 'destinations') {
          return Promise.resolve({
            documents: [{ $id: 'dest-1', iata_code: 'BCN', is_active: true }],
            total: 1,
          });
        }
        // cachedPrices queries (both for currentPriceMap and fetchedAtMap)
        return Promise.resolve({
          documents: [
            {
              $id: 'price-bcn',
              destination_iata: 'BCN',
              price: 400,
              fetched_at: '2026-03-01T00:00:00Z',
            },
          ],
          total: 1,
        });
      },
    );

    // Duffel returns cheaper price (>5% drop)
    mockSearchFlights.mockResolvedValue({
      offers: [makeDuffelOffer('BCN', 350, 'Iberia')],
    });

    mockDatabases.updateDocument.mockResolvedValue({ $id: 'price-bcn' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    // Verify update (not create) with price direction
    const updateCalls = mockDatabases.updateDocument.mock.calls;
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0][3].price).toBe(350);
    expect(updateCalls[0][3].previous_price).toBe(400);
    expect(updateCalls[0][3].price_direction).toBe('down');
  });
});
