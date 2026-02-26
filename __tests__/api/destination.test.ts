import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockGetDocument = jest.fn();
const mockListDocuments = jest.fn();

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    getDocument: mockGetDocument,
    listDocuments: mockListDocuments,
  })),
  Users: jest.fn().mockImplementation(() => ({})),
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
  },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/destination';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeDest(overrides: Record<string, unknown> = {}) {
  return {
    $id: VALID_UUID,
    iata_code: 'BCN',
    city: 'Barcelona',
    country: 'Spain',
    tagline: 'Gothic quarter vibes',
    description: 'A beautiful city',
    image_url: 'https://example.com/bcn.jpg',
    image_urls: ['https://example.com/bcn.jpg'],
    flight_price: 450,
    hotel_price_per_night: 120,
    currency: 'USD',
    vibe_tags: ['city', 'culture'],
    rating: 4.7,
    review_count: 1200,
    best_months: ['May', 'June'],
    average_temp: 72,
    flight_duration: '8h 30m',
    available_flight_days: ['Mon', 'Wed', 'Fri'],
    ...overrides,
  };
}

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    body: {},
    query: { id: VALID_UUID, origin: 'JFK' },
    ...overrides,
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

describe('GET /api/destination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
  });

  it('rejects non-GET methods', async () => {
    const req = makeReq({ method: 'POST' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects missing id', async () => {
    const req = makeReq({ query: { origin: 'JFK' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when destination not found', async () => {
    mockGetDocument.mockRejectedValueOnce(new Error('Not found'));
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns destination with camelCase keys', async () => {
    mockGetDocument.mockResolvedValueOnce(makeDest());
    // Price lookup returns empty
    mockListDocuments.mockResolvedValueOnce({ documents: [] });
    // Other prices lookup returns empty
    mockListDocuments.mockResolvedValueOnce({ documents: [] });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.id).toBe(VALID_UUID);
    expect(body.city).toBe('Barcelona');
    expect(body.flightPrice).toBe(450);
    expect(body.vibeTags).toEqual(['city', 'culture']);
    expect(body.livePrice).toBeNull();
    expect(body.priceSource).toBe('estimate');
  });

  it('merges live price when available', async () => {
    mockGetDocument.mockResolvedValueOnce(makeDest());
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        {
          origin: 'JFK',
          destination_iata: 'BCN',
          price: 299,
          airline: 'TAP',
          duration: '7h 15m',
          source: 'travelpayouts',
          fetched_at: '2026-02-26T00:00:00Z',
          departure_date: '2026-04-01',
          return_date: '2026-04-08',
          trip_duration_days: 7,
          previous_price: 350,
          price_direction: 'down',
        },
      ],
    });
    mockListDocuments.mockResolvedValueOnce({ documents: [] });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.livePrice).toBe(299);
    expect(body.flightPrice).toBe(299);
    expect(body.airline).toBe('TAP');
    expect(body.priceDirection).toBe('down');
    expect(body.priceSource).toBe('travelpayouts');
  });

  it('includes otherPrices from different origins', async () => {
    mockGetDocument.mockResolvedValueOnce(makeDest());
    mockListDocuments.mockResolvedValueOnce({ documents: [] });
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        { origin: 'LAX', destination_iata: 'BCN', price: 399, source: 'travelpayouts' },
        { origin: 'ORD', destination_iata: 'BCN', price: 450, source: 'amadeus' },
      ],
    });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.otherPrices).toHaveLength(2);
    expect(body.otherPrices[0].origin).toBe('LAX');
    expect(body.otherPrices[0].price).toBe(399);
  });

  it('defaults origin to TPA when not provided', async () => {
    mockGetDocument.mockResolvedValueOnce(makeDest());
    mockListDocuments.mockResolvedValue({ documents: [] });

    const req = makeReq({ query: { id: VALID_UUID } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sets Cache-Control header', async () => {
    mockGetDocument.mockResolvedValueOnce(makeDest());
    mockListDocuments.mockResolvedValue({ documents: [] });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader).toBeDefined();
    expect(cacheHeader![1]).toContain('s-maxage');
  });
});
