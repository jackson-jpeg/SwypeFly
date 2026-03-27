// ─── Duffel API Service Layer ────────────────────────────────────────────────
// Live flight inventory, seat maps, and ticketing via Duffel.
// Used for transactional booking flow (not discovery pricing).

import { Duffel } from '@duffel/api';

const DUFFEL_API_KEY = (process.env.DUFFEL_API_KEY || '').trim();

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
      slices: slices as any,
      passengers: params.passengers as any,
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
      const base: any = {
        id: p.id,
        given_name: p.given_name,
        family_name: p.family_name,
        born_on: p.born_on,
        gender: p.gender,
        title: p.title,
        email: p.email,
        phone_number: p.phone_number,
      };

      // Attach passport / nationality when provided (required for international flights)
      if (p.passport_number && p.passport_expiry) {
        base.identity_documents = [
          {
            unique_identifier: p.passport_number,
            expires_on: p.passport_expiry,
            issuing_country_code: p.nationality || 'US',
            type: 'passport',
          },
        ];
      }

      return base;
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

  // Duffel Stays quotes endpoint
  const response = await (client.stays as any).quotes.create({
    accommodation_id: params.accommodationId,
    room_id: params.roomId,
    check_in_date: params.checkIn,
    check_out_date: params.checkOut,
    guests: [{ type: 'adult' as const }],
  });

  const data = response.data as any;

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

  const response = await (client.stays as any).bookings.create({
    quote_id: params.quoteId,
    guests: [{
      given_name: givenName,
      family_name: familyName,
      email: params.guestEmail,
    }],
    payments: [{
      type: 'balance' as const,
      amount: params.paymentAmount,
      currency: params.paymentCurrency,
    }],
  });

  const data = response.data as any;

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

  const response = await client.stays.search({
    rooms: params.rooms ?? 1,
    guests: params.guests ?? [{ type: 'adult' as const }],
    check_in_date: params.checkIn,
    check_out_date: params.checkOut,
    location: {
      radius: params.radius,
      geographic_coordinates: {
        latitude: params.latitude,
        longitude: params.longitude,
      },
    },
  } as any);

  const results: StaysHotelResult[] = [];
  const data = response.data as any;
  const searchResults = data?.results ?? [];

  for (const sr of searchResults) {
    const acc = sr.accommodation;
    if (!acc) continue;

    const photoUrl = acc.photos?.[0]?.url ?? null;

    // Find board_type from first room's cheapest rate
    let boardType: string | null = null;
    const rooms = acc.rooms ?? [];
    if (rooms.length > 0 && rooms[0].rates?.length > 0) {
      boardType = rooms[0].rates[0].board_type ?? null;
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
