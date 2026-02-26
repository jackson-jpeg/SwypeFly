import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockGet = jest.fn();
const mockListDocuments = jest.fn();
const mockCreateDocument = jest.fn();
const mockUpdateDocument = jest.fn();
const mockGetDocument = jest.fn();

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setJWT: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Account: jest.fn().mockImplementation(() => ({
    get: mockGet,
  })),
  Databases: jest.fn().mockImplementation(() => ({
    listDocuments: mockListDocuments,
    createDocument: mockCreateDocument,
    updateDocument: mockUpdateDocument,
    getDocument: mockGetDocument,
  })),
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
  },
  ID: { unique: jest.fn(() => 'unique-id') },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/swipe';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
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
  };
  return res as unknown as VercelResponse & { status: jest.Mock; json: jest.Mock };
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('POST /api/swipe', () => {
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
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects requests with malformed auth header', async () => {
    const req = makeReq({ headers: { authorization: 'Token abc' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects invalid body', async () => {
    mockGet.mockResolvedValue({ $id: 'user-123' });
    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { action: 'liked' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('records swipe and returns ok for valid request', async () => {
    mockGet.mockResolvedValue({ $id: 'user-123' });
    mockCreateDocument.mockResolvedValue({});
    mockGetDocument.mockResolvedValue({
      beach_score: 0.8,
      city_score: 0.3,
      adventure_score: 0.5,
      culture_score: 0.7,
      nightlife_score: 0.4,
      nature_score: 0.6,
      food_score: 0.9,
    });
    mockListDocuments.mockResolvedValue({
      documents: [
        {
          $id: 'prefs-1',
          pref_beach: 0.5,
          pref_city: 0.5,
          pref_adventure: 0.5,
          pref_culture: 0.5,
          pref_nightlife: 0.5,
          pref_nature: 0.5,
          pref_food: 0.5,
        },
      ],
    });
    mockUpdateDocument.mockResolvedValue({});

    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        destination_id: VALID_UUID,
        action: 'saved',
        time_spent_ms: 3000,
        price_shown: 499,
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(mockCreateDocument).toHaveBeenCalled();
  });
});
