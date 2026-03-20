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
    aiCache: 'ai_cache',
    priceHistoryStats: 'price_history_stats',
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
    mockDatabases.listDocuments.mockImplementation(
      (_db: string, collection: string) => {
        if (collection === 'destinations') {
          return Promise.resolve({
            documents: [
              { $id: 'dest-1', iata_code: 'BCN', is_active: true, country: 'Spain', popularity_score: 0.8, best_months: ['June', 'July'] },
              { $id: 'dest-2', iata_code: 'CDG', is_active: true, country: 'France', popularity_score: 0.9, best_months: ['May', 'June'] },
            ],
            total: 2,
          });
        }
        // cached_prices, user_preferences, price_history_stats — empty
        return Promise.resolve({ documents: [], total: 0 });
      },
    );

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
    expect(responseData.batchSize).toBe(30);

    // Verify Duffel was called for each destination
    expect(mockSearchFlights).toHaveBeenCalledTimes(2);

    // Verify createDocument calls by collection
    const createCalls = mockDatabases.createDocument.mock.calls;
    const cachedPriceCreates = createCalls.filter((c: unknown[]) => c[1] === 'cached_prices');
    const snapshotCreates = createCalls.filter((c: unknown[]) => c[1] === 'ai_cache');
    const statsCreates = createCalls.filter((c: unknown[]) => c[1] === 'price_history_stats');

    // 2 cached_prices creates (one per destination)
    expect(cachedPriceCreates.length).toBe(2);
    expect(cachedPriceCreates[0][3].source).toBe('duffel');
    expect(cachedPriceCreates[0][3].offer_json).toBeTruthy();
    expect(cachedPriceCreates[0][3].offer_expires_at).toBeTruthy();
    // Deal quality fields should be present
    expect(cachedPriceCreates[0][3].deal_score).toBeDefined();
    expect(cachedPriceCreates[0][3].deal_tier).toBeDefined();

    // 2 price_history snapshots in ai_cache
    expect(snapshotCreates.length).toBe(2);
    expect(snapshotCreates[0][3].type).toBe('price_history');

    // 2 price_history_stats creates (new routes)
    expect(statsCreates.length).toBe(2);
  });

  test('returns null source when Duffel fails', async () => {
    mockDatabases.listDocuments.mockResolvedValue({
      documents: [{ $id: 'dest-1', iata_code: 'BCN', is_active: true }],
      total: 1,
    });

    // Duffel fails
    mockSearchFlights.mockRejectedValue(new Error('Duffel API error'));

    mockDatabases.createDocument.mockResolvedValue({ $id: 'price-1' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.origins[0].sources.duffel).toBe(0);
    expect(responseData.origins[0].fetched).toBe(0);

    // No cached_prices or snapshots should be created when Duffel fails
    expect(mockDatabases.createDocument).not.toHaveBeenCalled();
  });

  test('tracks price history with direction', async () => {
    mockDatabases.listDocuments.mockImplementation(
      (_db: string, collection: string, _queries: unknown[]) => {
        if (collection === 'destinations') {
          return Promise.resolve({
            documents: [{ $id: 'dest-1', iata_code: 'BCN', is_active: true, country: 'Spain', popularity_score: 0.8, best_months: ['June'] }],
            total: 1,
          });
        }
        if (collection === 'cached_prices') {
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
        }
        // user_preferences, price_history_stats — empty
        return Promise.resolve({ documents: [], total: 0 });
      },
    );

    // Duffel returns cheaper price (>5% drop)
    mockSearchFlights.mockResolvedValue({
      offers: [makeDuffelOffer('BCN', 350, 'Iberia')],
    });

    mockDatabases.updateDocument.mockResolvedValue({ $id: 'price-bcn' });
    mockDatabases.createDocument.mockResolvedValue({ $id: 'snapshot-1' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    // Verify update for cached_prices with price direction
    const updateCalls = mockDatabases.updateDocument.mock.calls;
    const priceUpdates = updateCalls.filter((c: unknown[]) => c[1] === 'cached_prices');
    expect(priceUpdates.length).toBe(1);
    expect(priceUpdates[0][3].price).toBe(350);
    expect(priceUpdates[0][3].previous_price).toBe(400);
    expect(priceUpdates[0][3].price_direction).toBe('down');

    // Verify price snapshot was also recorded in ai_cache
    const createCalls = mockDatabases.createDocument.mock.calls;
    expect(createCalls.length).toBeGreaterThanOrEqual(1);
    const snapshotCall = createCalls.find((c: any[]) => c[1] === 'ai_cache');
    expect(snapshotCall).toBeTruthy();
    expect(snapshotCall![3].type).toBe('price_history');
  });
});
