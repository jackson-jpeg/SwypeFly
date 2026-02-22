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
  rating: number;
  reviewCount: number;
  bestMonths: string[];
  averageTemp: number;
  flightDuration: string;
  livePrice?: number | null;
  imageUrls?: string[];
  priceSource?: 'travelpayouts' | 'amadeus' | 'estimate';
  priceFetchedAt?: string;
  liveHotelPrice?: number | null;
  hotelPriceSource?: 'liteapi' | 'estimate';
  available_flight_days?: string[];
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number; mapsUrl?: string }[];
  departureDate?: string;
  returnDate?: string;
  tripDurationDays?: number;
  airline?: string;
  blurHash?: string;
  priceDirection?: 'up' | 'down' | 'stable';
  previousPrice?: number;
  otherPrices?: { origin: string; price: number; source: string }[];
  photographerAttribution?: { name: string; url: string };
  travelTips?: {
    visa: string;
    currency: string;
    language: string;
    safety: string;
    bestFor: string[];
    costLevel: 1 | 2 | 3 | 4;
  };
}

export interface DestinationFeedPage {
  destinations: Destination[];
  nextCursor: string | null;
}
