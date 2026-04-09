/**
 * Tests for booking actions not covered by booking.test.ts and booking-security.test.ts:
 * - history (stub mode)
 * - flight-status (stub mode)
 * - hotel-search (stub mode)
 * - hotel-quote (stub mode)
 * - hotel-book (stub mode)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Supabase chain mock infrastructure ────────────────────────────────

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
  chain.insert = jest.fn().mockImplementation(() => chain);
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

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

const mockVerifyClerkToken = jest.fn();
jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
}));

let mockStubMode = true;
const mockEnv: Record<string, unknown> = {
  APPWRITE_ENDPOINT: 'https://test.appwrite.io/v1',
  APPWRITE_PROJECT_ID: 'test-project',
  APPWRITE_API_KEY: 'test-key',
  BOOKING_MARKUP_PERCENT: 3,
  NODE_ENV: 'test',
};

jest.mock('../../utils/env', () => ({
  get env() { return mockEnv; },
  get STUB_MODE() { return mockStubMode; },
}));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  resetRateLimits: jest.fn(),
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

// ─── Duffel mock (for live-mode tests) ─────────────────────────────────────
const mockGetOffer = jest.fn();
const mockCreateOrder = jest.fn();
const mockSearchFlights = jest.fn();
const mockGetSeatMap = jest.fn();

jest.mock('../../services/duffel', () => ({
  getOffer: (...args: unknown[]) => mockGetOffer(...args),
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
  searchFlights: (...args: unknown[]) => mockSearchFlights(...args),
  getSeatMap: (...args: unknown[]) => mockGetSeatMap(...args),
}));

// ─── Stripe mock (for live-mode tests) ─────────────────────────────────────
const mockCreatePaymentIntent = jest.fn();
const mockGetPaymentIntent = jest.fn();
const mockRefundPaymentIntent = jest.fn();

jest.mock('../../services/stripe', () => ({
  createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
  getPaymentIntent: (...args: unknown[]) => mockGetPaymentIntent(...args),
  refundPaymentIntent: (...args: unknown[]) => mockRefundPaymentIntent(...args),
}));

import handler from '../../api/booking';
import { resetRateLimits } from '../../utils/rateLimit';

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

// ─── Tests ──────────────────────────────────────────────────────────────

describe('action=history (stub mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    resetRateLimits();
    mockStubMode = true;
    mockEnv.NODE_ENV = 'test';
  });

  it('returns 401 without Authorization header', async () => {
    const req = makeReq({ query: { action: 'history' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 with invalid token', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce(null);
    const req = makeReq({
      query: { action: 'history' },
      headers: { authorization: 'Bearer invalid' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects POST method', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    const req = makeReq({
      method: 'POST',
      query: { action: 'history' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns bookings array for authenticated user', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    // bookings query
    pushResult('bookings', {
      data: [
        {
          id: 'booking-1',
          duffel_order_id: 'duf-1',
          status: 'confirmed',
          total_amount: 500,
          currency: 'USD',
          passenger_count: 1,
          stripe_payment_intent_id: 'pi_1',
          created_at: '2026-01-15T00:00:00Z',
          destination_city: 'Barcelona',
          destination_iata: 'BCN',
          origin_iata: 'JFK',
          departure_date: '2026-04-01',
          return_date: '2026-04-08',
          airline: 'DL',
          booking_reference: 'SGJ123',
        },
      ],
      error: null,
    });

    // passengers query for booking-1
    pushResult('booking_passengers', {
      data: [
        { given_name: 'John', family_name: 'Doe', email: 'john@example.com' },
      ],
      error: null,
    });

    const req = makeReq({
      query: { action: 'history' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.bookings).toHaveLength(1);
    expect(body.bookings[0]).toEqual(
      expect.objectContaining({
        id: 'booking-1',
        status: 'confirmed',
        destinationCity: 'Barcelona',
        bookingReference: 'SGJ123',
        passengers: [{ givenName: 'John', familyName: 'Doe', email: 'john@example.com' }],
      }),
    );
  });

  it('returns empty bookings when user has none', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    pushResult('bookings', { data: [], error: null });

    const req = makeReq({
      query: { action: 'history' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.bookings).toHaveLength(0);
  });

  it('returns 500 on database error', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    pushResult('bookings', { data: null, error: new Error('DB down') });

    const req = makeReq({
      query: { action: 'history' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('action=flight-status (stub mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    resetRateLimits();
    mockStubMode = true;
    mockEnv.NODE_ENV = 'test';
  });

  it('returns 401 without auth', async () => {
    const req = makeReq({ query: { action: 'flight-status' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects POST method', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    const req = makeReq({
      method: 'POST',
      query: { action: 'flight-status' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 when bookingId is missing', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    const req = makeReq({
      query: { action: 'flight-status' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when booking not found', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    pushResult('bookings', { data: null, error: new Error('Not found') });

    const req = makeReq({
      query: { action: 'flight-status', bookingId: 'nonexistent' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns stub flight status for confirmed booking', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });
    pushResult('bookings', {
      data: { duffel_order_id: null, status: 'confirmed' },
      error: null,
    });

    const req = makeReq({
      query: { action: 'flight-status', bookingId: 'booking-1' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.bookingId).toBe('booking-1');
    expect(body.status).toBe('on_time');
    expect(body.segments).toEqual([]);
    expect(body).toHaveProperty('lastUpdated');
  });
});

describe('action=hotel-search (stub mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    mockStubMode = true;
    mockEnv.NODE_ENV = 'test';
  });

  it('rejects GET method', async () => {
    const req = makeReq({
      method: 'GET',
      query: { action: 'hotel-search' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects invalid body (missing latitude)', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-search' },
      body: {
        longitude: -73.9857,
        checkIn: '2026-05-01',
        checkOut: '2026-05-05',
      },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns stub hotels on valid POST', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-search' },
      body: {
        latitude: 40.7128,
        longitude: -74.006,
        checkIn: '2026-05-01',
        checkOut: '2026-05-05',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);
    expect(body[0]).toHaveProperty('accommodationId');
    expect(body[0]).toHaveProperty('name');
    expect(body[0]).toHaveProperty('cheapestTotalAmount');
    expect(body[0]).toHaveProperty('rooms');
  });
});

describe('action=hotel-quote (stub mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    mockStubMode = true;
    mockEnv.NODE_ENV = 'test';
  });

  it('rejects GET method', async () => {
    const req = makeReq({
      method: 'GET',
      query: { action: 'hotel-quote' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects invalid body', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-quote' },
      body: { accommodationId: 'hotel-1' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns stub quote on valid POST', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-quote' },
      body: {
        accommodationId: 'stub_hotel_1',
        roomId: 'room_1a',
        checkIn: '2026-05-01',
        checkOut: '2026-05-04',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('quoteId');
    expect(body).toHaveProperty('accommodationId', 'stub_hotel_1');
    expect(body).toHaveProperty('roomId', 'room_1a');
    expect(body).toHaveProperty('totalAmount');
    expect(body).toHaveProperty('cancellationPolicy');
    expect(body).toHaveProperty('expiresAt');
  });
});

describe('action=hotel-book (stub mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    mockStubMode = true;
    mockEnv.NODE_ENV = 'test';
  });

  it('returns 401 without auth', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-book' },
      body: {
        quoteId: 'quote-1',
        paymentIntentId: 'pi_1',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
      },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects GET method', async () => {
    const req = makeReq({
      method: 'GET',
      query: { action: 'hotel-book' },
      headers: { authorization: 'Bearer valid' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects invalid body (missing guestEmail)', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-book' },
      headers: { authorization: 'Bearer valid' },
      body: {
        quoteId: 'quote-1',
        paymentIntentId: 'pi_1',
        guestName: 'John Doe',
      },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns stub hotel booking on valid POST', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-book' },
      headers: { authorization: 'Bearer valid' },
      body: {
        quoteId: 'quote-1',
        paymentIntentId: 'pi_1',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('bookingId');
    expect(body).toHaveProperty('confirmationReference');
    expect(body).toHaveProperty('status', 'confirmed');
    expect(body).toHaveProperty('hotelName');
    expect(body).toHaveProperty('totalAmount');
    expect(body.confirmationReference).toMatch(/^SGH/);
  });
});

// ─── Live-mode helpers ─────────────────────────────────────────────────────

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

// ─── create-order (live mode) ──────────────────────────────────────────────

describe('action=create-order (live mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    resetRateLimits();
    mockStubMode = false;
    mockEnv.NODE_ENV = 'test';
  });

  afterAll(() => {
    mockStubMode = true;
  });

  it('creates order successfully with valid offerId, passengers, and paymentIntentId', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    // Idempotency check — no duplicate found (null data)
    pushResult('bookings', { data: null, error: null });

    // Stripe payment succeeded
    mockGetPaymentIntent.mockResolvedValueOnce({
      status: 'succeeded',
      metadata: { offerId: 'offer-live-1' },
      amount: 29600,
      currency: 'usd',
    });

    // Duffel getOffer for expiry/price check
    const futureDate = new Date(Date.now() + 1800_000).toISOString();
    mockGetOffer.mockResolvedValueOnce({
      id: 'offer-live-1',
      total_amount: '287.00',
      total_currency: 'USD',
      expires_at: futureDate,
      slices: [],
    });

    // Duffel createOrder
    mockCreateOrder.mockResolvedValueOnce({
      id: 'duffel-ord-live-1',
      booking_reference: 'LIVE123',
      slices: [
        {
          origin: { iata_code: 'JFK' },
          destination: { iata_code: 'BCN' },
          segments: [{ departing_at: '2026-05-01T08:00:00Z', operating_carrier: { name: 'Delta' } }],
        },
      ],
      passengers: [{ given_name: 'John', family_name: 'Doe' }],
      total_amount: '287.00',
      total_currency: 'USD',
    });

    // DB insert for booking (.insert().select().single())
    pushResult('bookings', {
      data: { id: 'booking-live-1' },
      error: null,
    });

    // DB update for customer_email (.update().eq().then())
    pushResult('bookings', { data: null, error: null });

    // DB insert for passenger
    pushResult('booking_passengers', { data: null, error: null });

    // saved_travelers count check (.select().eq().then())
    pushResult('saved_travelers', { data: null, error: null });

    const req = makeReq({
      method: 'POST',
      query: { action: 'create-order' },
      headers: { authorization: 'Bearer valid-token' },
      body: {
        offerId: 'offer-live-1',
        passengers: [makePassenger()],
        paymentIntentId: 'pi_live_1',
        amount: 29600,
        currency: 'USD',
        destinationCity: 'Barcelona',
        destinationIata: 'BCN',
        originIata: 'JFK',
        departureDate: '2026-05-01',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('orderId', 'booking-live-1');
    expect(body).toHaveProperty('bookingReference', 'LIVE123');
    expect(body).toHaveProperty('status', 'confirmed');
    expect(body).toHaveProperty('totalPaid', 287);
    expect(body).toHaveProperty('currency', 'USD');
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        offerId: 'offer-live-1',
        passengers: expect.arrayContaining([expect.objectContaining({ given_name: 'John' })]),
      }),
    );
  });

  it('creates order with selected services (seat selection)', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    // Idempotency check — no duplicate
    pushResult('bookings', { data: null, error: null });

    mockGetPaymentIntent.mockResolvedValueOnce({
      status: 'succeeded',
      metadata: { offerId: 'offer-seats' },
      amount: 31000,
      currency: 'usd',
    });

    // 300 + Math.round(300 * 0.03) = 300 + 9 = 309 → 30900 cents
    const futureDate = new Date(Date.now() + 1800_000).toISOString();
    mockGetOffer.mockResolvedValueOnce({
      id: 'offer-seats',
      total_amount: '300.00',
      total_currency: 'USD',
      expires_at: futureDate,
      slices: [],
    });

    mockCreateOrder.mockResolvedValueOnce({
      id: 'duffel-ord-seats',
      booking_reference: 'SEAT456',
      slices: [],
      passengers: [{ given_name: 'John', family_name: 'Doe' }],
      total_amount: '300.00',
      total_currency: 'USD',
    });

    // DB insert for booking
    pushResult('bookings', { data: { id: 'booking-seats' }, error: null });
    // DB update for customer_email
    pushResult('bookings', { data: null, error: null });
    // Passenger insert
    pushResult('booking_passengers', { data: null, error: null });
    // saved_travelers check
    pushResult('saved_travelers', { data: null, error: null });

    const req = makeReq({
      method: 'POST',
      query: { action: 'create-order' },
      headers: { authorization: 'Bearer valid-token' },
      body: {
        offerId: 'offer-seats',
        passengers: [makePassenger()],
        paymentIntentId: 'pi_seats',
        amount: 31000,
        currency: 'USD',
        selectedServices: [
          { id: 'seat_12A', quantity: 1 },
          { id: 'seat_12B', quantity: 1 },
        ],
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedServices: [
          { id: 'seat_12A', quantity: 1 },
          { id: 'seat_12B', quantity: 1 },
        ],
      }),
    );
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('bookingReference', 'SEAT456');
  });

  it('returns 400 when passenger is missing required fields', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    const req = makeReq({
      method: 'POST',
      query: { action: 'create-order' },
      headers: { authorization: 'Bearer valid-token' },
      body: {
        offerId: 'offer-1',
        passengers: [{ id: 'pax-1', given_name: 'John' }], // missing family_name, born_on, gender, title, email, phone_number
        paymentIntentId: 'pi_test',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when passengers array is empty', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    const req = makeReq({
      method: 'POST',
      query: { action: 'create-order' },
      headers: { authorization: 'Bearer valid-token' },
      body: {
        offerId: 'offer-1',
        passengers: [],
        paymentIntentId: 'pi_test',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when passenger is missing born_on', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    const req = makeReq({
      method: 'POST',
      query: { action: 'create-order' },
      headers: { authorization: 'Bearer valid-token' },
      body: {
        offerId: 'offer-1',
        passengers: [makePassenger({ born_on: undefined })],
        paymentIntentId: 'pi_test',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('refunds Stripe and returns error when Duffel createOrder fails', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    // Idempotency check — no duplicate
    pushResult('bookings', { data: null, error: null });

    // Stripe payment succeeded
    mockGetPaymentIntent.mockResolvedValueOnce({
      status: 'succeeded',
      metadata: { offerId: 'offer-fail' },
      amount: 29600,
      currency: 'usd',
    });

    // Duffel getOffer succeeds (for price/expiry check)
    const futureDate = new Date(Date.now() + 1800_000).toISOString();
    mockGetOffer.mockResolvedValueOnce({
      id: 'offer-fail',
      total_amount: '287.00',
      total_currency: 'USD',
      expires_at: futureDate,
      slices: [],
    });

    // Duffel createOrder FAILS
    mockCreateOrder.mockRejectedValueOnce(new Error('Duffel API error: insufficient_balance'));

    // Refund succeeds
    mockRefundPaymentIntent.mockResolvedValueOnce({ id: 'refund-1' });

    const req = makeReq({
      method: 'POST',
      query: { action: 'create-order' },
      headers: { authorization: 'Bearer valid-token' },
      body: {
        offerId: 'offer-fail',
        passengers: [makePassenger()],
        paymentIntentId: 'pi_fail',
        amount: 29600,
        currency: 'USD',
      },
    });
    const res = makeRes();
    await handler(req, res);

    // Should have attempted refund
    expect(mockRefundPaymentIntent).toHaveBeenCalledWith('pi_fail');
    // Should return an error status
    expect(res.status).toHaveBeenCalledWith(expect.any(Number));
    const statusCode = res.status.mock.calls[0][0];
    expect(statusCode).toBeGreaterThanOrEqual(400);
  });

  it('returns 402 when payment has not succeeded', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    // Idempotency check — no duplicate
    pushResult('bookings', { data: null, error: null });

    mockGetPaymentIntent.mockResolvedValueOnce({
      status: 'requires_payment_method',
      metadata: { offerId: 'offer-unpaid' },
      amount: 29600,
      currency: 'usd',
    });

    const req = makeReq({
      method: 'POST',
      query: { action: 'create-order' },
      headers: { authorization: 'Bearer valid-token' },
      body: {
        offerId: 'offer-unpaid',
        passengers: [makePassenger()],
        paymentIntentId: 'pi_unpaid',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(402);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
  });
});

// ─── payment-intent (live mode) ────────────────────────────────────────────

describe('action=payment-intent (live mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    resetRateLimits();
    mockStubMode = false;
    mockEnv.NODE_ENV = 'test';
  });

  afterAll(() => {
    mockStubMode = true;
  });

  it('returns clientSecret and paymentIntentId on success', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    const futureDate = new Date(Date.now() + 1800_000).toISOString();
    mockGetOffer.mockResolvedValueOnce({
      id: 'offer-pi-1',
      total_amount: '287.00',
      total_currency: 'USD',
      expires_at: futureDate,
      slices: [],
    });

    mockCreatePaymentIntent.mockResolvedValueOnce({
      clientSecret: 'pi_secret_live_abc',
      paymentIntentId: 'pi_live_abc',
    });

    // 287 + Math.round(287 * 0.03) = 287 + 9 = 296 → 29600 cents
    const req = makeReq({
      method: 'POST',
      query: { action: 'payment-intent' },
      headers: { authorization: 'Bearer valid-token' },
      body: { offerId: 'offer-pi-1', amount: 29600, currency: 'USD' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('clientSecret', 'pi_secret_live_abc');
    expect(body).toHaveProperty('paymentIntentId', 'pi_live_abc');
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      29600,
      'USD',
      expect.objectContaining({ userId: 'user-1', offerId: 'offer-pi-1' }),
    );
  });

  it('returns 410 when offer has expired', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    const expiredDate = new Date(Date.now() - 3600_000).toISOString();
    mockGetOffer.mockResolvedValueOnce({
      id: 'offer-expired-pi',
      total_amount: '287.00',
      total_currency: 'USD',
      expires_at: expiredDate,
      slices: [],
    });

    const req = makeReq({
      method: 'POST',
      query: { action: 'payment-intent' },
      headers: { authorization: 'Bearer valid-token' },
      body: { offerId: 'offer-expired-pi', amount: 29600, currency: 'USD' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(410);
    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('OFFER_EXPIRED');
    expect(body.error.message).toMatch(/expired/i);
  });

  it('returns 400 when offer cannot be fetched', async () => {
    mockVerifyClerkToken.mockResolvedValueOnce({ userId: 'user-1' });

    mockGetOffer.mockRejectedValueOnce(new Error('Offer not found'));

    const req = makeReq({
      method: 'POST',
      query: { action: 'payment-intent' },
      headers: { authorization: 'Bearer valid-token' },
      body: { offerId: 'offer-gone', amount: 29600, currency: 'USD' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('OFFER_VERIFICATION_FAILED');
  });

  it('allows guest checkout without auth header', async () => {
    const futureDate = new Date(Date.now() + 1800_000).toISOString();
    mockGetOffer.mockResolvedValueOnce({
      id: 'offer-guest',
      total_amount: '200.00',
      total_currency: 'USD',
      expires_at: futureDate,
      slices: [],
    });

    mockCreatePaymentIntent.mockResolvedValueOnce({
      clientSecret: 'pi_secret_guest',
      paymentIntentId: 'pi_guest',
    });

    // 200 + Math.round(200 * 0.03) = 200 + 6 = 206 → 20600 cents
    const req = makeReq({
      method: 'POST',
      query: { action: 'payment-intent' },
      body: { offerId: 'offer-guest', amount: 20600, currency: 'USD' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('clientSecret');
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      20600,
      'USD',
      expect.objectContaining({ userId: 'guest' }),
    );
  });
});

// ─── hotel-quote (live mode — stays in stub since Duffel Stays is not used yet) ─

describe('action=hotel-quote (stub mode, extended)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    mockStubMode = true;
    mockEnv.NODE_ENV = 'test';
  });

  it('returns quote with pricing breakdown and cancellation policy', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-quote' },
      body: {
        accommodationId: 'stub_hotel_2',
        roomId: 'room_2b',
        checkIn: '2026-06-01',
        checkOut: '2026-06-05',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('quoteId');
    expect(typeof body.quoteId).toBe('string');
    expect(body).toHaveProperty('accommodationId', 'stub_hotel_2');
    expect(body).toHaveProperty('roomId', 'room_2b');
    expect(body).toHaveProperty('totalAmount');
    expect(typeof body.totalAmount).toBe('number');
    expect(body.totalAmount).toBeGreaterThan(0);
    expect(body).toHaveProperty('currency');
    expect(body).toHaveProperty('cancellationPolicy');
    expect(body).toHaveProperty('expiresAt');
    // Expiry should be in the future
    const expiresAt = new Date(body.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects when checkIn date format is invalid', async () => {
    const req = makeReq({
      method: 'POST',
      query: { action: 'hotel-quote' },
      body: {
        accommodationId: 'stub_hotel_1',
        roomId: 'room_1a',
        checkIn: 'not-a-date',
        checkOut: '2026-06-05',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
