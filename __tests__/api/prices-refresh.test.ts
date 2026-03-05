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

const mockFetchCityDirections = jest.fn();
const mockFetchCheapPrices = jest.fn();
jest.mock('../../services/travelpayouts', () => ({
  fetchCityDirections: (...args: unknown[]) => mockFetchCityDirections(...args),
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

describe('api/prices/refresh', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.CRON_SECRET = 'test-secret';
    process.env.TRAVELPAYOUTS_API_TOKEN = 'test-tp-token';
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

  test('succeeds with valid cron secret and returns results', async () => {
    // listDocuments is called for: destinations, then cachedPrices (upsert checks)
    mockDatabases.listDocuments.mockResolvedValue({
      documents: [
        { $id: 'dest-1', iata_code: 'BCN', is_active: true },
        { $id: 'dest-2', iata_code: 'CDG', is_active: true },
      ],
      total: 2,
    });

    // fetchCityDirections returns a Map
    mockFetchCityDirections.mockResolvedValue(
      new Map([
        ['BCN', { price: 350, airline: 'IB', departureAt: '2026-04-01', returnAt: '2026-04-08' }],
        ['CDG', { price: 420, airline: 'AF', departureAt: '2026-04-02', returnAt: '2026-04-09' }],
      ]),
    );

    mockFetchCheapPrices.mockResolvedValue(null);
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
  });
});
