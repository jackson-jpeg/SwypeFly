import type {
  Destination,
  DestinationFeedPage,
  BookingOffer,
  SeatMap,
  PaymentIntentResponse,
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

// ─── Booking Search (dynamic per destination) ───────────────────────

const AIRLINES = [
  { name: 'Delta Air Lines', code: 'DL', aircraft: 'Airbus A330-300' },
  { name: 'United Airlines', code: 'UA', aircraft: 'Boeing 787-9' },
  { name: 'American Airlines', code: 'AA', aircraft: 'Boeing 777-300ER' },
];

const DEP_TIMES = ['18:30', '21:15', '08:00'];
const ARR_TIMES = ['10:45', '13:30', '22:45'];
const RET_DEP_TIMES = ['14:20', '15:00', '16:00'];
const RET_ARR_TIMES = ['20:05', '21:30', '22:15'];

/** Generate realistic booking offers for any destination + origin pair */
export function getStubBookingOffers(
  dest: Destination | undefined,
  origin = 'JFK',
): BookingOffer[] {
  if (!dest) return [];
  const basePrice = dest.flightPrice;
  const iata = dest.iataCode || dest.city.slice(0, 3).toUpperCase();
  const duration = dest.flightDuration || '9h 30m';

  return AIRLINES.map((airline, i) => {
    // Stagger prices: cheapest, +7%, +32%
    const multiplier = i === 0 ? 1 : i === 1 ? 1.07 : 1.32;
    const total = Math.round(basePrice * multiplier);
    const tax = Math.round(total * 0.19);
    const base = total - tax;
    // Stagger departure dates: 1 week apart
    const depDate = new Date(2026, 5, 15 + i * 7);
    const retDate = new Date(depDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const flightNum = `${airline.code} ${400 + i * 200 + Math.floor(basePrice % 100)}`;

    return {
      id: `offer-${airline.code.toLowerCase()}-${total}`,
      totalAmount: total,
      totalCurrency: 'USD',
      baseAmount: base,
      taxAmount: tax,
      slices: [
        {
          origin,
          destination: iata,
          departureTime: `${depDate.toISOString().slice(0, 10)}T${DEP_TIMES[i]}:00`,
          arrivalTime: `${new Date(depDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}T${ARR_TIMES[i]}:00`,
          duration,
          stops: 1,
          airline: airline.name,
          flightNumber: flightNum,
          aircraft: airline.aircraft,
        },
        {
          origin: iata,
          destination: origin,
          departureTime: `${retDate.toISOString().slice(0, 10)}T${RET_DEP_TIMES[i]}:00`,
          arrivalTime: `${retDate.toISOString().slice(0, 10)}T${RET_ARR_TIMES[i]}:00`,
          duration,
          stops: 1,
          airline: airline.name,
          flightNumber: `${airline.code} ${401 + i * 200 + Math.floor(basePrice % 100)}`,
          aircraft: airline.aircraft,
        },
      ],
      cabinClass: 'economy',
      passengers: [{ id: 'pax-1', type: 'adult' }],
      expiresAt: new Date(depDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      availableServices: [
        { id: 'bag-23kg', type: 'baggage', name: '1 Checked Bag (23kg)', amount: 35, currency: 'USD' },
        { id: 'bag-2x23kg', type: 'baggage', name: '2 Checked Bags (23kg each)', amount: 60, currency: 'USD' },
        { id: 'meal-pasta', type: 'meal', name: 'Pasta Primavera', amount: 12, currency: 'USD' },
        { id: 'meal-salad', type: 'meal', name: 'Garden Salad', amount: 10, currency: 'USD' },
        { id: 'meal-asian', type: 'meal', name: 'Asian Noodles', amount: 14, currency: 'USD' },
      ],
    };
  });
}

// ─── Seat Map (dynamic per flight) ──────────────────────────────────

/** Simple seeded PRNG so each flight gets a consistent but unique seat map */
function seatRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
}

// Aircraft configs: narrowbody (3+3), widebody (3+3+3 or 2+4+2)
const AIRCRAFT_LAYOUTS = [
  { columns: ['A', 'B', 'C', 'D', 'E', 'F'], aisles: ['C'], rowCount: [20, 26, 30], name: 'narrowbody' },
  { columns: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'], aisles: ['C', 'F'], rowCount: [30, 38, 42], name: 'widebody' },
  { columns: ['A', 'C', 'D', 'E', 'F', 'H'], aisles: ['C', 'D'], rowCount: [28, 34, 40], name: '2-4-2' }, // skip B and G for 2-seat sides
];

export function generateSeatMap(flightSeed: string): SeatMap {
  const rand = seatRng(flightSeed);
  const layout = AIRCRAFT_LAYOUTS[Math.floor(rand() * AIRCRAFT_LAYOUTS.length)]!;
  const rowCount = layout.rowCount[Math.floor(rand() * layout.rowCount.length)]!;
  const startRow = Math.floor(rand() * 4) + 1; // rows start at 1-4
  const occupancyRate = 0.35 + rand() * 0.45; // 35-80% full

  // Pick 1-3 exit rows spread through the plane
  const exitRowCount = rowCount > 25 ? 2 : 1;
  const exitRows: number[] = [];
  for (let e = 0; e < exitRowCount; e++) {
    const zone = Math.floor((rowCount / (exitRowCount + 1)) * (e + 1));
    exitRows.push(startRow + zone + Math.floor(rand() * 3) - 1);
  }

  // Seat upgrade prices vary
  const exitPrice = [20, 25, 30, 35][Math.floor(rand() * 4)]!;
  const preferredPrice = [8, 10, 12, 15][Math.floor(rand() * 4)]!;

  const rows = Array.from({ length: rowCount }, (_, i) => {
    const rowNum = startRow + i;
    const isExit = exitRows.includes(rowNum);
    const isPreferred = rowNum < startRow + 5; // first 5 rows are "preferred"
    return {
      rowNumber: rowNum,
      seats: layout.columns.map((col) => {
        const occupied = rand() < occupancyRate;
        return {
          column: col,
          available: !occupied,
          extraLegroom: isExit,
          price: isExit ? exitPrice : isPreferred ? preferredPrice : 0,
          currency: 'USD',
          designator: `${rowNum}${col}`,
          serviceId: !occupied ? `stub_seat_${rowNum}${col}` : null,
        };
      }),
    };
  });

  return {
    columns: layout.columns,
    exitRows,
    aisleAfterColumns: layout.aisles,
    rows,
  };
}

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
