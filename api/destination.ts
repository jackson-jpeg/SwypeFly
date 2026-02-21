import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { destinationQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const v = validateRequest(destinationQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { id, origin } = v.data;

  try {
    // Fetch destination from Appwrite
    const dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, id);

    if (!dest) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Fetch cached prices for this origin + destination
    let price: Record<string, unknown> | null = null;
    try {
      const priceResult = await serverDatabases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.cachedPrices,
        [
          Query.equal('origin', origin),
          Query.equal('destination_iata', dest.iata_code as string),
          Query.limit(1),
        ],
      );
      if (priceResult.documents.length > 0) {
        price = priceResult.documents[0];
      }
    } catch {
      // No cached prices
    }

    // Parse JSON fields
    let itinerary;
    let restaurants;
    try {
      itinerary = dest.itinerary_json ? JSON.parse(dest.itinerary_json as string) : undefined;
    } catch {
      itinerary = undefined;
    }
    try {
      restaurants = dest.restaurants_json ? JSON.parse(dest.restaurants_json as string) : undefined;
    } catch {
      restaurants = undefined;
    }

    const result = {
      id: dest.$id,
      iataCode: dest.iata_code,
      city: dest.city,
      country: dest.country,
      tagline: dest.tagline,
      description: dest.description,
      imageUrl: dest.image_url,
      imageUrls: dest.image_urls,
      flightPrice: (price?.price as number) ?? dest.flight_price,
      hotelPricePerNight: dest.hotel_price_per_night,
      currency: dest.currency,
      vibeTags: dest.vibe_tags,
      rating: dest.rating,
      reviewCount: dest.review_count,
      bestMonths: dest.best_months,
      averageTemp: dest.average_temp,
      flightDuration: (price?.duration as string) || dest.flight_duration,
      livePrice: (price?.price as number) ?? null,
      priceSource: price ? ((price.source as string) || 'estimate') : 'estimate',
      priceFetchedAt: (price?.fetched_at as string) || undefined,
      liveHotelPrice: null,
      hotelPriceSource: 'estimate',
      available_flight_days: dest.available_flight_days,
      itinerary,
      restaurants,
      departureDate: (price?.departure_date as string) || undefined,
      returnDate: (price?.return_date as string) || undefined,
      tripDurationDays: (price?.trip_duration_days as number) ?? undefined,
      airline: (price?.airline as string) || undefined,
      priceDirection: (price?.price_direction as string) || undefined,
      previousPrice: (price?.previous_price as number) ?? undefined,
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/destination', err);
    return res.status(500).json({ error: 'Failed to load destination' });
  }
}
