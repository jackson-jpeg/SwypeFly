import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock node-appwrite before importing handler
const mockListDocuments = jest.fn();
const mockCreateDocument = jest.fn();
const mockUpdateDocument = jest.fn();

const mockVerifyClerkToken = jest.fn();
jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
}));

jest.mock('node-appwrite', () => ({
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
    orderAsc: jest.fn((f: string) => `orderAsc:${f}`),
  },
  ID: { unique: jest.fn(() => 'unique-id') },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 })),
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../services/appwriteServer', () => ({
  DATABASE_ID: 'sogojet',
  COLLECTIONS: { priceAlerts: 'price_alerts', aiCache: 'ai_cache' },
  serverDatabases: {
    listDocuments: (...args: unknown[]) => mockListDocuments(...args),
    createDocument: (...args: unknown[]) => mockCreateDocument(...args),
    updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  },
}));

import handler from '../../api/alerts';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    body: {},
    query: { action: 'create' },
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & { status: jest.Mock; json: jest.Mock };
}

describe('POST /api/alerts/create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
  });

  it('rejects non-POST methods', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects requests without auth header', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);
    const req = makeReq({ headers: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects requests with invalid JWT', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);
    const req = makeReq({
      headers: { authorization: 'Bearer bad-token' },
      body: { destination_id: '550e8400-e29b-41d4-a716-446655440000', target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects invalid body (missing destination_id)', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });
    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid body (negative target_price)', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });
    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { destination_id: '550e8400-e29b-41d4-a716-446655440000', target_price: -50 },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a new alert for authenticated user', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });
    mockListDocuments.mockResolvedValue({ total: 0, documents: [] });
    mockCreateDocument.mockResolvedValue({ $id: 'alert-1', destination_id: '550e8400-e29b-41d4-a716-446655440000' });

    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { destination_id: '550e8400-e29b-41d4-a716-446655440000', target_price: 300 },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created: true }));
    expect(mockCreateDocument).toHaveBeenCalledWith(
      'sogojet',
      'price_alerts',
      'unique-id',
      expect.objectContaining({
        user_id: 'user-123',
        target_price: 300,
      }),
    );
  });

  it('updates existing active alert instead of creating duplicate', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });
    mockListDocuments.mockResolvedValue({
      total: 1,
      documents: [{ $id: 'existing-alert', target_price: 400 }],
    });
    mockUpdateDocument.mockResolvedValue({ $id: 'existing-alert', target_price: 250 });

    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { destination_id: '550e8400-e29b-41d4-a716-446655440000', target_price: 250 },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ updated: true }));
    expect(mockUpdateDocument).toHaveBeenCalledWith(
      'sogojet',
      'price_alerts',
      'existing-alert',
      { target_price: 250 },
    );
  });
});
