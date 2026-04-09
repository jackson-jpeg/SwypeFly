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
    swipeHistory: 'swipe_history',
    savedTrips: 'saved_trips',
    userPreferences: 'user_preferences',
    savedTravelers: 'saved_travelers',
    bookings: 'bookings',
  },
}));

const mockVerifyClerkToken = jest.fn();
jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

// Mock global fetch for Clerk API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// CLERK_SECRET_KEY is captured at module load time via (env.CLERK_SECRET_KEY || '').trim()
// So we must set it BEFORE the module is imported.
const mockEnv: Record<string, unknown> = {
  CLERK_SECRET_KEY: 'sk_test_preset_key',
  CLERK_FRONTEND_API: 'clerk.sogojet.com',
  VERCEL_ENV: 'development',
  FRONTEND_URL: 'http://localhost:8081',
};
jest.mock('../../utils/env', () => ({
  get env() { return mockEnv; },
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 })),
  getClientIp: jest.fn(() => '127.0.0.1'),
  resetRateLimits: jest.fn(),
}));

import handler from '../../api/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
    end: jest.Mock;
  };
}

// Helper to create a fake Apple identity token (base64url encoded JWT)
function makeAppleJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('fake-signature').toString('base64url');
  return `${header}.${body}.${sig}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('/api/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };
    mockFetch.mockReset();
  });

  // ─── Invalid action / method ────────────────────────────────────

  it('returns 400 for missing action on POST', async () => {
    const req = makeReq({ method: 'POST', query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 405 for non-POST without recognized action', async () => {
    const req = makeReq({ method: 'GET', query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 for invalid action value', async () => {
    const req = makeReq({ method: 'POST', query: { action: 'bogus' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── Apple Sign In ──────────────────────────────────────────────

  describe('action=apple', () => {
    it('returns 400 when identityToken is missing', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'apple' },
        body: {},
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 401 when Apple token has no email or sub', async () => {
      // JWT with empty payload — no email, no sub
      const token = makeAppleJwt({});
      const req = makeReq({
        method: 'POST',
        query: { action: 'apple' },
        body: { identityToken: token },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('finds existing Clerk user and returns session on Apple sign in', async () => {
      const token = makeAppleJwt({ sub: 'apple-user-1', email: 'test@apple.com' });

      // Mock: search user -> found
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'clerk-user-1' }],
          text: async () => '',
        })
        // Mock: create sign-in token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'sign-in-token-1' }),
          text: async () => '',
        })
        // Mock: redeem ticket -> session with JWT
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            client: {
              sessions: [{
                user_id: 'clerk-user-1',
                last_active_token: { jwt: 'jwt-session-token' },
              }],
            },
          }),
          text: async () => '',
        });

      const req = makeReq({
        method: 'POST',
        query: { action: 'apple' },
        body: { identityToken: token },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('sessionToken', 'jwt-session-token');
      expect(body).toHaveProperty('userId', 'clerk-user-1');
      expect(body).toHaveProperty('email', 'test@apple.com');
    });

    it('creates new Clerk user when not found', async () => {
      const token = makeAppleJwt({ sub: 'apple-new', email: 'new@apple.com' });

      // Search user -> not found (empty array)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
          text: async () => '',
        })
        // Create user
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'new-clerk-user' }),
          text: async () => '',
        })
        // Create sign-in token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'sign-in-token-new' }),
          text: async () => '',
        })
        // Redeem ticket -> session with JWT
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            client: {
              sessions: [{
                user_id: 'new-clerk-user',
                last_active_token: { jwt: 'new-jwt-token' },
              }],
            },
          }),
          text: async () => '',
        });

      const req = makeReq({
        method: 'POST',
        query: { action: 'apple' },
        body: {
          identityToken: token,
          givenName: 'New',
          familyName: 'User',
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('sessionToken', 'new-jwt-token');
      expect(body).toHaveProperty('userId', 'new-clerk-user');
    });

    it('returns 401 when findOrCreateClerkUser fails', async () => {
      const token = makeAppleJwt({ sub: 'apple-fail', email: 'fail@apple.com' });

      // Search fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => 'Internal Server Error',
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'apple' },
        body: { identityToken: token },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ─── OAuth Exchange ─────────────────────────────────────────────

  describe('action=oauth', () => {
    it('returns 400 when code is missing', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'oauth' },
        body: {},
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('Strategy 1: exchanges rotating token for session', async () => {
      // clients/verify succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: [{
              user_id: 'user-abc',
              last_active_token: { jwt: 'real-jwt-token' },
            }],
          }),
          text: async () => '',
        })
        // user fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            email_addresses: [{ email_address: 'user@example.com' }],
            first_name: 'Jane',
            last_name: 'Doe',
          }),
          text: async () => '',
        });

      const req = makeReq({
        method: 'POST',
        query: { action: 'oauth' },
        body: { code: 'rotating-token-123' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('sessionToken', 'real-jwt-token');
      expect(body).toHaveProperty('userId', 'user-abc');
      expect(body).toHaveProperty('email', 'user@example.com');
      expect(body).toHaveProperty('name', 'Jane Doe');
    });

    it('Strategy 2: falls back to ticket exchange', async () => {
      // Strategy 1 fails
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
        })
        // Strategy 2: ticket exchange succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            client: {
              sessions: [{
                user_id: 'user-ticket',
                last_active_token: { jwt: 'ticket-jwt' },
              }],
            },
          }),
          text: async () => '',
        })
        // user fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            email_addresses: [{ email_address: 'ticket@example.com' }],
            first_name: 'Bob',
            last_name: null,
          }),
          text: async () => '',
        });

      const req = makeReq({
        method: 'POST',
        query: { action: 'oauth' },
        body: { code: 'clerk-ticket-code' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('sessionToken', 'ticket-jwt');
      expect(body).toHaveProperty('userId', 'user-ticket');
    });

    it('Strategy 3: falls back to direct JWT verification', async () => {
      // Strategy 1 fails
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'fail',
        })
        // Strategy 2 fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'fail',
        })
        // Strategy 3 user fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            email_addresses: [{ email_address: 'jwt@example.com' }],
            first_name: 'Direct',
            last_name: 'User',
          }),
          text: async () => '',
        });

      // Mock verifyClerkToken to succeed for Strategy 3
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-jwt-direct' });

      const req = makeReq({
        method: 'POST',
        query: { action: 'oauth' },
        body: { code: 'actual-jwt-token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('sessionToken', 'actual-jwt-token');
      expect(body).toHaveProperty('userId', 'user-jwt-direct');
      expect(body).toHaveProperty('email', 'jwt@example.com');
    });

    it('returns 401 when all strategies fail', async () => {
      // Strategy 1 fails
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'fail',
        })
        // Strategy 2 fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'fail',
        });

      // Strategy 3 fails
      mockVerifyClerkToken.mockResolvedValueOnce(null);

      const req = makeReq({
        method: 'POST',
        query: { action: 'oauth' },
        body: { code: 'invalid-code' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ─── Profile (GET) ──────────────────────────────────────────────

  describe('action=profile GET', () => {
    it('returns 401 without auth', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce(null);
      const req = makeReq({
        method: 'GET',
        query: { action: 'profile' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns user profile when authenticated', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'user-1',
          first_name: 'Alice',
          last_name: 'Smith',
          email_addresses: [{ email_address: 'alice@example.com' }],
          image_url: 'https://img.clerk.com/abc',
          created_at: 1700000000000,
        }),
        text: async () => '',
      });

      const req = makeReq({
        method: 'GET',
        query: { action: 'profile' },
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('userId', 'user-1');
      expect(body).toHaveProperty('firstName', 'Alice');
      expect(body).toHaveProperty('lastName', 'Smith');
      expect(body).toHaveProperty('email', 'alice@example.com');
      expect(body).toHaveProperty('name', 'Alice Smith');
    });

    it('returns 502 when Clerk user fetch fails', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'error',
      });

      const req = makeReq({
        method: 'GET',
        query: { action: 'profile' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(502);
    });
  });

  // ─── Profile (PATCH) ───────────────────────────────────────────

  describe('action=profile PATCH', () => {
    it('returns 401 without auth', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce(null);
      const req = makeReq({
        method: 'PATCH',
        query: { action: 'profile' },
        body: { firstName: 'Bob' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 400 when no fields provided', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      const req = makeReq({
        method: 'PATCH',
        query: { action: 'profile' },
        headers: { authorization: 'Bearer token' },
        body: {},
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('updates profile successfully', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'user-1',
          first_name: 'Robert',
          last_name: 'Smith',
          email_addresses: [{ email_address: 'bob@example.com' }],
          image_url: null,
          created_at: 1700000000000,
        }),
        text: async () => '',
      });

      const req = makeReq({
        method: 'PATCH',
        query: { action: 'profile' },
        headers: { authorization: 'Bearer token' },
        body: { firstName: 'Robert' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('firstName', 'Robert');
    });

    it('returns 502 when Clerk update fails', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'error',
      });

      const req = makeReq({
        method: 'PATCH',
        query: { action: 'profile' },
        headers: { authorization: 'Bearer token' },
        body: { firstName: 'Test' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(502);
    });
  });

  // ─── Delete Account ─────────────────────────────────────────────

  describe('action=delete DELETE', () => {
    it('returns 401 without auth', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce(null);
      const req = makeReq({
        method: 'DELETE',
        query: { action: 'delete' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('deletes user data from all tables and returns success', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-to-delete' });
      // Each table purge returns no error
      mockQueryResult = { data: null, error: null };

      // Mock the Clerk delete call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => '',
      });

      const req = makeReq({
        method: 'DELETE',
        query: { action: 'delete' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
      // Should have called supabase.from for each table to purge
      expect(mockFrom).toHaveBeenCalled();
    });

    it('deletes Clerk user and verifies the API call', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-to-delete' });
      mockQueryResult = { data: null, error: null };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => '',
      });

      const req = makeReq({
        method: 'DELETE',
        query: { action: 'delete' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      // Verify Clerk delete was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.clerk.com/v1/users/user-to-delete',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('still returns success even if Clerk deletion fails', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-to-delete' });
      mockQueryResult = { data: null, error: null };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });

      const req = makeReq({
        method: 'DELETE',
        query: { action: 'delete' },
        headers: { authorization: 'Bearer token' },
      });
      const res = makeRes();
      await handler(req, res);

      // Should still return success — Supabase data was deleted
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ deleted: true });
    });
  });
});
