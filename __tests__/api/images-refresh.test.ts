const mockDatabases = {
  listDocuments: jest.fn(),
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
  getDocument: jest.fn(),
  deleteDocument: jest.fn(),
};

jest.mock('../../services/appwriteServer', () => ({
  serverDatabases: mockDatabases,
  DATABASE_ID: 'sogojet',
  COLLECTIONS: {
    destinations: 'destinations',
    destinationImages: 'destination_images',
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

const mockSearchImages = jest.fn();
jest.mock('../../services/unsplash', () => ({
  searchDestinationImages: (...args: unknown[]) => mockSearchImages(...args),
}));

import handler, { scoreImage } from '../../api/images/refresh';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UnsplashImage } from '../../services/unsplash';

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

function makeImage(overrides: Partial<UnsplashImage> = {}): UnsplashImage {
  return {
    unsplashId: 'img-1',
    urlRaw: 'https://example.com/raw.jpg',
    urlRegular: 'https://example.com/reg.jpg',
    urlSmall: 'https://example.com/sm.jpg',
    blurHash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    photographer: 'John',
    photographerUrl: 'https://unsplash.com/@john',
    ...overrides,
  };
}

describe('scoreImage', () => {
  test('returns base score of 60 for Unsplash images without blur hash', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const img = makeImage({ blurHash: '' });
    const score = scoreImage(img);
    expect(score).toBe(60);
    jest.spyOn(Math, 'random').mockRestore();
  });

  test('adds 10 points for blur hash', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const img = makeImage({ blurHash: 'LGF5?xYk^6#M' });
    const score = scoreImage(img);
    expect(score).toBe(70);
    jest.spyOn(Math, 'random').mockRestore();
  });

  test('adds random variety up to 10 points', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const img = makeImage({ blurHash: '' });
    const score = scoreImage(img);
    expect(score).toBe(65);
    jest.spyOn(Math, 'random').mockRestore();
  });

  test('returns 50 for Google Places images', () => {
    const img = makeImage();
    const score = scoreImage(img, { isGooglePlaces: true });
    expect(score).toBe(50);
  });
});

describe('api/images/refresh', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.CRON_SECRET = 'test-secret';
    process.env.UNSPLASH_ACCESS_KEY = 'test-unsplash-key';
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

  test('processes batch with quality scoring', async () => {
    mockDatabases.listDocuments
      .mockResolvedValueOnce({
        // destinations
        documents: [
          {
            $id: 'dest-1',
            city: 'Barcelona',
            country: 'Spain',
            unsplash_query: 'barcelona travel',
            is_active: true,
          },
        ],
        total: 1,
      })
      .mockResolvedValueOnce({
        // destination_images (last fetched)
        documents: [],
        total: 0,
      })
      .mockResolvedValueOnce({
        // old images for deletion
        documents: [],
        total: 0,
      });

    mockSearchImages.mockResolvedValue([
      makeImage({ unsplashId: 'img-1', blurHash: 'LGF5?xYk^6#M' }),
      makeImage({ unsplashId: 'img-2', blurHash: '' }),
      makeImage({ unsplashId: 'img-3', blurHash: 'ABC123' }),
    ]);

    mockDatabases.createDocument.mockResolvedValue({ $id: 'img-doc-1' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.refreshed).toHaveLength(1);
    expect(responseData.refreshed[0].city).toBe('Barcelona');
    expect(responseData.refreshed[0].images).toBe(3);
    expect(responseData.refreshed[0].rejected).toBe(0);

    // Verify createDocument was called with quality_score
    expect(mockDatabases.createDocument).toHaveBeenCalledTimes(3);
    const firstCallData = mockDatabases.createDocument.mock.calls[0][3];
    expect(firstCallData).toHaveProperty('quality_score');
    expect(typeof firstCallData.quality_score).toBe('number');
    expect(firstCallData.quality_score).toBeGreaterThan(0);
  });

  test('stores quality_score and sets is_primary on highest scored', async () => {
    // Force deterministic scoring by mocking Math.random
    jest.spyOn(Math, 'random').mockReturnValue(0);

    mockDatabases.listDocuments
      .mockResolvedValueOnce({
        documents: [
          {
            $id: 'dest-1',
            city: 'Paris',
            country: 'France',
            unsplash_query: 'paris travel',
            is_active: true,
          },
        ],
        total: 1,
      })
      .mockResolvedValueOnce({ documents: [], total: 0 })
      .mockResolvedValueOnce({ documents: [], total: 0 });

    // Image with blur hash should score higher (70) than without (60)
    mockSearchImages.mockResolvedValue([
      makeImage({ unsplashId: 'no-blur', blurHash: '' }),
      makeImage({ unsplashId: 'has-blur', blurHash: 'LGF5?xYk^6#M' }),
    ]);

    mockDatabases.createDocument.mockResolvedValue({ $id: 'doc' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    // Should be called twice (2 images)
    expect(mockDatabases.createDocument).toHaveBeenCalledTimes(2);

    // First inserted should be the highest scored (has-blur, score=70)
    const firstCall = mockDatabases.createDocument.mock.calls[0][3];
    expect(firstCall.unsplash_id).toBe('has-blur');
    expect(firstCall.quality_score).toBe(70);
    expect(firstCall.is_primary).toBe(true);

    // Second should be lower scored (no-blur, score=60)
    const secondCall = mockDatabases.createDocument.mock.calls[1][3];
    expect(secondCall.unsplash_id).toBe('no-blur');
    expect(secondCall.quality_score).toBe(60);
    expect(secondCall.is_primary).toBe(false);

    jest.spyOn(Math, 'random').mockRestore();
  });

  test('handles Unsplash API returning no images gracefully', async () => {
    mockDatabases.listDocuments
      .mockResolvedValueOnce({
        documents: [
          {
            $id: 'dest-1',
            city: 'Unknown',
            country: 'Nowhere',
            unsplash_query: '',
            is_active: true,
          },
        ],
        total: 1,
      })
      .mockResolvedValueOnce({ documents: [], total: 0 });

    mockSearchImages.mockResolvedValue([]);

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.refreshed[0].images).toBe(0);
    expect(mockDatabases.createDocument).not.toHaveBeenCalled();
  });

  test('keeps only top 5 images when more are returned', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    mockDatabases.listDocuments
      .mockResolvedValueOnce({
        documents: [
          {
            $id: 'dest-1',
            city: 'Tokyo',
            country: 'Japan',
            unsplash_query: 'tokyo',
            is_active: true,
          },
        ],
        total: 1,
      })
      .mockResolvedValueOnce({ documents: [], total: 0 })
      .mockResolvedValueOnce({ documents: [], total: 0 });

    // Return 8 images — should only store top 5
    const images = Array.from({ length: 8 }, (_, i) =>
      makeImage({ unsplashId: `img-${i}`, blurHash: i < 3 ? 'hash' : '' }),
    );
    mockSearchImages.mockResolvedValue(images);
    mockDatabases.createDocument.mockResolvedValue({ $id: 'doc' });

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockDatabases.createDocument).toHaveBeenCalledTimes(5);

    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.refreshed[0].images).toBe(5);

    jest.spyOn(Math, 'random').mockRestore();
  });
});
