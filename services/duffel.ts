// ─── Duffel API Service Layer ────────────────────────────────────────────────
// Live flight inventory, seat maps, and ticketing via Duffel.
// Used for transactional booking flow (not discovery pricing).

import { Duffel } from '@duffel/api';
import type {
  CreateOrderPassenger,
  OrderPassengerIdentityDocument,
  StaysSearchParams as DuffelStaysSearchParams,
} from '@duffel/api/types';
import { env } from '../utils/env';

// ─── Internal types for untyped / mismatched Duffel SDK Stays endpoints ─────
// The Duffel Stays quotes & bookings APIs accept richer payloads than the
// SDK typings currently expose.  We define local request shapes and cast
// the response to the known SDK result types.

/** @internal payload for the Stays quote creation endpoint (SDK types lag behind) */
interface StaysQuoteCreatePayload {
  accommodation_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  guests: { type: 'adult' | 'child'; age?: number }[];
}

/** @internal payload for the Stays booking creation endpoint (SDK types lag behind) */
interface StaysBookingCreatePayload {
  quote_id: string;
  guests: { given_name: string; family_name: string; email: string }[];
  payments: { type: 'balance'; amount: string; currency: string }[];
}

/** @internal raw response shape for Stays quote (SDK types may lag behind API) */
interface StaysQuoteRaw {
  id: string;
  accommodation?: { id?: string; name?: string };
  room?: { id?: string; name?: string };
  total_amount?: string;
  total_currency?: string;
  check_in_date?: string;
  check_out_date?: string;
  cancellation_policy?: { summary?: string };
  expires_at?: string;
}

/** @internal raw response shape for Stays booking */
interface StaysBookingRaw {
  id: string;
  booking_reference?: string;
  confirmation_code?: string;
  status?: string;
  accommodation?: { name?: string };
  check_in_date?: string;
  check_out_date?: string;
  total_amount?: string;
  total_currency?: string;
}

/** @internal raw response shape for Stays search */
interface StaysSearchRaw {
  results?: Array<{
    id?: string;
    accommodation?: {
      id?: string;
      name?: string;
      rating?: number | null;
      review_score?: number | null;
      review_count?: number | null;
      photos?: { url?: string }[];
      rooms?: { rates?: { board_type?: string }[] }[];
    };
    cheapest_rate_total_amount?: string;
    cheapest_rate_currency?: string;
  }>;
}

const DUFFEL_API_KEY = (env.DUFFEL_API_KEY || '').trim();

let _client: Duffel | null = null;

function getClient(): Duffel {
  if (!_client) {
    if (!DUFFEL_API_KEY) {
      throw new Error('DUFFEL_API_KEY is not configured');
    }
    _client = new Duffel({ token: DUFFEL_API_KEY });
  }
  return _client;
}

