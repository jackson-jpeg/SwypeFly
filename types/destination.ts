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
  blurhash?: string;
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
}

export interface DestinationFeedPage {
  destinations: Destination[];
  nextCursor: string | null;
}
