import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Mock setup ───────────────────────────────────────────────────────────────

let mockQueryResult: { data: unknown; error: unknown; count?: number } = {
  data: [],
  error: null,
  count: 0,
};

const createChain = () => {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'upsert', 'update', 'delete',
    'eq', 'neq', 'in', 'contains', 'ilike',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'range',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.single = jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: Array.isArray(mockQueryResult.data)
        ? mockQueryResult.data[0] ?? null
        : mockQueryResult.data,
      error: mockQueryResult.error,
    }),
  );
  (chain as any).then = jest.fn().mockImplementation((resolve: any) => {
    const result = { data: mockQueryResult.data, error: mockQueryResult.error, count: mockQueryResult.count ?? 0 };
    if (resolve) return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  });
  return chain;
};

let mockChain = createChain();
const mockFrom = jest.fn().mockReturnValue(mockChain);

jest.mock('../../services/supabaseServer', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  TABLES: {
    destinations: 'destinations',
    cachedPrices: 'cached_prices',
    aiCache: 'ai_cache',
    priceAlerts: 'price_alerts',
    savedTravelers: 'saved_travelers',
  },
}));

const mockVerifyClerkToken = jest.fn();
jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

jest.mock('../../utils/env', () => ({
  env: {
    TRAVELER_ENCRYPTION_KEY: '',
    FRONTEND_URL: 'http://localhost:8081',
  },
}));

import handler from '../../api/travelers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    end: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
  };
}

const TRAVELER_ROW = {
  id: 'trav-1',
  user_id: 'user-1',
  given_name: 'John',
  family_name: 'Doe',
  born_on: '1990-01-15',
  gender: 'male',
  title: 'Mr',
  email: 'john@example.com',
  phone_number: '+15551234567',
  passport_number_encrypted: null,
  passport_expiry: null,
  nationality: 'US',
  is_primary: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('/api/travelers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };
  });

  // ─── Invalid action ─────────────────────────────────────────────

  it('returns 400 for missing action', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid action', async () => {
    const req = makeReq({ query: { action: 'bogus' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── List ───────────────────────────────────────────────────────

  describe('action=list', () => {
    it('returns 405 for non-GET method', async () => {
      const req = makeReq({ method: 'POST', query: { action: 'list' } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns 401 without auth', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce(null);
      const req = makeReq({ method: 'GET', query: { action: 'list' } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns travelers list for authenticated user', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = { data: [TRAVELER_ROW], error: null };

      const req = makeReq({
        method: 'GET',
        query: { action: 'list' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('travelers');
      expect(body.travelers).toHaveLength(1);
      expect(body.travelers[0]).toHaveProperty('givenName', 'John');
      expect(body.travelers[0]).toHaveProperty('familyName', 'Doe');
      expect(body.travelers[0]).toHaveProperty('isPrimary', true);
    });

    it('returns empty array when no travelers exist', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = { data: [], error: null };

      const req = makeReq({
        method: 'GET',
        query: { action: 'list' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.travelers).toHaveLength(0);
    });
  });

  // ─── Create ─────────────────────────────────────────────────────

  describe('action=create', () => {
    it('returns 405 for non-POST method', async () => {
      const req = makeReq({ method: 'GET', query: { action: 'create' } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns 401 without auth', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce(null);
      const req = makeReq({
        method: 'POST',
        query: { action: 'create' },
        body: { givenName: 'John', familyName: 'Doe' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 400 for missing required fields', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      const req = makeReq({
        method: 'POST',
        query: { action: 'create' },
        headers: { authorization: 'Bearer token' },
        body: { givenName: 'John' }, // missing familyName
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a new traveler successfully', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const chain = createChain();
        if (callCount === 1) {
          // Count query
          mockQueryResult = { data: [], error: null, count: 0 };
        } else {
          // Insert query
          mockQueryResult = { data: TRAVELER_ROW, error: null };
        }
        return chain;
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create' },
        headers: { authorization: 'Bearer token' },
        body: {
          givenName: 'John',
          familyName: 'Doe',
          bornOn: '1990-01-15',
          nationality: 'US',
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('traveler');
      expect(body.traveler).toHaveProperty('givenName', 'John');
    });

    it('rejects when max travelers reached', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const chain = createChain();
        if (callCount === 1) {
          // Count query returns 10 (max)
          mockQueryResult = { data: [], error: null, count: 10 };
        }
        return chain;
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create' },
        headers: { authorization: 'Bearer token' },
        body: { givenName: 'Extra', familyName: 'Person' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── Update ─────────────────────────────────────────────────────

  describe('action=update', () => {
    it('returns 405 for non-PATCH method', async () => {
      const req = makeReq({ method: 'POST', query: { action: 'update', id: 'trav-1' } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns 401 without auth', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce(null);
      const req = makeReq({
        method: 'PATCH',
        query: { action: 'update', id: 'trav-1' },
        body: { givenName: 'Jane' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 400 when id is missing', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      const req = makeReq({
        method: 'PATCH',
        query: { action: 'update' },
        headers: { authorization: 'Bearer token' },
        body: { givenName: 'Jane' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('updates a traveler successfully', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = {
        data: { ...TRAVELER_ROW, given_name: 'Jane' },
        error: null,
      };

      const req = makeReq({
        method: 'PATCH',
        query: { action: 'update', id: 'trav-1' },
        headers: { authorization: 'Bearer token' },
        body: { givenName: 'Jane' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.traveler).toHaveProperty('givenName', 'Jane');
    });
  });

  // ─── Delete ─────────────────────────────────────────────────────

  describe('action=delete', () => {
    it('returns 405 for non-DELETE method', async () => {
      const req = makeReq({ method: 'POST', query: { action: 'delete', id: 'trav-1' } });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('returns 401 without auth', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce(null);
      const req = makeReq({
        method: 'DELETE',
        query: { action: 'delete', id: 'trav-1' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 400 when id is missing', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      const req = makeReq({
        method: 'DELETE',
        query: { action: 'delete' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('deletes a traveler successfully', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = { data: null, error: null };

      const req = makeReq({
        method: 'DELETE',
        query: { action: 'delete', id: 'trav-1' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });
  });
});
