import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UnsplashImage } from '../../services/unsplash';

// ─── Supabase mock infrastructure ──────────────────────────────────────────

const mockResultQueues = new Map<string, Array<{ data: unknown; error: unknown }>>();

function pushResult(table: string, result: { data: unknown; error: unknown }) {
  if (!mockResultQueues.has(table)) mockResultQueues.set(table, []);
  mockResultQueues.get(table)!.push(result);
}

function popResult(table: string): { data: unknown; error: unknown } {
  const queue = mockResultQueues.get(table);
  if (queue && queue.length > 0) return queue.shift()!;
  return { data: [], error: null };
}

const mockInsertCalls: Array<{ table: string; data: unknown }> = [];
const mockUpdateCalls: Array<{ table: string; data: unknown }> = [];
const mockDeleteCalls: Array<{ table: string }> = [];

const createChain = (table: string) => {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'eq', 'neq', 'in', 'contains', 'ilike',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'range', 'match',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.insert = jest.fn().mockImplementation((data: unknown) => {
    mockInsertCalls.push({ table, data });
    return chain;
  });
  chain.update = jest.fn().mockImplementation((data: unknown) => {
    mockUpdateCalls.push({ table, data });
    return chain;
  });
  chain.delete = jest.fn().mockImplementation(() => {
    mockDeleteCalls.push({ table });
    return chain;
  });
  chain.single = jest.fn().mockImplementation(() => {
    const result = popResult(table);
    if (result.error) return Promise.reject(result.error);
    return Promise.resolve({
      data: Array.isArray(result.data) ? (result.data as unknown[])[0] ?? null : result.data,
      error: null,
    });
  });
  (chain as any).then = jest.fn().mockImplementation((resolve: any) => {
    const result = popResult(table);
    if (resolve) return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  });
  return chain;
};

const mockFrom = jest.fn().mockImplementation((table: string) => createChain(table));

jest.mock('../../services/supabaseServer', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  TABLES: {
    destinations: 'destinations',
    destinationImages: 'destination_images',
  },
}));

jest.mock('../../utils/env', () => ({
  env: {
    get CRON_SECRET() {
      return process.env.CRON_SECRET;
    },
    UNSPLASH_ACCESS_KEY: 'test-key',
  },
}));

jest.mock('../../utils/config', () => ({
  IMAGE_BATCH_SIZE: 5,
}));

jest.mock('../../utils/apiLogger', () => ({ logApiError: jest.fn() }));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

const mockSearchImages = jest.fn();
jest.mock('../../services/unsplash', () => ({
  searchDestinationImages: (...args: unknown[]) => mockSearchImages(...args),
}));

