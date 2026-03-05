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

import handler from '../../api/images/refresh';
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

  test('refreshes images for destinations', async () => {
    mockDatabases.listDocuments
      .mockResolvedValueOnce({
        documents: [
          { $id: 'dest-1', city: 'Barcelona', country: 'Spain', unsplash_query: 'barcelona travel', is_active: true },
        ],
        total: 1,
      })
      .mockResolvedValueOnce({
        documents: [],
        total: 0,
      })
      .mockResolvedValueOnce({
        documents: [],
        total: 0,
      });

    mockSearchImages.mockResolvedValue([
      { unsplashId: 'img-1', urlRaw: 'https://example.com/raw.jpg', urlRegular: 'https://example.com/reg.jpg', urlSmall: 'https://example.com/sm.jpg', blurHash: 'abc', photographer: 'John', photographerUrl: 'https://unsplash.com/@john' },
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
    expect(responseData.refreshed[0].images).toBe(1);
  });

  test('handles Unsplash API returning no images gracefully', async () => {
    mockDatabases.listDocuments
      .mockResolvedValueOnce({
        documents: [
          { $id: 'dest-1', city: 'Unknown', country: 'Nowhere', unsplash_query: '', is_active: true },
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
});
