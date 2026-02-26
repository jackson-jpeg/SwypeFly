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

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/feed';

// Each test uses a unique origin to avoid the in-memory cache in feed.ts
let originCounter = 0;
function uniqueOrigin(): string {
  originCounter++;
  // 3-letter uppercase IATA codes
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = letters[originCounter % 26];
  const b = letters[Math.floor(originCounter / 26) % 26];
  const c = letters[Math.floor(originCounter / 676) % 26];
  return `${c}${b}${a}`;
}

function makeDest(overrides: Record<string, unknown> = {}) {
  return {
    $id: overrides.$id ?? 'dest-1',
    iata_code: 'BCN',
    city: 'Barcelona',
    country: 'Spain',
    continent: 'Europe',
    tagline: 'Gothic quarter vibes',
    description: 'A beautiful city',
    image_url: 'https://example.com/bcn.jpg',
    image_urls: ['https://example.com/bcn.jpg'],
    flight_price: 450,
    hotel_price_per_night: 120,
    currency: 'USD',
    vibe_tags: ['city', 'culture', 'foodie'],
    rating: 4.7,
    review_count: 1200,
    best_months: ['May', 'June'],
    average_temp: 72,
    flight_duration: '8h 30m',
    is_active: true,
    beach_score: 0.6,
    city_score: 0.9,
    adventure_score: 0.3,
    culture_score: 0.8,
    nightlife_score: 0.7,
    nature_score: 0.2,
    food_score: 0.8,
    popularity_score: 0.85,
    ...overrides,
  };
}

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    body: {},
    query: {},
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

describe('GET /api/feed', () => {
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

  it('rejects invalid origin format', async () => {
    const req = makeReq({ query: { origin: 'invalid' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns paginated destinations with default origin', async () => {
    const dests = Array.from({ length: 3 }, (_, i) =>
      makeDest({ $id: `dest-${i}`, iata_code: `D${i}X`, city: `City${i}` }),
    );
    mockListDocuments
      .mockResolvedValueOnce({ documents: dests })
      .mockResolvedValueOnce({ documents: [] });

    const req = makeReq({ query: { origin: uniqueOrigin() } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(3);
    expect(body.nextCursor).toBeNull();
    // Verify camelCase transformation
    expect(body.destinations[0]).toHaveProperty('city');
    expect(body.destinations[0]).toHaveProperty('flightPrice');
    expect(body.destinations[0]).toHaveProperty('vibeTags');
  });

  it('applies maxPrice filter', async () => {
    const dests = [
      makeDest({ $id: 'cheap', flight_price: 200 }),
      makeDest({ $id: 'mid', flight_price: 500 }),
      makeDest({ $id: 'expensive', flight_price: 900 }),
    ];
    mockListDocuments
      .mockResolvedValueOnce({ documents: dests })
      .mockResolvedValueOnce({ documents: [] });

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, maxPrice: '400' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(1);
    expect(body.destinations[0].flightPrice).toBe(200);
  });

  it('applies vibeFilter', async () => {
    const dests = [
      makeDest({ $id: 'beach1', vibe_tags: ['beach', 'tropical'] }),
      makeDest({ $id: 'city1', vibe_tags: ['city', 'nightlife'] }),
    ];
    mockListDocuments
      .mockResolvedValueOnce({ documents: dests })
      .mockResolvedValueOnce({ documents: [] });

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, vibeFilter: 'beach' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.destinations).toHaveLength(1);
    expect(body.destinations[0].id).toBe('beach1');
  });

  it('sorts by cheapest when sortPreset=cheapest', async () => {
    const dests = [
      makeDest({ $id: 'a', flight_price: 800, city: 'A' }),
      makeDest({ $id: 'b', flight_price: 200, city: 'B' }),
      makeDest({ $id: 'c', flight_price: 500, city: 'C' }),
    ];
    mockListDocuments
      .mockResolvedValueOnce({ documents: dests })
      .mockResolvedValueOnce({ documents: [] });

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, sortPreset: 'cheapest' } });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.destinations[0].flightPrice).toBe(200);
    expect(body.destinations[1].flightPrice).toBe(500);
    expect(body.destinations[2].flightPrice).toBe(800);
  });

  it('handles pagination with cursor', async () => {
    const dests = Array.from({ length: 15 }, (_, i) =>
      makeDest({ $id: `d-${i}`, iata_code: `X${String(i).padStart(2, '0')}`, city: `City${i}` }),
    );
    mockListDocuments
      .mockResolvedValueOnce({ documents: dests })
      .mockResolvedValueOnce({ documents: [] });

    const origin = uniqueOrigin();
    const req1 = makeReq({ query: { origin, sortPreset: 'cheapest' } });
    const res1 = makeRes();
    await handler(req1, res1);
    const body1 = res1.json.mock.calls[0][0];
    expect(body1.destinations).toHaveLength(10);
    expect(body1.nextCursor).toBe('10');
  });

  it('merges live prices from cached_prices collection', async () => {
    const dests = [makeDest({ $id: 'dest-bcn', iata_code: 'BCN', flight_price: 450 })];
    const prices = [
      {
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
    ];
    mockListDocuments
      .mockResolvedValueOnce({ documents: dests })
      .mockResolvedValueOnce({ documents: prices });

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin } });
    const res = makeRes();
    await handler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.destinations[0].livePrice).toBe(299);
    expect(body.destinations[0].flightPrice).toBe(299);
    expect(body.destinations[0].airline).toBe('TAP');
    expect(body.destinations[0].priceDirection).toBe('down');
  });

  it('returns 500 on database error', async () => {
    mockListDocuments.mockRejectedValueOnce(new Error('DB down'));
    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets Cache-Control with s-maxage for anonymous requests', async () => {
    mockListDocuments
      .mockResolvedValueOnce({ documents: [] })
      .mockResolvedValueOnce({ documents: [] });

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin } });
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader).toBeDefined();
    expect(cacheHeader![1]).toContain('s-maxage');
  });

  it('sets no-store for session-based requests', async () => {
    mockListDocuments
      .mockResolvedValueOnce({ documents: [] })
      .mockResolvedValueOnce({ documents: [] });

    const origin = uniqueOrigin();
    const req = makeReq({ query: { origin, sessionId: 'abc-123' } });
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader![1]).toBe('no-store');
  });
});
