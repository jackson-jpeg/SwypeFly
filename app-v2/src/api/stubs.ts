import type {
  Destination,
  DestinationFeedPage,
  BookingOffer,
  SeatMap,
  PaymentIntentResponse,
  CreateOrderResponse,
  TripPlan,
} from './types';

// ─── Feed Destinations (206 real destinations with Pexels photos) ───

import rawDestinations from './destinations-data.json';

export const STUB_DESTINATIONS: Destination[] = (rawDestinations as Destination[]).map((d) => ({
  ...d,
  livePrice: d.livePrice ?? d.flightPrice,
  priceSource: d.priceSource ?? 'estimate',
}));

// ─── Feed Response ──────────────────────────────────────────────────

export function getStubFeed(cursor = 0, pageSize = 5): DestinationFeedPage {
  const start = cursor;
  const end = Math.min(start + pageSize, STUB_DESTINATIONS.length);
  return {
    destinations: STUB_DESTINATIONS.slice(start, end),
    nextCursor: end < STUB_DESTINATIONS.length ? String(end) : null,
  };
}

// ─── Destination Detail ─────────────────────────────────────────────

export function getStubDestination(id: string): Destination | undefined {
  return STUB_DESTINATIONS.find((d) => d.id === id);
}

// ─── Booking Search ─────────────────────────────────────────────────

export const STUB_BOOKING_OFFERS: BookingOffer[] = [
  {
    id: 'offer-delta-387',
    totalAmount: 387,
    totalCurrency: 'USD',
    baseAmount: 312,
    taxAmount: 75,
    slices: [
      {
        origin: 'JFK',
        destination: 'JTR',
        departureTime: '2026-06-15T18:30:00',
        arrivalTime: '2026-06-16T10:45:00',
        duration: '10h 15m',
        stops: 1,
        airline: 'Delta Air Lines',
        flightNumber: 'DL 478',
        aircraft: 'Airbus A330-300',
      },
      {
        origin: 'JTR',
        destination: 'JFK',
        departureTime: '2026-06-22T14:20:00',
        arrivalTime: '2026-06-22T20:05:00',
        duration: '11h 45m',
        stops: 1,
        airline: 'Delta Air Lines',
        flightNumber: 'DL 479',
        aircraft: 'Airbus A330-300',
      },
    ],
    cabinClass: 'economy',
    passengers: [{ id: 'pax-1', type: 'adult' }],
    expiresAt: '2026-06-10T23:59:59Z',
    availableServices: [
      { id: 'bag-23kg', type: 'baggage', name: '1 Checked Bag (23kg)', amount: 35, currency: 'USD' },
      { id: 'bag-2x23kg', type: 'baggage', name: '2 Checked Bags (23kg each)', amount: 60, currency: 'USD' },
      { id: 'meal-pasta', type: 'meal', name: 'Pasta Primavera', amount: 12, currency: 'USD' },
      { id: 'meal-salad', type: 'meal', name: 'Garden Salad', amount: 10, currency: 'USD' },
      { id: 'meal-asian', type: 'meal', name: 'Asian Noodles', amount: 14, currency: 'USD' },
    ],
  },
  {
    id: 'offer-united-412',
    totalAmount: 412,
    totalCurrency: 'USD',
    baseAmount: 334,
    taxAmount: 78,
    slices: [
      {
        origin: 'JFK',
        destination: 'JTR',
        departureTime: '2026-06-22T21:15:00',
        arrivalTime: '2026-06-23T13:30:00',
        duration: '10h 15m',
        stops: 1,
        airline: 'United Airlines',
        flightNumber: 'UA 834',
        aircraft: 'Boeing 787-9',
      },
      {
        origin: 'JTR',
        destination: 'JFK',
        departureTime: '2026-06-29T15:00:00',
        arrivalTime: '2026-06-29T21:30:00',
        duration: '11h 30m',
        stops: 1,
        airline: 'United Airlines',
        flightNumber: 'UA 835',
        aircraft: 'Boeing 787-9',
      },
    ],
    cabinClass: 'economy',
    passengers: [{ id: 'pax-1', type: 'adult' }],
    expiresAt: '2026-06-17T23:59:59Z',
    availableServices: [
      { id: 'bag-23kg', type: 'baggage', name: '1 Checked Bag (23kg)', amount: 35, currency: 'USD' },
      { id: 'meal-pasta', type: 'meal', name: 'Pasta Primavera', amount: 12, currency: 'USD' },
    ],
  },
  {
    id: 'offer-american-509',
    totalAmount: 509,
    totalCurrency: 'USD',
    baseAmount: 421,
    taxAmount: 88,
    slices: [
      {
        origin: 'JFK',
        destination: 'JTR',
        departureTime: '2026-07-01T08:00:00',
        arrivalTime: '2026-07-01T22:45:00',
        duration: '10h 45m',
        stops: 1,
        airline: 'American Airlines',
        flightNumber: 'AA 612',
        aircraft: 'Boeing 777-300ER',
      },
      {
        origin: 'JTR',
        destination: 'JFK',
        departureTime: '2026-07-08T16:00:00',
        arrivalTime: '2026-07-08T22:15:00',
        duration: '11h 15m',
        stops: 1,
        airline: 'American Airlines',
        flightNumber: 'AA 613',
        aircraft: 'Boeing 777-300ER',
      },
    ],
    cabinClass: 'economy',
    passengers: [{ id: 'pax-1', type: 'adult' }],
    expiresAt: '2026-06-25T23:59:59Z',
    availableServices: [
      { id: 'bag-23kg', type: 'baggage', name: '1 Checked Bag (23kg)', amount: 40, currency: 'USD' },
    ],
  },
];

