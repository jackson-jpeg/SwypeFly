const mockDatabases = {
  listDocuments: jest.fn(),
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
};

jest.mock('../../services/appwriteServer', () => ({
  serverDatabases: mockDatabases,
  DATABASE_ID: 'sogojet',
  COLLECTIONS: {
    destinations: 'destinations',
    cachedPrices: 'cached_prices',
    userPreferences: 'user_preferences',
    priceCalendar: 'price_calendar',
  },
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
    orderAsc: jest.fn((f: string) => `orderAsc:${f}`),
  },
}));

jest.mock('node-appwrite', () => ({
  ID: { unique: jest.fn(() => 'unique-id') },
}));

jest.mock('../../utils/apiLogger', () => ({ logApiError: jest.fn() }));

const mockFetchAllCheapPrices = jest.fn();
const mockFetchPriceCalendar = jest.fn();

jest.mock('../../services/travelpayouts', () => ({
  fetchAllCheapPrices: (...args: unknown[]) => mockFetchAllCheapPrices(...args),
  fetchPriceCalendar: (...args: unknown[]) => mockFetchPriceCalendar(...args),
}));

import handler from '../../api/prices/refresh-calendar';
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

describe('api/prices/refresh-calendar', () => {
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

  test('fetches bulk prices then calendar for each destination, upserts entries', async () => {
    // listDocuments: user_preferences (for origins), then price_calendar (for staleness)
    mockDatabases.listDocuments.mockImplementation(
      (_db: string, collection: string) => {
        if (collection === 'user_preferences') {
          return Promise.resolve({ documents: [], total: 0 });
        }
        if (collection === 'price_calendar') {
          return Promise.resolve({ documents: [], total: 0 });
        }
        return Promise.resolve({ documents: [], total: 0 });
      },
    );

    // fetchAllCheapPrices returns two destinations
    mockFetchAllCheapPrices.mockResolvedValue(
      new Map([
        [
          'BCN',
          {
            destination: 'BCN',
            price: 350,
            airline: 'IB',
            departureAt: '2026-04-01',
            returnAt: '2026-04-08',
            foundAt: '2026-03-19',
          },
        ],
        [
          'CDG',
          {
            destination: 'CDG',
            price: 420,
            airline: 'AF',
            departureAt: '2026-04-02',
            returnAt: '2026-04-09',
            foundAt: '2026-03-19',
          },
        ],
      ]),
    );

    // fetchPriceCalendar returns daily prices for each destination
    mockFetchPriceCalendar.mockImplementation(
      (_origin: string, dest: string) => {
        if (dest === 'BCN') {
          return Promise.resolve([
            { date: '2026-04-01', price: 350, airline: 'IB', transferCount: 0 },
            { date: '2026-04-02', price: 380, airline: 'IB', transferCount: 0 },
          ]);
        }
        if (dest === 'CDG') {
          return Promise.resolve([
            { date: '2026-04-01', price: 420, airline: 'AF', transferCount: 1 },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    mockDatabases.createDocument.mockResolvedValue({ $id: 'cal-1' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = (res.json as jest.Mock).mock.calls[0][0];
    expect(data.origins).toHaveLength(1);
    expect(data.origins[0].origin).toBe('JFK');

    // Should have called fetchAllCheapPrices once for JFK
    expect(mockFetchAllCheapPrices).toHaveBeenCalledWith('JFK');

    // Should have called fetchPriceCalendar for BCN and CDG
    expect(mockFetchPriceCalendar).toHaveBeenCalledWith('JFK', 'BCN');
    expect(mockFetchPriceCalendar).toHaveBeenCalledWith('JFK', 'CDG');

    // Should have created 3 calendar entries (2 for BCN + 1 for CDG)
    expect(mockDatabases.createDocument).toHaveBeenCalledTimes(3);

    // Verify upsert data shape
    const firstCall = mockDatabases.createDocument.mock.calls[0];
    expect(firstCall[0]).toBe('sogojet'); // DATABASE_ID
    expect(firstCall[1]).toBe('price_calendar'); // collection
    expect(firstCall[3].origin).toBe('JFK');
    expect(firstCall[3].source).toBe('travelpayouts_calendar');
    expect(firstCall[3].trip_days).toBe(7);
    expect(firstCall[3].fetched_at).toBeDefined();
  });

  test('updates existing calendar entries instead of creating new ones', async () => {
    mockDatabases.listDocuments.mockImplementation(
      (_db: string, collection: string, queries?: string[]) => {
        if (collection === 'user_preferences') {
          return Promise.resolve({ documents: [], total: 0 });
        }
        if (collection === 'price_calendar') {
          // When checking for existing entry during upsert, return a match
          const hasDateQuery = queries?.some((q: string) => q.startsWith('equal:date,'));
          if (hasDateQuery) {
            return Promise.resolve({
              documents: [{ $id: 'existing-cal-1' }],
              total: 1,
            });
          }
          // For staleness check
          return Promise.resolve({ documents: [], total: 0 });
        }
        return Promise.resolve({ documents: [], total: 0 });
      },
    );

    mockFetchAllCheapPrices.mockResolvedValue(
      new Map([
        [
          'BCN',
          {
            destination: 'BCN',
            price: 350,
            airline: 'IB',
            departureAt: '2026-04-01',
            returnAt: '2026-04-08',
            foundAt: '2026-03-19',
          },
        ],
      ]),
    );

    mockFetchPriceCalendar.mockResolvedValue([
      { date: '2026-04-01', price: 340, airline: 'IB', transferCount: 0 },
    ]);

    mockDatabases.updateDocument.mockResolvedValue({ $id: 'existing-cal-1' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    // Should update, not create
    expect(mockDatabases.updateDocument).toHaveBeenCalledTimes(1);
    expect(mockDatabases.createDocument).not.toHaveBeenCalled();
    expect(mockDatabases.updateDocument.mock.calls[0][2]).toBe('existing-cal-1');
  });

  test('handles fetchAllCheapPrices returning empty map', async () => {
    mockDatabases.listDocuments.mockResolvedValue({ documents: [], total: 0 });
    mockFetchAllCheapPrices.mockResolvedValue(new Map());

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: { origin: 'JFK' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockFetchPriceCalendar).not.toHaveBeenCalled();
    expect(mockDatabases.createDocument).not.toHaveBeenCalled();
  });

  test('picks stalest origins when no origin param provided', async () => {
    // user_preferences returns nothing, price_calendar returns old data for TPA
    mockDatabases.listDocuments.mockImplementation(
      (_db: string, collection: string) => {
        if (collection === 'user_preferences') {
          return Promise.resolve({ documents: [], total: 0 });
        }
        if (collection === 'price_calendar') {
          return Promise.resolve({
            documents: [
              { origin: 'TPA', fetched_at: '2026-01-01T00:00:00Z' },
              { origin: 'LAX', fetched_at: '2026-03-18T00:00:00Z' },
            ],
            total: 2,
          });
        }
        return Promise.resolve({ documents: [], total: 0 });
      },
    );

    mockFetchAllCheapPrices.mockResolvedValue(new Map());

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
      query: {},
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = (res.json as jest.Mock).mock.calls[0][0];
    // Should pick 2 origins
    expect(data.origins).toHaveLength(2);
  });
});
