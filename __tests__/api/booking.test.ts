import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockCreateDocument = jest.fn();
const mockListDocuments = jest.fn();

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    createDocument: mockCreateDocument,
    listDocuments: mockListDocuments,
  })),
  Users: jest.fn().mockImplementation(() => ({})),
  ID: { unique: jest.fn(() => 'unique-id') },
  Permission: { read: jest.fn((r: string) => `read:${r}`), delete: jest.fn((r: string) => `delete:${r}`) },
  Role: { user: jest.fn((id: string) => `user:${id}`) },
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
  },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: jest.fn(),
}));

// Must import after mocks are set up
import handler from '../../api/booking';
import { verifyClerkToken } from '../../utils/clerkAuth';
import { resetRateLimits } from '../../utils/rateLimit';

const mockVerifyClerkToken = verifyClerkToken as jest.MockedFunction<typeof verifyClerkToken>;

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

describe('POST /api/booking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
    // Ensure STUB_MODE is active (no Duffel key)
    delete process.env.DUFFEL_API_KEY;
    // Ensure not production so stub mode allows payment-intent/create-order
    process.env.NODE_ENV = 'test';
  });

  // ─── Missing/invalid action ──────────────────────────────────────────────

  it('returns 400 when action is missing', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid action parameter' });
  });

  it('returns 400 for an invalid action', async () => {
    const req = makeReq({ query: { action: 'bogus' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── action=search (stub mode) ──────────────────────────────────────────

  describe('action=search', () => {
    it('returns offers array on valid POST', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'search' },
        body: {
          origin: 'JFK',
          destination: 'BCN',
          departureDate: '2026-04-15',
          passengers: [{ type: 'adult' }],
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      // Response is { offers: [...] } (not a flat array)
      expect(body).toHaveProperty('offers');
      expect(Array.isArray(body.offers)).toBe(true);
      expect(body.offers.length).toBeGreaterThan(0);
      // Each offer should have expected shape
      expect(body.offers[0]).toHaveProperty('id');
      expect(body.offers[0]).toHaveProperty('totalAmount');
      expect(body.offers[0]).toHaveProperty('slices');
      expect(body.offers[0]).toHaveProperty('cabinClass', 'economy');
    });

    it('rejects GET method', async () => {
      const req = makeReq({
        method: 'GET',
        query: { action: 'search' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('validates required fields — missing origin', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'search' },
        body: {
          destination: 'BCN',
          departureDate: '2026-04-15',
          passengers: [{ type: 'adult' }],
        },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('validates required fields — missing destination', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'search' },
        body: {
          origin: 'JFK',
          departureDate: '2026-04-15',
          passengers: [{ type: 'adult' }],
        },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('validates required fields — missing departureDate', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'search' },
        body: {
          origin: 'JFK',
          destination: 'BCN',
          passengers: [{ type: 'adult' }],
        },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('validates required fields — missing passengers', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'search' },
        body: {
          origin: 'JFK',
          destination: 'BCN',
          departureDate: '2026-04-15',
        },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('accepts optional cabinClass parameter', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'search' },
        body: {
          origin: 'JFK',
          destination: 'BCN',
          departureDate: '2026-04-15',
          passengers: [{ type: 'adult' }],
          cabinClass: 'business',
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.offers[0]).toHaveProperty('cabinClass', 'business');
      // Business class should be more expensive than economy
      expect(body.offers[0].totalAmount).toBeGreaterThan(1000);
    });
  });

  // ─── action=offer (stub mode) ───────────────────────────────────────────

  describe('action=offer', () => {
    it('returns offer with seat map on valid GET', async () => {
      const req = makeReq({
        method: 'GET',
        query: { action: 'offer', offerId: 'stub_offer_dl' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('offer');
      expect(body).toHaveProperty('seatMap');
      expect(body.offer).toHaveProperty('id', 'stub_offer_dl');
      expect(body.offer).toHaveProperty('totalAmount');
      expect(body.seatMap).toHaveProperty('columns');
      expect(body.seatMap).toHaveProperty('rows');
      expect(body.seatMap.rows.length).toBe(30);
    });

    it('rejects POST method', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'offer', offerId: 'stub_offer_dl' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('validates required offerId', async () => {
      const req = makeReq({
        method: 'GET',
        query: { action: 'offer' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns deterministic seat map for the same offerId', async () => {
      const req1 = makeReq({
        method: 'GET',
        query: { action: 'offer', offerId: 'test_deterministic' },
      });
      const res1 = makeRes();
      await handler(req1, res1);

      const req2 = makeReq({
        method: 'GET',
        query: { action: 'offer', offerId: 'test_deterministic' },
      });
      const res2 = makeRes();
      await handler(req2, res2);

      const seatMap1 = res1.json.mock.calls[0][0].seatMap;
      const seatMap2 = res2.json.mock.calls[0][0].seatMap;
      expect(seatMap1).toEqual(seatMap2);
    });
  });

  // ─── action=payment-intent (stub mode) ──────────────────────────────────

  describe('action=payment-intent', () => {
    it('allows guest checkout without Authorization header (stub mode)', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'payment-intent' },
        body: { offerId: 'offer-1', amount: 28700, currency: 'USD' },
      });
      const res = makeRes();
      await handler(req, res);
      // Guest checkout returns 200 in stub mode
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns clientSecret when authenticated', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      const req = makeReq({
        method: 'POST',
        query: { action: 'payment-intent' },
        headers: { authorization: 'Bearer valid-token' },
        body: { offerId: 'offer-1', amount: 28700, currency: 'USD' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('clientSecret');
      expect(body).toHaveProperty('paymentIntentId');
      expect(body.clientSecret).toMatch(/^stub_pi_secret_/);
    });

    it('rejects GET method', async () => {
      const req = makeReq({
        method: 'GET',
        query: { action: 'payment-intent' },
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });
  });

  // ─── action=create-order (stub mode) ────────────────────────────────────

  describe('action=create-order', () => {
    it('allows guest checkout without Authorization header (stub mode)', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'create-order' },
        body: {},
      });
      const res = makeRes();
      await handler(req, res);
      // Guest checkout returns 200 in stub mode
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns booking reference in stub mode', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create-order' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          offerId: 'stub_offer_dl',
          passengers: [{ id: 'pax-1', given_name: 'John', family_name: 'Doe' }],
          paymentIntentId: 'pi_test_123',
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('orderId');
      expect(body).toHaveProperty('bookingReference');
      expect(body).toHaveProperty('status', 'confirmed');
      expect(body.bookingReference).toMatch(/^SGJ/);
      expect(body).toHaveProperty('totalPaid');
      expect(body).toHaveProperty('currency', 'USD');
    });

    it('rejects GET method', async () => {
      const req = makeReq({
        method: 'GET',
        query: { action: 'create-order' },
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });
  });

  // ─── action=order (stub mode) ───────────────────────────────────────────

  describe('action=order', () => {
    it('returns 401 without Authorization header', async () => {
      const req = makeReq({
        method: 'GET',
        query: { action: 'order', orderId: 'ord-123' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('returns order details when authenticated', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      const req = makeReq({
        method: 'GET',
        query: { action: 'order', orderId: 'stub_ord_123' },
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('order');
      expect(body.order).toHaveProperty('id', 'stub_ord_123');
      expect(body.order).toHaveProperty('status', 'confirmed');
    });

    it('rejects POST method', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'order', orderId: 'ord-123' },
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });
  });

  // ─── action=webhook (stub mode) ─────────────────────────────────────────

  describe('action=webhook', () => {
    it('returns received: true in stub mode', async () => {
      const req = makeReq({
        method: 'POST',
        query: { action: 'webhook' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('rejects GET method', async () => {
      const req = makeReq({
        method: 'GET',
        query: { action: 'webhook' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });
  });

  // ─── Production stub mode blocks real-money actions ─────────────────────

  describe('production stub mode guard', () => {
    it('returns 503 for payment-intent in production stub mode', async () => {
      process.env.NODE_ENV = 'production';

      const req = makeReq({
        method: 'POST',
        query: { action: 'payment-intent' },
        headers: { authorization: 'Bearer valid-token' },
        body: { offerId: 'offer-1', amount: 28700, currency: 'USD' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: 'Booking service not configured' });
    });

    it('returns 503 for create-order in production stub mode', async () => {
      process.env.NODE_ENV = 'production';

      const req = makeReq({
        method: 'POST',
        query: { action: 'create-order' },
        headers: { authorization: 'Bearer valid-token' },
        body: {},
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: 'Booking service not configured' });
    });
  });
});
