export interface BoardDeal {
  id: string;
  departureTime: string;
  destination: string;
  destinationFull: string;
  country: string;
  iataCode: string;
  flightCode: string;
  price: number | null;
  priceFormatted: string;
  status: 'DEAL' | 'HOT' | 'NEW';
  priceSource: string;
  priceFetchedAt?: string;
  airline: string;
  departureDate: string;
  returnDate: string;
  cheapestDate: string;
  cheapestReturnDate: string;
  tripDays: number;
  flightDuration: string;
  vibeTags: string[];
  imageUrl: string;
  blurHash?: string;
  tagline: string;
  description: string;
  affiliateUrl: string;
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number }[];
  // Deal quality fields
  dealScore?: number;
  dealTier?: 'amazing' | 'great' | 'good' | 'fair';
  qualityScore?: number;
  pricePercentile?: number;
  isNonstop?: boolean;
  totalStops?: number;
  maxLayoverMinutes?: number;
  usualPrice?: number;
  savingsAmount?: number;
  savingsPercent?: number;
  // Google Flights-style typical price range for this route (p20–p80)
  typicalPriceLow?: number;
  typicalPriceHigh?: number;
  // Price trend (recent daily prices for sparkline)
  priceHistory?: number[];
  // Nearby airport fallback
  nearbyOrigin?: string;
  nearbyOriginLabel?: string;
  // Flash deal flag (>30% below usual price)
  flashDeal?: boolean;
  // Destination metadata (from server, may not always be present)
  averageTemp?: number;
  bestMonths?: string[];
  hotelPricePerNight?: number;
  currency?: string;
}
