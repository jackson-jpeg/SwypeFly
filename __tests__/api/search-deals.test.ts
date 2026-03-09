import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockListDocuments = jest.fn();

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    listDocuments: mockListDocuments,
  })),
  Users: jest.fn().mockImplementation(() => ({})),
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
    offset: jest.fn((n: number) => `offset:${n}`),
    orderAsc: jest.fn((f: string) => `asc:${f}`),
    orderDesc: jest.fn((f: string) => `desc:${f}`),
  },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/search-deals';

function makeDest(overrides: Record<string, unknown> = {}) {
  return {
    $id: overrides.$id ?? 'dest-1',
    iata_code: 'BCN',
    city: 'Barcelona',
    country: 'Spain',
    continent: 'Europe',
    image_url: 'https://example.com/bcn.jpg',
    vibe_tags: ['city', 'culture'],
    is_active: true,
    ...overrides,
  };
}

function makePrice(overrides: Record<string, unknown> = {}) {
  return {
    $id: overrides.$id ?? 'price-1',
    destination_iata: 'BCN',
    origin: 'TPA',
    price: 350,
    currency: 'USD',
    airline: 'Delta',
    departure_date: '2026-04-15',
    return_date: '2026-04-22',
    trip_duration_days: 7,
    price_direction: 'down',
    previous_price: 500,
    source: 'duffel',
    offer_json: null,
    offer_expires_at: null,
    ...overrides,
  };
}

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
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
}

describe('GET /api/search-deals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
  });

  it('returns 405 for non-GET methods', async () => {
    const req = { ...makeReq(), method: 'POST' } as unknown as VercelRequest;
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns deals sorted by cheapest', async () => {
    const dest1 = makeDest({ $id: 'd1', iata_code: 'BCN', city: 'Barcelona' });
    const dest2 = makeDest({ $id: 'd2', iata_code: 'PAR', city: 'Paris', country: 'France' });

    const price1 = makePrice({ destination_iata: 'BCN', price: 500 });
    const price2 = makePrice({ destination_iata: 'PAR', price: 300 });

    mockListDocuments
      .mockResolvedValueOnce({ documents: [dest1, dest2], total: 2 })
      .mockResolvedValueOnce({ documents: [price1, price2], total: 2 });

    const req = makeReq({ origin: 'TPA', sort: 'cheapest' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.deals).toHaveLength(2);
    expect(body.deals[0].city).toBe('Paris');
    expect(body.deals[0].price).toBe(300);
    expect(body.deals[1].city).toBe('Barcelona');
    expect(body.deals[1].price).toBe(500);
    expect(body.total).toBe(2);
    expect(body.nextCursor).toBeNull();
  });

  it('filters by search text (case-insensitive city/country/iata match)', async () => {
    const dest1 = makeDest({ $id: 'd1', iata_code: 'BCN', city: 'Barcelona', country: 'Spain' });
    const dest2 = makeDest({ $id: 'd2', iata_code: 'PAR', city: 'Paris', country: 'France' });

    const price1 = makePrice({ destination_iata: 'BCN', price: 400 });
    const price2 = makePrice({ destination_iata: 'PAR', price: 300 });

    mockListDocuments
      .mockResolvedValueOnce({ documents: [dest1, dest2], total: 2 })
      .mockResolvedValueOnce({ documents: [price1, price2], total: 2 });

    const req = makeReq({ origin: 'TPA', search: 'bar' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].city).toBe('Barcelona');
    expect(body.total).toBe(1);
  });

  it('filters by maxPrice', async () => {
    const dest1 = makeDest({ $id: 'd1', iata_code: 'BCN', city: 'Barcelona' });
    const dest2 = makeDest({ $id: 'd2', iata_code: 'PAR', city: 'Paris', country: 'France' });

    const price1 = makePrice({ destination_iata: 'BCN', price: 600 });
    const price2 = makePrice({ destination_iata: 'PAR', price: 300 });

    mockListDocuments
      .mockResolvedValueOnce({ documents: [dest1, dest2], total: 2 })
      .mockResolvedValueOnce({ documents: [price1, price2], total: 2 });

    const req = makeReq({ origin: 'TPA', maxPrice: '400' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].city).toBe('Paris');
    expect(body.deals[0].price).toBe(300);
  });

  it('returns empty deals when no cached prices match', async () => {
    const dest1 = makeDest({ $id: 'd1', iata_code: 'BCN', city: 'Barcelona' });

    mockListDocuments
      .mockResolvedValueOnce({ documents: [dest1], total: 1 })
      .mockResolvedValueOnce({ documents: [], total: 0 });

    const req = makeReq({ origin: 'TPA' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.deals).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.nextCursor).toBeNull();
  });

  it('sorts by trending (biggest price drops first)', async () => {
    const dest1 = makeDest({ $id: 'd1', iata_code: 'BCN', city: 'Barcelona' });
    const dest2 = makeDest({ $id: 'd2', iata_code: 'PAR', city: 'Paris', country: 'France' });

    const price1 = makePrice({
      destination_iata: 'BCN',
      price: 400,
      previous_price: 450,
    });
    const price2 = makePrice({
      destination_iata: 'PAR',
      price: 300,
      previous_price: 600,
    });

    mockListDocuments
      .mockResolvedValueOnce({ documents: [dest1, dest2], total: 2 })
      .mockResolvedValueOnce({ documents: [price1, price2], total: 2 });

    const req = makeReq({ origin: 'TPA', sort: 'trending' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.deals[0].city).toBe('Paris'); // drop of 300 > drop of 50
    expect(body.deals[1].city).toBe('Barcelona');
  });

  it('paginates with cursor and returns nextCursor', async () => {
    // Create 25 destinations with prices to exceed PAGE_SIZE of 20
    const dests = Array.from({ length: 25 }, (_, i) => {
      const iata = `X${String(i).padStart(2, '0')}`;
      return makeDest({ $id: `d${i}`, iata_code: iata, city: `City${i}` });
    });
    const prices = dests.map((d, i) =>
      makePrice({ destination_iata: d.iata_code, price: 100 + i }),
    );

    mockListDocuments
      .mockResolvedValueOnce({ documents: dests, total: 25 })
      .mockResolvedValueOnce({ documents: prices, total: 25 });

    const req = makeReq({ origin: 'TPA', sort: 'cheapest' });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.deals).toHaveLength(20);
    expect(body.nextCursor).toBe(20);
    expect(body.total).toBe(25);
  });
});
