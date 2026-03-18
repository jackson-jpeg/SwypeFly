export interface BoardDeal {
  id: string;
  departureTime: string;
  destination: string;
  destinationFull: string;
  country: string;
  iataCode: string;
  flightCode: string;
  price: number;
  priceFormatted: string;
  status: 'DEAL' | 'HOT' | 'NEW';
  airline: string;
  departureDate: string;
  returnDate: string;
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
}
