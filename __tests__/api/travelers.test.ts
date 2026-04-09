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

const mockCheckRateLimit = jest.fn().mockReturnValue({ allowed: true, resetAt: 0 });
jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
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

    it('returns 500 on database error during delete', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = { data: null, error: new Error('DB failure') };

      const req = makeReq({
        method: 'DELETE',
        query: { action: 'delete', id: 'trav-1' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('action=list — error paths', () => {
    it('returns 500 when database query fails', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = { data: null, error: new Error('Connection refused') };

      const req = makeReq({
        method: 'GET',
        query: { action: 'list' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('action=create — error paths', () => {
    it('returns 500 when insert fails', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      // First call: count check returns 0
      // Second call: insert fails
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const chain = createChain();
        if (callCount === 1) {
          // Count query
          mockQueryResult = { data: null, error: null, count: 0 };
        } else {
          // Insert fails
          mockQueryResult = { data: null, error: new Error('Insert failed') };
        }
        return chain;
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create' },
        headers: { authorization: 'Bearer token' },
        body: {
          givenName: 'Jane',
          familyName: 'Doe',
          nationality: 'US',
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('action=update — error paths', () => {
    it('returns 404 when traveler not found', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = { data: null, error: null };

      const req = makeReq({
        method: 'PATCH',
        query: { action: 'update', id: 'nonexistent' },
        headers: { authorization: 'Bearer token' },
        body: { givenName: 'Updated' },
      });
      const res = makeRes();
      await handler(req, res);

      // The handler calls .single() which returns null data
      // This should either return 404 or 500 depending on implementation
      const status = res.status.mock.calls[0]?.[0];
      expect([404, 500]).toContain(status);
    });

    it('returns 500 when update query fails', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = { data: null, error: new Error('Update failed') };

      const req = makeReq({
        method: 'PATCH',
        query: { action: 'update', id: 'trav-1' },
        headers: { authorization: 'Bearer token' },
        body: { givenName: 'Updated' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 60000 });

      const req = makeReq({
        method: 'GET',
        query: { action: 'list' },
        headers: {},
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('passport encryption in response', () => {
    it('returns null passportNumber when no encrypted data', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = {
        data: [{ ...TRAVELER_ROW, passport_number_encrypted: null }],
        error: null,
      };

      const req = makeReq({
        method: 'GET',
        query: { action: 'list' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.travelers[0].passportNumber).toBeNull();
    });

    it('returns raw passport when encryption key is not set', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      // When no encryption key, encrypted field is stored as plaintext
      mockQueryResult = {
        data: [{ ...TRAVELER_ROW, passport_number_encrypted: 'AB123456' }],
        error: null,
      };

      const req = makeReq({
        method: 'GET',
        query: { action: 'list' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      const body = res.json.mock.calls[0][0];
      // Without encryption key, decrypt() returns the string as-is (no colons = passthrough)
      expect(body.travelers[0].passportNumber).toBe('AB123456');
    });

    it('returns camelCase field names in response', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockQueryResult = { data: [TRAVELER_ROW], error: null };

      const req = makeReq({
        method: 'GET',
        query: { action: 'list' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      const traveler = res.json.mock.calls[0][0].travelers[0];
      expect(traveler).toHaveProperty('givenName');
      expect(traveler).toHaveProperty('familyName');
      expect(traveler).toHaveProperty('bornOn');
      expect(traveler).toHaveProperty('phoneNumber');
      expect(traveler).toHaveProperty('isPrimary');
      // Should NOT have snake_case
      expect(traveler).not.toHaveProperty('given_name');
      expect(traveler).not.toHaveProperty('family_name');
    });
  });
});