// Timeout wrapper for Duffel API calls to prevent Vercel function hangs
const DUFFEL_TIMEOUT_MS = 15_000;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Duffel ${label} timed out after ${DUFFEL_TIMEOUT_MS}ms`)), DUFFEL_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: { type: 'adult' | 'child' | 'infant_without_seat' }[];
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface PassengerInfo {
  given_name: string;
  family_name: string;
  born_on: string;
  gender: 'f' | 'm';
  title: 'mr' | 'mrs' | 'ms' | 'miss' | 'dr';
  email: string;
  phone_number: string;
  passport_number?: string;
  passport_expiry?: string;   // YYYY-MM-DD
  nationality?: string;       // ISO 3166-1 alpha-2 country code
}

export interface CreateOrderParams {
  offerId: string;
  passengers: (PassengerInfo & { id: string })[];
  selectedServices?: { id: string; quantity: number }[];
  paymentAmount: string;
  paymentCurrency: string;
}

// ─── Flight Search ──────────────────────────────────────────────────────────

export async function searchFlights(params: FlightSearchParams) {
  const client = getClient();

  const slices = [
    {
      origin: params.origin,
      destination: params.destination,
      departure_date: params.departureDate,
    },
  ];

  // Add return slice for round trips
  if (params.returnDate) {
    slices.push({
      origin: params.destination,
      destination: params.origin,
      departure_date: params.returnDate,
    });
  }

  const response = await withTimeout(
    client.offerRequests.create({
      slices: slices.map((s) => ({
        ...s,
        arrival_time: null,
        departure_time: null,
      })),
      // SDK requires discriminated union: adults use { type }, children use { age }.
      // Our search always sends adults; cast non-adult passengers through unknown.
      passengers: params.passengers.map((p) =>
        p.type === 'adult'
          ? { type: 'adult' as const }
          : ({ type: p.type } as unknown as { age: number }),
      ),
      cabin_class: params.cabinClass || 'economy',
      return_offers: true,
    }),
    'searchFlights',
  );

  return response.data;
}

// ─── Get Single Offer ───────────────────────────────────────────────────────

export async function getOffer(offerId: string) {
  const client = getClient();
  const response = await withTimeout(
    client.offers.get(offerId, { return_available_services: true }),
    'getOffer',
  );
  return response.data;
}

// ─── Get Seat Map ───────────────────────────────────────────────────────────

export async function getSeatMap(offerId: string) {
  const client = getClient();
  const response = await withTimeout(
    client.seatMaps.get({ offer_id: offerId }),
    'getSeatMap',
  );
  return response.data;
}

// ─── Create Order (Book + Issue Ticket) ─────────────────────────────────────

export async function createOrder(params: CreateOrderParams) {
  const client = getClient();

  const response = await withTimeout(client.orders.create({
    type: 'instant',
    selected_offers: [params.offerId],
    passengers: params.passengers.map((p) => {
      const identityDocuments: OrderPassengerIdentityDocument[] | undefined =
        p.passport_number && p.passport_expiry
          ? [
              {
                unique_identifier: p.passport_number,
                expires_on: p.passport_expiry,
                issuing_country_code: p.nationality || 'US',
                type: 'passport',
              },
            ]
          : undefined;

      const passenger: CreateOrderPassenger = {
        id: p.id,
        given_name: p.given_name,
        family_name: p.family_name,
        born_on: p.born_on,
        gender: p.gender,
        title: p.title,
        email: p.email,
        phone_number: p.phone_number,
        ...(identityDocuments ? { identity_documents: identityDocuments } : {}),
      };

      return passenger;
    }),
    services: params.selectedServices || [],
    payments: [
      {
        type: 'balance' as const,
        amount: params.paymentAmount,
        currency: params.paymentCurrency,
      },
    ],
  }), 'createOrder');

  return response.data;
}

// ─── Get Order Details ──────────────────────────────────────────────────────

export async function getOrder(orderId: string) {
  const client = getClient();
  const response = await withTimeout(
    client.orders.get(orderId),
    'getOrder',
  );
  return response.data;
}

// ─── Stays Search ───────────────────────────────────────────────────────────

export interface StaysSearchParams {
  latitude: number;
  longitude: number;
  radius: number;
  checkIn: string;
  checkOut: string;
  rooms?: number;
  guests?: { type: 'adult' | 'child'; age?: number }[];
}

export interface StaysHotelResult {
  accommodationId: string;
  name: string;
  rating: number | null;
  reviewScore: number | null;
  reviewCount: number | null;
  photoUrl: string | null;
  cheapestTotalAmount: number;
  currency: string;
  boardType: string | null;
}

// ─── Stays Quote ───────────────────────────────────────────────────────────

export interface StaysQuoteParams {
  accommodationId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
}

export interface StaysQuoteResult {
  quoteId: string;
  accommodationId: string;
  roomId: string;
  totalAmount: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  cancellationPolicy: string | null;
  expiresAt: string;
  hotelName: string;
  roomName: string;
}

export async function getStaysQuote(params: StaysQuoteParams): Promise<StaysQuoteResult> {
  const client = getClient();

  // Duffel Stays quotes endpoint — SDK types don't fully cover the payload shape
  const payload: StaysQuoteCreatePayload = {
    accommodation_id: params.accommodationId,
    room_id: params.roomId,
    check_in_date: params.checkIn,
    check_out_date: params.checkOut,
    guests: [{ type: 'adult' }],
  };
  const response = await (
    client.stays.quotes as unknown as { create: (p: StaysQuoteCreatePayload) => Promise<{ data: StaysQuoteRaw }> }
  ).create(payload);

  const data: StaysQuoteRaw = response.data;

  return {
    quoteId: data.id ?? '',
    accommodationId: data.accommodation?.id ?? params.accommodationId,
    roomId: data.room?.id ?? params.roomId,
    totalAmount: parseFloat(data.total_amount ?? '0'),
    currency: data.total_currency ?? 'USD',
    checkIn: data.check_in_date ?? params.checkIn,
    checkOut: data.check_out_date ?? params.checkOut,
    cancellationPolicy: data.cancellation_policy?.summary ?? null,
    expiresAt: data.expires_at ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    hotelName: data.accommodation?.name ?? '',
    roomName: data.room?.name ?? '',
  };
}

// ─── Stays Booking ─────────────────────────────────────────────────────────

export interface StaysBookingParams {
  quoteId: string;
  guestName: string;
  guestEmail: string;
  paymentAmount: string;
  paymentCurrency: string;
}

export interface StaysBookingResult {
  bookingId: string;
  confirmationReference: string;
  status: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency: string;
}

export async function createStaysBooking(params: StaysBookingParams): Promise<StaysBookingResult> {
  const client = getClient();

  const [givenName, ...rest] = params.guestName.split(' ');
  const familyName = rest.join(' ') || givenName;

  const payload: StaysBookingCreatePayload = {
    quote_id: params.quoteId,
    guests: [{
      given_name: givenName,
      family_name: familyName,
      email: params.guestEmail,
    }],
    payments: [{
      type: 'balance',
      amount: params.paymentAmount,
      currency: params.paymentCurrency,
    }],
  };
  const response = await (
    client.stays.bookings as unknown as { create: (p: StaysBookingCreatePayload) => Promise<{ data: StaysBookingRaw }> }
  ).create(payload);

  const data: StaysBookingRaw = response.data;

  return {
    bookingId: data.id ?? '',
    confirmationReference: data.booking_reference ?? data.confirmation_code ?? '',
    status: data.status ?? 'confirmed',
    hotelName: data.accommodation?.name ?? '',
    checkIn: data.check_in_date ?? '',
    checkOut: data.check_out_date ?? '',
    totalAmount: parseFloat(data.total_amount ?? '0'),
    currency: data.total_currency ?? 'USD',
  };
}

// ─── Stays Search ───────────────────────────────────────────────────────────

export async function searchStays(params: StaysSearchParams): Promise<StaysHotelResult[]> {
  const client = getClient();

  // Map local guest type to SDK Guest union (Adult | Child)
  const guests = (params.guests ?? [{ type: 'adult' as const }]).map((g) =>
    g.type === 'adult'
      ? { type: 'adult' as const, ...(g.age != null ? { age: g.age } : {}) }
      : { type: 'child' as const, age: g.age ?? 10 },
  );
  const searchParams: DuffelStaysSearchParams = {
    rooms: params.rooms ?? 1,
    guests,
    check_in_date: params.checkIn,
    check_out_date: params.checkOut,
    location: {
      radius: params.radius,
      geographic_coordinates: {
        latitude: params.latitude,
        longitude: params.longitude,
      },
    },
  };
  const response = await client.stays.search(searchParams);

  const results: StaysHotelResult[] = [];
  const data = response.data as unknown as StaysSearchRaw;
  const searchResults = data?.results ?? [];

  for (const sr of searchResults) {
    const acc = sr.accommodation;
    if (!acc) continue;

    const photoUrl = acc.photos?.[0]?.url ?? null;

    // Find board_type from first room's cheapest rate
    let boardType: string | null = null;
    const rooms = acc.rooms ?? [];
    const firstRate = rooms[0]?.rates?.[0];
    if (firstRate) {
      boardType = firstRate.board_type ?? null;
    }

    results.push({
      accommodationId: acc.id ?? sr.id ?? '',
      name: acc.name ?? 'Unknown Hotel',
      rating: acc.rating ?? null,
      reviewScore: acc.review_score ?? null,
      reviewCount: acc.review_count ?? null,
      photoUrl,
      cheapestTotalAmount: parseFloat(sr.cheapest_rate_total_amount ?? '0'),
      currency: sr.cheapest_rate_currency ?? 'USD',
      boardType,
    });
  }

  return results;
}
