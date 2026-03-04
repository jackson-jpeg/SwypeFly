import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockListDocuments = jest.fn();
const mockCreateDocument = jest.fn();
const mockDeleteDocument = jest.fn();

const mockVerifyClerkToken = jest.fn();
jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
}));

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    listDocuments: mockListDocuments,
    createDocument: mockCreateDocument,
    deleteDocument: mockDeleteDocument,
  })),
  Users: jest.fn().mockImplementation(() => ({})),
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
  },
  ID: { unique: jest.fn(() => 'unique-id') },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/saved';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: { authorization: 'Bearer test-token' },
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

describe('api/saved', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('lists saved destination IDs', async () => {
    mockListDocuments.mockResolvedValue({
      documents: [
        { destination_id: 'dest-1' },
        { destination_id: 'dest-2' },
      ],
    });
    const res = makeRes();
    await handler(makeReq({ query: { action: 'list' } }), res);
    expect(res.json).toHaveBeenCalledWith({ savedIds: ['dest-1', 'dest-2'] });
  });

  it('saves a destination', async () => {
    mockListDocuments.mockResolvedValue({ documents: [] });
    mockCreateDocument.mockResolvedValue({ $id: 'doc-1' });
    const res = makeRes();
    await handler(
      makeReq({ query: { action: 'save' }, body: { destination_id: 'dest-1' } }),
      res,
    );
    expect(mockCreateDocument).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('does not create duplicate when saving same destination twice', async () => {
    // First save: no existing doc
    mockListDocuments.mockResolvedValueOnce({ documents: [] });
    mockCreateDocument.mockResolvedValue({ $id: 'doc-1' });
    const res1 = makeRes();
    await handler(
      makeReq({ query: { action: 'save' }, body: { destination_id: 'dest-1' } }),
      res1,
    );
    expect(mockCreateDocument).toHaveBeenCalledTimes(1);

    // Second save: existing doc found
    mockListDocuments.mockResolvedValueOnce({
      documents: [{ $id: 'doc-1', destination_id: 'dest-1' }],
    });
    const res2 = makeRes();
    await handler(
      makeReq({ query: { action: 'save' }, body: { destination_id: 'dest-1' } }),
      res2,
    );
    // createDocument should NOT have been called again
    expect(mockCreateDocument).toHaveBeenCalledTimes(1);
    expect(res2.json).toHaveBeenCalledWith({ ok: true });
  });

  it('unsaves a destination', async () => {
    mockListDocuments.mockResolvedValue({
      documents: [{ $id: 'doc-1', destination_id: 'dest-1' }],
    });
    mockDeleteDocument.mockResolvedValue({});
    const res = makeRes();
    await handler(
      makeReq({ query: { action: 'unsave' }, body: { destination_id: 'dest-1' } }),
      res,
    );
    expect(mockDeleteDocument).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 400 for save without destination_id', async () => {
    const res = makeRes();
    await handler(makeReq({ query: { action: 'save' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for unknown action', async () => {
    const res = makeRes();
    await handler(makeReq({ query: { action: 'unknown' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
