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
  },
}));

jest.mock('../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../api/search-deals';

// ─── Helpers ───────────────────────────────────────────────────────────

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
    end: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
}

function mockDest(id: string, city: string, iata: string, country: string) {
  return {
    $id: id,
    iata_code: iata,
    city,
    country,
    continent: 'Europe',
    image_url: `https://example.com/${iata.toLowerCase()}.jpg`,
    vibe_tags: ['city'],
    is_active: true,
  };
}

function mockPrice(destIata: string, price: number) {
  return {
    $id: `price-${destIata}`,
    destination_iata: destIata,
    origin: 'TPA',
    price,
    currency: 'USD',
    airline: 'Delta',
    departure_date: '2026-04-15',
    return_date: '2026-04-22',
    trip_duration_days: 7,
    price_direction: null,
    previous_price: null,
    source: 'duffel',
    offer_json: null,
    offer_expires_at: null,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('GET /api/search-deals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
  });

  it('returns deals sorted by cheapest', async () => {
    const dest1 = mockDest('d1', 'Barcelona', 'BCN', 'Spain');
    const dest2 = mockDest('d2', 'Paris', 'PAR', 'France');

    const price1 = mockPrice('BCN', 500);
    const price2 = mockPrice('PAR', 250);

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
    expect(body.deals[0].price).toBe(250);
    expect(body.deals[1].city).toBe('Barcelona');
    expect(body.deals[1].price).toBe(500);
  });

  it('filters by search text', async () => {
    const dest1 = mockDest('d1', 'Barcelona', 'BCN', 'Spain');
    const dest2 = mockDest('d2', 'Paris', 'PAR', 'France');

    const price1 = mockPrice('BCN', 400);
    const price2 = mockPrice('PAR', 300);

    mockListDocuments
      .mockResolvedValueOnce({ documents: [dest1, dest2], total: 2 })
      .mockResolvedValueOnce({ documents: [price1, price2], total: 2 });

    const req = makeReq({ origin: 'TPA', search: 'paris' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].city).toBe('Paris');
  });

  it('filters by maxPrice', async () => {
    const dest1 = mockDest('d1', 'Barcelona', 'BCN', 'Spain');
    const dest2 = mockDest('d2', 'Paris', 'PAR', 'France');

    const price1 = mockPrice('BCN', 500);
    const price2 = mockPrice('PAR', 200);

    mockListDocuments
      .mockResolvedValueOnce({ documents: [dest1, dest2], total: 2 })
      .mockResolvedValueOnce({ documents: [price1, price2], total: 2 });

    const req = makeReq({ origin: 'TPA', maxPrice: '300' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].city).toBe('Paris');
    expect(body.deals[0].price).toBe(200);
  });

  it('returns 405 for non-GET', async () => {
    const req = { ...makeReq(), method: 'POST' } as unknown as VercelRequest;
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('returns empty deals when no cached prices', async () => {
    const dest1 = mockDest('d1', 'Barcelona', 'BCN', 'Spain');

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
});
