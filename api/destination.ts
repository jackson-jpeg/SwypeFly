import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { destinationQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const v = validateRequest(destinationQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { id, origin } = v.data;

  try {
    // Fetch destination
    const { data: dest, error } = await supabase
      .from('destinations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !dest) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Fetch cached prices for this origin + hotel prices
    const [{ data: price }, { data: hotelPrice }] = await Promise.all([
      supabase
        .from('cached_prices')
        .select('*')
        .eq('origin', origin)
        .eq('destination_iata', dest.iata_code)
        .single(),
      supabase
        .from('cached_hotel_prices')
        .select('*')
        .eq('destination_iata', dest.iata_code)
        .single(),
    ]);

    // Transform to frontend shape
    const result = {
      id: dest.id,
      iataCode: dest.iata_code,
      city: dest.city,
      country: dest.country,
      tagline: dest.tagline,
      description: dest.description,
      imageUrl: dest.image_url,
      imageUrls: dest.image_urls,
      flightPrice: price?.price ?? dest.flight_price,
      hotelPricePerNight: hotelPrice?.price_per_night ?? dest.hotel_price_per_night,
      currency: dest.currency,
      vibeTags: dest.vibe_tags,
      rating: dest.rating,
      reviewCount: dest.review_count,
      bestMonths: dest.best_months,
      averageTemp: dest.average_temp,
      flightDuration: price?.duration || dest.flight_duration,
      livePrice: price?.price ?? null,
      priceSource: price ? (price.source || 'estimate') : 'estimate',
      priceFetchedAt: price?.fetched_at || undefined,
      liveHotelPrice: hotelPrice?.price_per_night ?? null,
      hotelPriceSource: hotelPrice ? (hotelPrice.source || 'estimate') : 'estimate',
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/destination', err);
    return res.status(500).json({ error: 'Failed to load destination' });
  }
}
