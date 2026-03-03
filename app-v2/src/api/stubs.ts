import type {
  Destination,
  DestinationFeedPage,
  BookingOffer,
  SeatMap,
  PaymentIntentResponse,
  CreateOrderResponse,
} from './types';

// ─── Feed Destinations ──────────────────────────────────────────────

export const STUB_DESTINATIONS: Destination[] = [
  {
    id: 'dest-santorini',
    iataCode: 'JTR',
    city: 'Santorini',
    country: 'Greece',
    tagline: 'Whitewashed cliffs above endless blue',
    description: 'Sun-bleached walls tumble toward the caldera, each sunset more impossible than the last.',
    imageUrl: '/images/santorini.jpg',
    flightPrice: 387,
    hotelPricePerNight: 289,
    currency: 'USD',
    vibeTags: ['romantic', 'beach', 'culture'],
    bestMonths: ['May', 'Jun', 'Sep', 'Oct'],
    averageTemp: 26,
    flightDuration: '10h 30m',
    livePrice: 387,
    priceSource: 'travelpayouts',
    previousPrice: 542,
    priceDirection: 'down',
    airline: 'Delta',
    departureDate: '2026-06-15',
    returnDate: '2026-06-22',
    tripDurationDays: 7,
    itinerary: [
      { day: 1, activities: ['Arrive in Santorini', 'Check into Oia hotel', 'Sunset at Oia Castle'] },
      { day: 2, activities: ['Red Beach morning', 'Akrotiri archaeological site', 'Wine tasting in Megalochori'] },
      { day: 3, activities: ['Catamaran cruise to hot springs', 'Snorkeling at volcanic crater', 'Dinner in Ammoudi Bay'] },
    ],
    restaurants: [
      { name: 'Selene', type: 'Fine Dining', rating: 4.8 },
      { name: 'Metaxy Mas', type: 'Traditional Greek', rating: 4.7 },
      { name: 'Ammoudi Fish Tavern', type: 'Seafood', rating: 4.6 },
    ],
    travelTips: {
      visa: 'EU Schengen visa or visa-free for US/UK/AU citizens',
      currency: 'EUR (Euro)',
      language: 'Greek (English widely spoken)',
      safety: 'Very safe, watch for steep cliffs',
      bestFor: ['couples', 'photography', 'foodies'],
      costLevel: 3,
    },
  },
  {
    id: 'dest-bali',
    iataCode: 'DPS',
    city: 'Bali',
    country: 'Indonesia',
    tagline: 'Emerald rice terraces meet sacred temples',
    description: 'A spiritual island where ancient Hindu temples rise above emerald rice terraces and surf crashes on volcanic black sand.',
    imageUrl: '/images/bali.jpg',
    flightPrice: 479,
    hotelPricePerNight: 89,
    currency: 'USD',
    vibeTags: ['tropical', 'culture', 'adventure', 'budget'],
    bestMonths: ['Apr', 'May', 'Jun', 'Sep'],
    averageTemp: 28,
    flightDuration: '20h 15m',
    livePrice: 479,
    priceSource: 'travelpayouts',
    airline: 'Singapore Airlines',
  },
  {
    id: 'dest-kyoto',
    iataCode: 'KIX',
    city: 'Kyoto',
    country: 'Japan',
    tagline: 'Ancient temples in a sea of cherry blossoms',
    description: 'Geishas glide through bamboo groves as 2,000 temples and shrines anchor a city suspended between past and future.',
    imageUrl: '/images/kyoto.jpg',
    flightPrice: 612,
    hotelPricePerNight: 175,
    currency: 'USD',
    vibeTags: ['culture', 'historic', 'foodie', 'nature'],
    bestMonths: ['Mar', 'Apr', 'Oct', 'Nov'],
    averageTemp: 16,
    flightDuration: '14h 20m',
    livePrice: 612,
    priceSource: 'amadeus',
    airline: 'ANA',
  },
  {
    id: 'dest-maldives',
    iataCode: 'MLE',
    city: 'Maldives',
    country: 'Maldives',
    tagline: 'Overwater villas on crystal-clear lagoons',
    description: 'Private overwater bungalows hover above lagoons so clear you can see manta rays from your infinity pool.',
    imageUrl: '/images/maldives.jpg',
    flightPrice: 892,
    hotelPricePerNight: 450,
    currency: 'USD',
    vibeTags: ['luxury', 'beach', 'romantic'],
    bestMonths: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
    averageTemp: 30,
    flightDuration: '17h 45m',
    livePrice: 892,
    priceSource: 'travelpayouts',
    airline: 'Emirates',
  },
  {
    id: 'dest-iceland',
    iataCode: 'KEF',
    city: 'Reykjavik',
    country: 'Iceland',
    tagline: 'Fire and ice at the edge of the world',
    description: 'Geysers erupt beside glaciers, northern lights dance over black sand beaches, and every road leads to something impossible.',
    imageUrl: '/images/iceland.jpg',
    flightPrice: 342,
    hotelPricePerNight: 195,
    currency: 'USD',
    vibeTags: ['adventure', 'nature', 'winter'],
    bestMonths: ['Jun', 'Jul', 'Aug', 'Sep'],
    averageTemp: 10,
    flightDuration: '5h 30m',
    livePrice: 342,
    priceSource: 'travelpayouts',
    priceDirection: 'down',
    previousPrice: 489,
    airline: 'Icelandair',
  },
  {
    id: 'dest-morocco',
    iataCode: 'RAK',
    city: 'Marrakech',
    country: 'Morocco',
    tagline: 'Spice markets and desert starlight',
    description: 'Wander through ochre-walled medinas where the scent of tagine mingles with fresh mint tea.',
    imageUrl: '/images/marrakech.jpg',
    flightPrice: 498,
    hotelPricePerNight: 120,
    currency: 'USD',
    vibeTags: ['culture', 'foodie', 'adventure', 'budget'],
    bestMonths: ['Mar', 'Apr', 'Oct', 'Nov'],
    averageTemp: 22,
    flightDuration: '8h 10m',
    livePrice: 498,
    priceSource: 'travelpayouts',
    airline: 'Royal Air Maroc',
  },
  {
    id: 'dest-patagonia',
    iataCode: 'PUQ',
    city: 'Patagonia',
    country: 'Chile',
    tagline: 'Glaciers and granite at the end of the earth',
    description: 'Torres del Paine\'s granite spires pierce Patagonian clouds above turquoise glacial lakes.',
    imageUrl: '/images/patagonia.jpg',
    flightPrice: 756,
    hotelPricePerNight: 165,
    currency: 'USD',
    vibeTags: ['adventure', 'nature', 'mountain'],
    bestMonths: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    averageTemp: 12,
    flightDuration: '15h 40m',
    livePrice: 756,
    priceSource: 'amadeus',
    airline: 'LATAM',
  },
  {
    id: 'dest-tokyo',
    iataCode: 'NRT',
    city: 'Tokyo',
    country: 'Japan',
    tagline: 'Neon-lit streets and ancient shrines',
    description: 'A city where robot restaurants neighbor 400-year-old gardens and every meal is a revelation.',
    imageUrl: '/images/tokyo.jpg',
    flightPrice: 624,
    hotelPricePerNight: 195,
    currency: 'USD',
    vibeTags: ['city', 'foodie', 'culture', 'nightlife'],
    bestMonths: ['Mar', 'Apr', 'Oct', 'Nov'],
    averageTemp: 16,
    flightDuration: '14h 00m',
    livePrice: 624,
    priceSource: 'travelpayouts',
    airline: 'JAL',
  },
  {
    id: 'dest-paris',
    iataCode: 'CDG',
    city: 'Paris',
    country: 'France',
    tagline: 'The city of light never dims',
    description: 'From croissants at dawn to the Eiffel Tower at midnight, Paris rewards every stolen moment.',
    imageUrl: '/images/paris.jpg',
    flightPrice: 542,
    hotelPricePerNight: 220,
    currency: 'USD',
    vibeTags: ['romantic', 'city', 'foodie', 'culture'],
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct'],
    averageTemp: 15,
    flightDuration: '7h 30m',
    livePrice: 542,
    priceSource: 'travelpayouts',
    airline: 'Air France',
  },
  {
    id: 'dest-amalfi',
    iataCode: 'NAP',
    city: 'Amalfi Coast',
    country: 'Italy',
    tagline: 'Pastel villages clinging to cliffs above the Med',
    description: 'Candy-colored houses cascade down seaside cliffs while lemon groves perfume the coastal breezes.',
    imageUrl: '/images/amalfi.jpg',
    flightPrice: 465,
    hotelPricePerNight: 310,
    currency: 'USD',
    vibeTags: ['romantic', 'beach', 'foodie', 'luxury'],
    bestMonths: ['May', 'Jun', 'Sep', 'Oct'],
    averageTemp: 24,
    flightDuration: '9h 15m',
    livePrice: 465,
    priceSource: 'travelpayouts',
    airline: 'ITA Airways',
  },
];

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
