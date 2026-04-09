/**
 * Security-focused tests for the booking endpoint.
 * Tests: offer expiry, idempotency, payment-offer mismatch, hotel refund on failure, price markup.
 *
 * These tests exercise the LIVE (non-stub) code paths by setting STUB_MODE = false
 * and mocking Duffel + Stripe dynamic imports.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Supabase chain mock infrastructure (same pattern as swipe.test.ts) ────

const mockResultQueues = new Map<string, Array<{ data: unknown; error: unknown }>>();

function pushResult(table: string, result: { data: unknown; error: unknown }) {
  if (!mockResultQueues.has(table)) mockResultQueues.set(table, []);
  mockResultQueues.get(table)!.push(result);
}

function popResult(table: string): { data: unknown; error: unknown } {
  const queue = mockResultQueues.get(table);
  if (queue && queue.length > 0) return queue.shift()!;
  return { data: null, error: null };
}

const mockInsertCalls: Array<{ table: string; data: unknown }> = [];

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
  chain.update = jest.fn().mockImplementation(() => chain);
  chain.single = jest.fn().mockImplementation(() => {
    const result = popResult(table);
    if (result.error) return Promise.resolve({ data: null, error: result.error });
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
    bookings: 'bookings',
    bookingPassengers: 'booking_passengers',
    savedTravelers: 'saved_travelers',
    cachedPrices: 'cached_prices',
    destinations: 'destinations',
  },
}));

// ─── Duffel mock ────────────────────────────────────────────────────────────

const mockGetOffer = jest.fn();
const mockCreateOrder = jest.fn();
const mockSearchFlights = jest.fn();
const mockGetSeatMap = jest.fn();
const mockCreateStaysBooking = jest.fn();

jest.mock('../../services/duffel', () => ({
  getOffer: (...args: unknown[]) => mockGetOffer(...args),
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
  searchFlights: (...args: unknown[]) => mockSearchFlights(...args),
  getSeatMap: (...args: unknown[]) => mockGetSeatMap(...args),
  createStaysBooking: (...args: unknown[]) => mockCreateStaysBooking(...args),
}));

// ─── Stripe mock ────────────────────────────────────────────────────────────

const mockCreatePaymentIntent = jest.fn();
const mockGetPaymentIntent = jest.fn();
const mockRefundPaymentIntent = jest.fn();

jest.mock('../../services/stripe', () => ({
  createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
  getPaymentIntent: (...args: unknown[]) => mockGetPaymentIntent(...args),
  refundPaymentIntent: (...args: unknown[]) => mockRefundPaymentIntent(...args),
}));

// ─── Other mocks ────────────────────────────────────────────────────────────

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

const mockVerifyClerkToken = jest.fn();
jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
}));

jest.mock('../../utils/duffelMapper', () => ({
  transformSeatMap: jest.fn((s: unknown) => s),
  getErrorMessage: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
  getErrorDetail: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
  getFirstDuffelError: jest.fn(() => null),
  mapOrderSlices: jest.fn(() => []),
  mapOrderPassengers: jest.fn(() => []),
  mapOrderToFlightStatusSegments: jest.fn(() => []),
}));

// Mock env — STUB_MODE = false so we hit the live code paths
const mockEnv: Record<string, unknown> = {
  APPWRITE_ENDPOINT: 'https://test.appwrite.io/v1',
  APPWRITE_PROJECT_ID: 'test-project',
  APPWRITE_API_KEY: 'test-key',
  BOOKING_MARKUP_PERCENT: 3,
  NODE_ENV: 'test',
};
jest.mock('../../utils/env', () => ({
  get env() { return mockEnv; },
  get STUB_MODE() { return false; },
}));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  resetRateLimits: jest.fn(),
}));

// ─── Import handler after all mocks ─────────────────────────────────────────

import handler from '../../api/booking';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePassenger(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pax-1',
    given_name: 'John',
    family_name: 'Doe',
    born_on: '1990-01-15',
    gender: 'm',
    title: 'mr',
    email: 'john@example.com',
    phone_number: '+12125551234',
    ...overrides,
  };
}

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
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Booking Security Features (live mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    mockInsertCalls.length = 0;
    mockEnv.NODE_ENV = 'test';
  });

  // ─── 1. Offer expiry check ────────────────────────────────────────────

  describe('Offer expiry (payment-intent)', () => {
    it('returns 410 OFFER_EXPIRED when offer.expires_at is in the past', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // Duffel returns an offer that expired 1 hour ago
      const expiredDate = new Date(Date.now() - 3600_000).toISOString();
      mockGetOffer.mockResolvedValueOnce({
        id: 'offer-expired',
        total_amount: '287.00',
        total_currency: 'USD',
        expires_at: expiredDate,
        slices: [],
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'payment-intent' },
        headers: { authorization: 'Bearer valid-token' },
        body: { offerId: 'offer-expired', amount: 29561, currency: 'USD' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(410);
      const body = res.json.mock.calls[0][0];
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('OFFER_EXPIRED');
      expect(body.error.message).toMatch(/expired/i);
    });

    it('proceeds normally when offer has not expired', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // Offer expires 30 minutes from now
      const futureDate = new Date(Date.now() + 1800_000).toISOString();
      mockGetOffer.mockResolvedValueOnce({
        id: 'offer-valid',
        total_amount: '287.00',
        total_currency: 'USD',
        expires_at: futureDate,
        slices: [],
      });

      // 287 * 1.03 = 295.61 → 29561 cents
      mockCreatePaymentIntent.mockResolvedValueOnce({
        clientSecret: 'pi_secret_test',
        paymentIntentId: 'pi_test_123',
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'payment-intent' },
        headers: { authorization: 'Bearer valid-token' },
        body: { offerId: 'offer-valid', amount: 29561, currency: 'USD' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('clientSecret');
      expect(body).toHaveProperty('paymentIntentId');
    });
  });

  // ─── 2. Idempotency (create-order) ───────────────────────────────────

  describe('Idempotency (create-order)', () => {
    it('returns existing booking with duplicate: true when paymentIntentId already used', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // Supabase returns an existing booking for this paymentIntentId
      pushResult('bookings', {
        data: {
          id: 'booking-abc',
          booking_reference: 'SGJ-12345',
          status: 'confirmed',
        },
        error: null,
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create-order' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          offerId: 'offer-1',
          passengers: [makePassenger()],
          paymentIntentId: 'pi_already_used',
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.duplicate).toBe(true);
      expect(body.orderId).toBe('booking-abc');
      expect(body.bookingReference).toBe('SGJ-12345');
      expect(body.status).toBe('confirmed');
    });

    it('proceeds to payment verification when no duplicate found', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // Supabase .single() throws when 0 rows (no duplicate) — push nothing so popResult returns null
      // The catch block handles this and continues

      // Stripe returns a succeeded payment
      mockGetPaymentIntent.mockResolvedValueOnce({
        status: 'succeeded',
        metadata: { offerId: 'offer-1' },
        amount: 29561,
        currency: 'usd',
      });

      // Duffel getOffer for expiry/price check
      mockGetOffer.mockResolvedValueOnce({
        id: 'offer-1',
        total_amount: '287.00',
        total_currency: 'USD',
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
        slices: [],
      });

      // Duffel createOrder
      mockCreateOrder.mockResolvedValueOnce({
        id: 'duffel-ord-1',
        booking_reference: 'ABC123',
        slices: [],
        passengers: [],
        total_amount: '287.00',
        total_currency: 'USD',
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create-order' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          offerId: 'offer-1',
          passengers: [makePassenger()],
          paymentIntentId: 'pi_new_payment',
          amount: 29561,
          currency: 'USD',
        },
      });
      const res = makeRes();
      await handler(req, res);

      // Should proceed past idempotency check and call Stripe + Duffel
      expect(mockGetPaymentIntent).toHaveBeenCalledWith('pi_new_payment');
      expect(mockCreateOrder).toHaveBeenCalled();
    });
  });

  // ─── 3. Payment-offer mismatch (create-order) ────────────────────────

  describe('Payment-offer mismatch (create-order)', () => {
    it('rejects when payment intent metadata.offerId does not match requested offerId', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // No duplicate booking
      // (popResult returns null, .single() catch handles it)

      // Stripe payment intent has a DIFFERENT offerId in metadata
      mockGetPaymentIntent.mockResolvedValueOnce({
        status: 'succeeded',
        metadata: { offerId: 'offer-DIFFERENT' },
        amount: 29561,
        currency: 'usd',
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create-order' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          offerId: 'offer-requested',
          passengers: [makePassenger({ given_name: 'Jane' })],
          paymentIntentId: 'pi_mismatched',
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PAYMENT_MISMATCH');
      expect(body.error.message).toMatch(/different offer/i);
    });

    it('allows when payment intent metadata.offerId matches requested offerId', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // Stripe payment intent has matching offerId
      mockGetPaymentIntent.mockResolvedValueOnce({
        status: 'succeeded',
        metadata: { offerId: 'offer-match' },
        amount: 29561,
        currency: 'usd',
      });

      // Duffel getOffer for expiry/price check
      mockGetOffer.mockResolvedValueOnce({
        id: 'offer-match',
        total_amount: '287.00',
        total_currency: 'USD',
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
        slices: [],
      });

      // Duffel createOrder
      mockCreateOrder.mockResolvedValueOnce({
        id: 'duffel-ord-2',
        booking_reference: 'XYZ789',
        slices: [],
        passengers: [],
        total_amount: '287.00',
        total_currency: 'USD',
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create-order' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          offerId: 'offer-match',
          passengers: [makePassenger({ given_name: 'Jane' })],
          paymentIntentId: 'pi_matching',
          amount: 29561,
          currency: 'USD',
        },
      });
      const res = makeRes();
      await handler(req, res);

      // Should proceed past mismatch check
      expect(mockCreateOrder).toHaveBeenCalled();
    });
  });

  // ─── 4. Hotel refund on Duffel failure ────────────────────────────────

  describe('Hotel refund on Duffel failure (hotel-book)', () => {
    it('triggers refund when Duffel createStaysBooking fails after payment succeeded', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // No duplicate booking (Supabase .single() throws → caught)

      // Stripe payment succeeded
      mockGetPaymentIntent.mockResolvedValueOnce({
        status: 'succeeded',
        amount: 15000,
        currency: 'usd',
        metadata: {},
      });

      // Duffel createStaysBooking FAILS
      mockCreateStaysBooking.mockRejectedValueOnce(new Error('Duffel stays booking failed'));

      // Refund should succeed
      mockRefundPaymentIntent.mockResolvedValueOnce({ id: 'refund-1' });

      const req = makeReq({
        method: 'POST',
        query: { action: 'hotel-book' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          quoteId: 'quote-1',
          paymentIntentId: 'pi_hotel_fail',
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
        },
      });
      const res = makeRes();
      await handler(req, res);

      // Refund should have been called
      expect(mockRefundPaymentIntent).toHaveBeenCalledWith('pi_hotel_fail');
      // Should return 500 error since the booking failed
      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.ok).toBe(false);
      expect(body.error.message).toMatch(/refund/i);
    });

    it('still returns error even if refund also fails (CRITICAL path)', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // Stripe payment succeeded
      mockGetPaymentIntent.mockResolvedValueOnce({
        status: 'succeeded',
        amount: 15000,
        currency: 'usd',
        metadata: {},
      });

      // Duffel fails
      mockCreateStaysBooking.mockRejectedValueOnce(new Error('Duffel exploded'));

      // Refund ALSO fails
      mockRefundPaymentIntent.mockRejectedValueOnce(new Error('Stripe refund failed'));

      const req = makeReq({
        method: 'POST',
        query: { action: 'hotel-book' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          quoteId: 'quote-2',
          paymentIntentId: 'pi_hotel_double_fail',
          guestName: 'Jane Doe',
          guestEmail: 'jane@example.com',
        },
      });
      const res = makeRes();
      await handler(req, res);

      // Both were attempted
      expect(mockRefundPaymentIntent).toHaveBeenCalledWith('pi_hotel_double_fail');
      // Still returns 500 — the outer catch handles this
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── 5. Price markup validation ───────────────────────────────────────

  describe('Price markup validation (payment-intent)', () => {
    it('rejects when client amount does not include the 3% markup', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // Duffel base price: $287.00
      // 3% markup: $287 * 0.03 = $8.61 → marked up = $295.61 → 29561 cents
      // Client sends the base price without markup (28700 cents = $287.00)
      const futureDate = new Date(Date.now() + 1800_000).toISOString();
      mockGetOffer.mockResolvedValueOnce({
        id: 'offer-markup',
        total_amount: '287.00',
        total_currency: 'USD',
        expires_at: futureDate,
        slices: [],
      });

      const req = makeReq({
        method: 'POST',
        query: { action: 'payment-intent' },
        headers: { authorization: 'Bearer valid-token' },
        body: { offerId: 'offer-markup', amount: 28700, currency: 'USD' },
      });
      const res = makeRes();
      await handler(req, res);

      // $287 vs expected $295.61 — discrepancy is ~2.9%, well above 0.5% threshold
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('AMOUNT_MISMATCH');
    });

    it('accepts when client amount correctly includes the 3% markup', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // Duffel base price: $287.00
      // Expected with 3% markup: 287 + Math.round(287 * 0.03) = 287 + 9 = $296 → 29600 cents
      const futureDate = new Date(Date.now() + 1800_000).toISOString();
      mockGetOffer.mockResolvedValueOnce({
        id: 'offer-markup-ok',
        total_amount: '287.00',
        total_currency: 'USD',
        expires_at: futureDate,
        slices: [],
      });

      mockCreatePaymentIntent.mockResolvedValueOnce({
        clientSecret: 'pi_secret_markup',
        paymentIntentId: 'pi_markup_ok',
      });

      // 287 + Math.round(287 * 0.03) = 287 + 9 = 296 → 29600 cents
      const req = makeReq({
        method: 'POST',
        query: { action: 'payment-intent' },
        headers: { authorization: 'Bearer valid-token' },
        body: { offerId: 'offer-markup-ok', amount: 29600, currency: 'USD' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCreatePaymentIntent).toHaveBeenCalled();
    });

    it('rejects when currency does not match offer currency', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      const futureDate = new Date(Date.now() + 1800_000).toISOString();
      mockGetOffer.mockResolvedValueOnce({
        id: 'offer-currency',
        total_amount: '287.00',
        total_currency: 'GBP',
        expires_at: futureDate,
        slices: [],
      });

      // Correct amount but wrong currency
      const req = makeReq({
        method: 'POST',
        query: { action: 'payment-intent' },
        headers: { authorization: 'Bearer valid-token' },
        body: { offerId: 'offer-currency', amount: 29600, currency: 'USD' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.error.code).toBe('CURRENCY_MISMATCH');
    });

    it('applies markup correctly for create-order price re-verification', async () => {
      mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

      // No duplicate booking

      // Stripe payment succeeded — paid $296 (287 + 3% markup)
      mockGetPaymentIntent.mockResolvedValueOnce({
        status: 'succeeded',
        metadata: { offerId: 'offer-price-check' },
        amount: 29600,
        currency: 'usd',
      });

      // Duffel price now $350 — markup would be $350 + Math.round(350 * 0.03) = $350 + 11 = $361
      // Client paid $296, expected $361 — difference > $1 → refund + PRICE_CHANGED
      mockGetOffer.mockResolvedValueOnce({
        id: 'offer-price-check',
        total_amount: '350.00',
        total_currency: 'USD',
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
        slices: [],
      });

      mockRefundPaymentIntent.mockResolvedValueOnce({ id: 'refund-price' });

      const req = makeReq({
        method: 'POST',
        query: { action: 'create-order' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          offerId: 'offer-price-check',
          passengers: [makePassenger()],
          paymentIntentId: 'pi_price_changed',
          amount: 29600,
          currency: 'USD',
        },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      const body = res.json.mock.calls[0][0];
      expect(body.error.code).toBe('PRICE_CHANGED');
      // Should have refunded
      expect(mockRefundPaymentIntent).toHaveBeenCalledWith('pi_price_changed');
    });
  });
});
