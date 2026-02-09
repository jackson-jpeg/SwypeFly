import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = req.query.id as string;
  const origin = (req.query.origin as string) || 'TPA';

  if (!id) {
    return res.status(400).json({ error: 'Missing destination id' });
  }

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

    // Fetch cached price for this origin
    const { data: price } = await supabase
      .from('cached_prices')
      .select('*')
      .eq('origin', origin)
      .eq('destination_iata', dest.iata_code)
      .single();

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
      hotelPricePerNight: dest.hotel_price_per_night,
      currency: dest.currency,
      vibeTags: dest.vibe_tags,
      rating: dest.rating,
      reviewCount: dest.review_count,
      bestMonths: dest.best_months,
      averageTemp: dest.average_temp,
      flightDuration: price?.duration || dest.flight_duration,
      livePrice: price?.price ?? null,
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[api/destination]', err);
    return res.status(500).json({ error: 'Failed to load destination' });
  }
}