// ─── Seat Map ───────────────────────────────────────────────────────

export const STUB_SEAT_MAP: SeatMap = {
  columns: ['A', 'B', 'C', 'D', 'E', 'F'],
  exitRows: [14],
  rows: Array.from({ length: 6 }, (_, i) => {
    const rowNum = 12 + i;
    const isExitRow = rowNum === 14;
    return {
      rowNumber: rowNum,
      seats: ['A', 'B', 'C', 'D', 'E', 'F'].map((col) => {
        // Deterministic occupied pattern
        const occupied =
          (rowNum === 12 && (col === 'A' || col === 'C' || col === 'F')) ||
          (rowNum === 13 && (col === 'B' || col === 'D')) ||
          (rowNum === 15 && (col === 'A' || col === 'E' || col === 'F')) ||
          (rowNum === 16 && (col === 'C' || col === 'D')) ||
          (rowNum === 17 && (col === 'B'));
        return {
          column: col,
          available: !occupied,
          extraLegroom: isExitRow,
          price: isExitRow ? 25 : 0,
          currency: 'USD',
          designator: `${rowNum}${col}`,
        };
      }),
    };
  }),
};

// ─── Extras ─────────────────────────────────────────────────────────

export const STUB_BAGGAGE_OPTIONS = [
  { id: 'bag-none', name: 'No Checked Bag', price: 0 },
  { id: 'bag-23kg', name: '1 Bag (23kg)', price: 35 },
  { id: 'bag-2x23kg', name: '2 Bags (23kg each)', price: 60 },
];

export const STUB_INSURANCE = {
  id: 'insurance-basic',
  name: 'Travel Insurance',
  pricePerPerson: 29,
};

export const STUB_MEAL_OPTIONS = [
  { id: 'meal-pasta', name: 'Pasta Primavera', price: 12 },
  { id: 'meal-salad', name: 'Garden Salad', price: 10 },
  { id: 'meal-asian', name: 'Asian Noodles', price: 14 },
];

// ─── Payment Intent ─────────────────────────────────────────────────

export const STUB_PAYMENT_INTENT: PaymentIntentResponse = {
  clientSecret: 'pi_stub_secret_santorini_387',
  paymentIntentId: 'pi_stub_santorini_387',
  amount: 46300,
  currency: 'usd',
};

// ─── Order Confirmation ─────────────────────────────────────────────

// ─── Trip Plan ──────────────────────────────────────────────────────

export const STUB_TRIP_PLAN: TripPlan = {
  days: [
    {
      day: 1,
      title: 'Arrival & Oia Sunset',
      activities: [
        { time: 'Morning', activity: 'Arrive at JTR, transfer to Oia hotel' },
        { time: 'Afternoon', activity: "Wander Oia's marble lanes, browse boutiques" },
        { time: 'Evening', activity: 'Legendary sunset from the Castle of Oia, dinner at Ammoudi Bay' },
      ],
    },
    {
      day: 2,
      title: 'Beaches & Wine',
      activities: [
        { time: 'Morning', activity: 'Red Beach and Akrotiri archaeological site' },
        { time: 'Afternoon', activity: 'Wine tasting in Megalochori — try the local Assyrtiko' },
        { time: 'Evening', activity: 'Seafood dinner at Selene restaurant in Fira' },
      ],
    },
    {
      day: 3,
      title: 'Caldera Cruise & Departure',
      activities: [
        { time: 'Morning', activity: 'Catamaran cruise around the caldera, swim at hot springs' },
        { time: 'Afternoon', activity: 'Snorkeling near volcanic crater, lunch on board' },
        { time: 'Evening', activity: 'Transfer to airport, depart JTR' },
      ],
    },
  ],
  estimatedBudget: { min: 1200, max: 2400, currency: 'USD' },
};

export const STUB_ORDER: CreateOrderResponse = {
  orderId: 'ord_SGJT_2026_001',
  bookingReference: 'SGJT7X',
  status: 'confirmed',
  passengers: [
    { id: 'pax-1', name: 'John Doe', seatDesignator: '14C' },
  ],
  slices: STUB_BOOKING_OFFERS[0]!.slices,
  totalPaid: 463,
  currency: 'USD',
};
