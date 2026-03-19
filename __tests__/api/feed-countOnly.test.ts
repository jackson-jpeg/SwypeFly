// __tests__/api/feed-countOnly.test.ts
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
    orderAsc: jest.fn((field: string) => `orderAsc:${field}`),
    limit: jest.fn((n: number) => `limit:${n}`),
    search: jest.fn((field: string, value: string) => `search:${field},${value}`),
  },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/feed';

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
    trip_duration_days: 5,
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

describe('feed countOnly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
  });

  it('returns count instead of full results when countOnly=true', async () => {
    const dests = [
      makeDest({ $id: 'co-1', flight_price: 200, vibe_tags: ['beach'] }),
      makeDest({ $id: 'co-2', flight_price: 600, vibe_tags: ['city'] }),
      makeDest({ $id: 'co-3', flight_price: 100, vibe_tags: ['beach'] }),
    ];

    mockListDocuments.mockResolvedValueOnce({ documents: dests, total: 3 });
    mockListDocuments.mockResolvedValueOnce({ documents: [], total: 0 });
    mockListDocuments.mockResolvedValueOnce({ documents: [], total: 0 });
    mockListDocuments.mockResolvedValueOnce({ documents: [], total: 0 });

    const req = makeReq({ query: { origin: 'QQQ', countOnly: 'true', maxPrice: '300' } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ count: 2 });
  });
});