import handler, { scoreImage } from '../../api/images/refresh';

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
    mockResultQueues.clear();
    mockInsertCalls.length = 0;
    mockUpdateCalls.length = 0;
    mockDeleteCalls.length = 0;
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

  test('processes batch with quality scoring', async () => {
    // 1. destinations fetch
    pushResult('destinations', {
      data: [
        {
          id: 'dest-1',
          city: 'Barcelona',
          country: 'Spain',
          unsplash_query: 'barcelona travel',
        },
      ],
      error: null,
    });
    // 2. destination_images metadata fetch
    pushResult('destination_images', { data: [], error: null });
    // 3. destination_images delete old
    pushResult('destination_images', { data: null, error: null });
    // 4. destination_images insert new
    pushResult('destination_images', { data: null, error: null });

    mockSearchImages.mockResolvedValue([
      makeImage({ unsplashId: 'img-1', blurHash: 'LGF5?xYk^6#M' }),
      makeImage({ unsplashId: 'img-2', blurHash: '' }),
      makeImage({ unsplashId: 'img-3', blurHash: 'ABC123' }),
    ]);

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

    // Verify insert was called with quality_score fields
    expect(mockInsertCalls.length).toBe(1);
    expect(mockInsertCalls[0].table).toBe('destination_images');
    const insertedImages = mockInsertCalls[0].data as any[];
    expect(insertedImages).toHaveLength(3);
    expect(insertedImages[0]).toHaveProperty('quality_score');
    expect(typeof insertedImages[0].quality_score).toBe('number');
    expect(insertedImages[0].quality_score).toBeGreaterThan(0);
  });

  test('stores quality_score and sets is_primary on highest scored', async () => {
    // Force deterministic scoring by mocking Math.random
    jest.spyOn(Math, 'random').mockReturnValue(0);

    // 1. destinations
    pushResult('destinations', {
      data: [
        {
          id: 'dest-1',
          city: 'Paris',
          country: 'France',
          unsplash_query: 'paris travel',
        },
      ],
      error: null,
    });
    // 2. destination_images metadata
    pushResult('destination_images', { data: [], error: null });
    // 3. destination_images delete
    pushResult('destination_images', { data: null, error: null });
    // 4. destination_images insert
    pushResult('destination_images', { data: null, error: null });

    // Image with blur hash should score higher (70) than without (60)
    mockSearchImages.mockResolvedValue([
      makeImage({ unsplashId: 'no-blur', blurHash: '' }),
      makeImage({ unsplashId: 'has-blur', blurHash: 'LGF5?xYk^6#M' }),
    ]);

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    // Handler inserts all images as one batch
    expect(mockInsertCalls.length).toBe(1);
    const insertedImages = mockInsertCalls[0].data as any[];
    expect(insertedImages).toHaveLength(2);

    // First inserted should be the highest scored (has-blur, score=70)
    expect(insertedImages[0].unsplash_id).toBe('has-blur');
    expect(insertedImages[0].quality_score).toBe(70);
    expect(insertedImages[0].is_primary).toBe(true);

    // Second should be lower scored (no-blur, score=60)
    expect(insertedImages[1].unsplash_id).toBe('no-blur');
    expect(insertedImages[1].quality_score).toBe(60);
    expect(insertedImages[1].is_primary).toBe(false);

    jest.spyOn(Math, 'random').mockRestore();
  });

  test('handles Unsplash API returning no images gracefully', async () => {
    // 1. destinations
    pushResult('destinations', {
      data: [
        {
          id: 'dest-1',
          city: 'Unknown',
          country: 'Nowhere',
          unsplash_query: '',
        },
      ],
      error: null,
    });
    // 2. destination_images metadata
    pushResult('destination_images', { data: [], error: null });

    mockSearchImages.mockResolvedValue([]);

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.refreshed[0].images).toBe(0);
    expect(mockInsertCalls.length).toBe(0);
  });

  test('keeps only top 5 images when more are returned', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    // 1. destinations
    pushResult('destinations', {
      data: [
        {
          id: 'dest-1',
          city: 'Tokyo',
          country: 'Japan',
          unsplash_query: 'tokyo',
        },
      ],
      error: null,
    });
    // 2. destination_images metadata
    pushResult('destination_images', { data: [], error: null });
    // 3. destination_images delete
    pushResult('destination_images', { data: null, error: null });
    // 4. destination_images insert
    pushResult('destination_images', { data: null, error: null });

    // Return 8 images — should only store top 5
    const images = Array.from({ length: 8 }, (_, i) =>
      makeImage({ unsplashId: `img-${i}`, blurHash: i < 3 ? 'hash' : '' }),
    );
    mockSearchImages.mockResolvedValue(images);

    const req = makeReq({
      headers: { authorization: 'Bearer test-secret' } as any,
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    // One batch insert with 5 images
    expect(mockInsertCalls.length).toBe(1);
    const insertedImages = mockInsertCalls[0].data as any[];
    expect(insertedImages).toHaveLength(5);

    const responseData = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseData.refreshed[0].images).toBe(5);

    jest.spyOn(Math, 'random').mockRestore();
  });
});
