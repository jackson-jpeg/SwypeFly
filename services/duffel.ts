// ─── Duffel API Service Layer ────────────────────────────────────────────────
// Live flight inventory, seat maps, and ticketing via Duffel.
// Used for transactional booking flow (not discovery pricing).

import { Duffel } from '@duffel/api';

const DUFFEL_API_KEY = process.env.DUFFEL_API_KEY || '';

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

  const response = await client.offerRequests.create({
    slices,
    passengers: params.passengers,
    cabin_class: params.cabinClass || 'economy',
    return_offers: true,
  });

  return response.data;
}

// ─── Get Single Offer ───────────────────────────────────────────────────────

export async function getOffer(offerId: string) {
  const client = getClient();
  const response = await client.offers.get(offerId, {
    return_available_services: true,
  });
  return response.data;
}

// ─── Get Seat Map ───────────────────────────────────────────────────────────

export async function getSeatMap(offerId: string) {
  const client = getClient();
  const response = await client.seatMaps.get({ offer_id: offerId });
  return response.data;
}

// ─── Create Order (Book + Issue Ticket) ─────────────────────────────────────

export async function createOrder(params: CreateOrderParams) {
  const client = getClient();

  const response = await client.orders.create({
    type: 'instant',
    selected_offers: [params.offerId],
    passengers: params.passengers.map((p) => ({
      id: p.id,
      given_name: p.given_name,
      family_name: p.family_name,
      born_on: p.born_on,
      gender: p.gender,
      title: p.title,
      email: p.email,
      phone_number: p.phone_number,
    })),
    services: params.selectedServices || [],
    payments: [
      {
        type: 'balance' as const,
        amount: params.paymentAmount,
        currency: params.paymentCurrency,
      },
    ],
  });

  return response.data;
}

// ─── Get Order Details ──────────────────────────────────────────────────────

export async function getOrder(orderId: string) {
  const client = getClient();
  const response = await client.orders.get(orderId);
  return response.data;
}
