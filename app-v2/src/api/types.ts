// ─── Vibe Tags ──────────────────────────────────────────────────────

export type VibeTag =
  | 'beach'
  | 'mountain'
  | 'city'
  | 'culture'
  | 'adventure'
  | 'romantic'
  | 'foodie'
  | 'nightlife'
  | 'nature'
  | 'historic'
  | 'tropical'
  | 'winter'
  | 'luxury'
  | 'budget';

// ─── Destination (matches existing types/destination.ts) ────────────

export interface Destination {
  id: string;
  iataCode: string;
  city: string;
  country: string;
  tagline: string;
  description: string;
  imageUrl: string;
  flightPrice: number;
  hotelPricePerNight: number;
  currency: string;
  vibeTags: VibeTag[];
  bestMonths: string[];
  averageTemp: number;
  flightDuration: string;
  livePrice?: number | null;
  imageUrls?: string[];
  priceSource?: 'travelpayouts' | 'amadeus' | 'duffel' | 'estimate';
  priceAtSave?: number;
  priceFetchedAt?: string;
  liveHotelPrice?: number | null;
  hotelPriceSource?: 'liteapi' | 'estimate';
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number; mapsUrl?: string }[];
  departureDate?: string;
  returnDate?: string;
  tripDurationDays?: number;
  airline?: string;
  blurHash?: string;
  priceDirection?: 'up' | 'down' | 'stable';
  previousPrice?: number;
  photographerAttribution?: { name: string; url: string };
  travelTips?: {
    visa: string;
    currency: string;
    language: string;
    safety: string;
    bestFor: string[];
    costLevel: 1 | 2 | 3 | 4;
  };
  similarDestinations?: { id: string; city: string; flightPrice: number; imageUrl: string }[];
}

export interface DestinationFeedPage {
  destinations: Destination[];
  nextCursor: string | null;
}

// ─── Booking Flow Types (matches Duffel-style API) ──────────────────

export interface BookingSearchRequest {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: { type: 'adult' | 'child' | 'infant_without_seat' }[];
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  priceHint?: number;
}

export interface FlightSlice {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  airline: string;
  flightNumber: string;
  aircraft: string;
}

export interface BookingOffer {
  id: string;
  totalAmount: number;
  totalCurrency: string;
  baseAmount: number;
  taxAmount: number;
  slices: FlightSlice[];
  cabinClass: string;
  passengers: { id: string; type: string }[];
  expiresAt: string;
  availableServices: AvailableService[];
}

export interface AvailableService {
  id: string;
  type: 'baggage' | 'check_bag' | 'seat' | 'meal';
  name: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

export interface SeatMapRow {
  rowNumber: number;
  seats: SeatMapSeat[];
}

export interface SeatMapSeat {
  column: string;
  available: boolean;
  extraLegroom: boolean;
  price: number;
  currency: string;
  designator: string;
}

export interface SeatMap {
  rows: SeatMapRow[];
  columns: string[];
  exitRows: number[];
  aisleAfterColumns: string[];
}

export interface Passenger {
  id: string;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: 'f' | 'm';
  title: 'mr' | 'mrs' | 'ms' | 'miss' | 'dr';
  email: string;
  phone_number: string;
  passport_number?: string;
  frequent_flyer_number?: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface CreateOrderResponse {
  orderId: string;
  bookingReference: string;
  status: 'confirmed' | 'pending';
  passengers: { id: string; name: string; seatDesignator?: string }[];
  slices: FlightSlice[];
  totalPaid: number;
  currency: string;
}

// ─── AI Types ───────────────────────────────────────────────────────

export interface TripPlan {
  days: {
    day: number;
    title: string;
    activities: { time: string; activity: string; tip?: string }[];
  }[];
  estimatedBudget: { min: number; max: number; currency: string };
}

export interface DestinationGuide {
  itinerary: { day: number; activities: string[] }[];
  restaurants: { name: string; type: string; rating: number }[];
  tips: string[];
}
