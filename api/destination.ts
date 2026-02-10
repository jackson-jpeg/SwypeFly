import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { destinationQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { fetchCheapPrices } from '../services/travelpayouts';
import { fetchHotelRates } from '../services/liteapi';

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
    let [{ data: price }, { data: hotelPrice }] = await Promise.all([
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

    // On-demand refresh: if cached prices are stale (>24h) or missing, fetch fresh inline
    const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
    const flightStale = !price || !price.fetched_at || (Date.now() - new Date(price.fetched_at).getTime() > STALE_MS);
    const hotelStale = !hotelPrice || !hotelPrice.fetched_at || (Date.now() - new Date(hotelPrice.fetched_at).getTime() > STALE_MS);

    if (flightStale || hotelStale) {
      try {
        const now = new Date();
        const checkin = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];
        const checkout = new Date(now.getTime() + 33 * 86400000).toISOString().split('T')[0];

        const [freshFlight, freshHotel] = await Promise.allSettled([
          flightStale ? fetchCheapPrices(origin, dest.iata_code) : Promise.resolve(null),
          hotelStale ? fetchHotelRates(dest.iata_code, checkin, checkout) : Promise.resolve(null),
        ]);

        // Upsert fresh flight price
        if (freshFlight.status === 'fulfilled' && freshFlight.value) {
          const fp = freshFlight.value;
          const row = {
            origin,
            destination_iata: fp.destination,
            price: fp.price,
            currency: 'USD',
            airline: fp.airline,
            source: 'travelpayouts' as const,
            fetched_at: new Date().toISOString(),
          };
          await supabase.from('cached_prices').upsert(row, { onConflict: 'origin,destination_iata' });
          price = { ...price, ...row };
        }

        // Upsert fresh hotel price
        if (freshHotel.status === 'fulfilled' && freshHotel.value) {
          const hp = freshHotel.value;
          const row = {
            destination_iata: dest.iata_code,
            price_per_night: hp.minPrice,
            currency: hp.currency,
            source: 'liteapi' as const,
            hotel_count: hp.hotelCount,
            fetched_at: new Date().toISOString(),
          };
          await supabase.from('cached_hotel_prices').upsert(row, { onConflict: 'destination_iata' });
          hotelPrice = { ...hotelPrice, ...row };
        }
      } catch {
        // Failures silently fall back to cached/hardcoded data
      }
    }

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
