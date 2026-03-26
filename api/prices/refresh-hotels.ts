import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../../services/supabaseServer';
import { searchStays } from '../../services/duffel';
import { hotelPricesQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';
import { cors } from '../_cors.js';

export const maxDuration = 60;

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 1500;
const SEARCH_RADIUS_KM = 10;
const STAY_NIGHTS = 3;
const TOP_HOTELS = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' });
  }
  const authHeader = req.headers.authorization;
  const provided = authHeader?.replace('Bearer ', '') || '';
  if (provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Skip entirely if Duffel not configured
  if (!process.env.DUFFEL_API_KEY) {
    return res.status(200).json({ skipped: true, reason: 'DUFFEL_API_KEY not configured' });
  }

  const v = validateRequest(hotelPricesQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const destParam = v.data.destination || '';

  try {
    // Get destinations to refresh (need lat/lng for Duffel Stays)
    let destinations: Array<{
      id: string;
      iata_code: string;
      city: string;
      latitude: number;
      longitude: number;
    }>;

    if (destParam) {
      const { data, error } = await supabase
        .from(TABLES.destinations)
        .select('id, iata_code, city, latitude, longitude')
        .eq('iata_code', destParam)
        .eq('is_active', true)
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Destination not found' });
      }
      destinations = data
        .filter((d) => d.latitude != null && d.longitude != null)
        .map((d) => ({
          id: d.id,
          iata_code: d.iata_code as string,
          city: d.city as string,
          latitude: d.latitude as number,
          longitude: d.longitude as number,
        }));
      if (destinations.length === 0) {
        return res.status(400).json({ error: 'Destination missing lat/lng — run seed-destination-coords first' });
      }
    } else {
      const { data, error } = await supabase
        .from(TABLES.destinations)
        .select('id, iata_code, city, latitude, longitude')
        .eq('is_active', true)
        .limit(500);
      if (error) throw error;
      destinations = (data ?? [])
        .filter((d) => d.latitude != null && d.longitude != null)
        .map((d) => ({
          id: d.id,
          iata_code: d.iata_code as string,
          city: d.city as string,
          latitude: d.latitude as number,
          longitude: d.longitude as number,
        }));
    }

    // Dates: check-in 30 days from now, 3-night stay
    const checkin = new Date(Date.now() + 30 * 86400000);
    const checkout = new Date(Date.now() + (30 + STAY_NIGHTS) * 86400000);
    const checkinStr = checkin.toISOString().split('T')[0];
    const checkoutStr = checkout.toISOString().split('T')[0];

    const results: Array<{ destination: string; price: number | null; hotelCount: number }> = [];

    // Get existing hotel price docs for upsert
    const existingMap = new Map<string, string>();
    try {
      const { data, error } = await supabase
        .from(TABLES.cachedHotelPrices)
        .select('id, destination_iata')
        .limit(500);
      if (error) throw error;
      for (const doc of data ?? []) {
        existingMap.set(doc.destination_iata as string, doc.id);
      }
    } catch {
      // Collection may be empty
    }

    // Process in batches of 3 with 1500ms delay (rate limit: 60 req/60s shared with flights)
    for (let i = 0; i < destinations.length; i += BATCH_SIZE) {
      const batch = destinations.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (d) => {
        try {
          return await searchStays({
            latitude: d.latitude,
            longitude: d.longitude,
            radius: SEARCH_RADIUS_KM,
            checkIn: checkinStr,
            checkOut: checkoutStr,
            rooms: 1,
            guests: [{ type: 'adult' }],
          });
        } catch (err) {
          console.warn(`[refresh-hotels] Duffel search failed for ${d.iata_code}:`, err);
          return [];
        }
      });

      const batchResults = await Promise.all(promises);

      for (let j = 0; j < batch.length; j++) {
        const dest = batch[j];
        const hotels = batchResults[j];

        if (hotels.length === 0) {
          results.push({ destination: dest.iata_code, price: null, hotelCount: 0 });
          continue;
        }

        // Sort by cheapest total, take top 5
        const sorted = [...hotels]
          .filter((h) => h.cheapestTotalAmount > 0)
          .sort((a, b) => a.cheapestTotalAmount - b.cheapestTotalAmount)
          .slice(0, TOP_HOTELS);

        if (sorted.length === 0) {
          results.push({ destination: dest.iata_code, price: null, hotelCount: 0 });
          continue;
        }

        const cheapestPerNight = Math.round(sorted[0].cheapestTotalAmount / STAY_NIGHTS);

        // Build hotels_json array for caching
        const hotelsJson = sorted.map((h) => ({
          name: h.name,
          rating: h.rating,
          reviewScore: h.reviewScore,
          reviewCount: h.reviewCount,
          pricePerNight: Math.round(h.cheapestTotalAmount / STAY_NIGHTS),
          currency: h.currency,
          photoUrl: h.photoUrl,
          boardType: h.boardType,
          accommodationId: h.accommodationId,
        }));

        results.push({ destination: dest.iata_code, price: cheapestPerNight, hotelCount: hotels.length });

        const data: Record<string, unknown> = {
          destination_iata: dest.iata_code,
          price_per_night: cheapestPerNight,
          currency: sorted[0].currency,
          hotel_count: hotels.length,
          source: 'duffel',
          fetched_at: new Date().toISOString(),
          hotels_json: JSON.stringify(hotelsJson),
        };

        try {
          const existingId = existingMap.get(dest.iata_code);
          if (existingId) {
            const { error } = await supabase
              .from(TABLES.cachedHotelPrices)
              .update(data)
              .eq('id', existingId);
            if (error) throw error;
          } else {
            const { error } = await supabase.from(TABLES.cachedHotelPrices).insert(data);
            if (error) throw error;
          }
        } catch (err) {
          console.error(`[refresh-hotels] Upsert error for ${dest.iata_code}:`, err);
        }
      }

      // Rate-limit delay between batches
      if (i + BATCH_SIZE < destinations.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    const fetched = results.filter((r) => r.price !== null).length;
    console.log(`[refresh-hotels] Fetched ${fetched}/${destinations.length} hotel prices via Duffel Stays`);

    return res.status(200).json({
      fetched,
      total: destinations.length,
      source: 'duffel',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logApiError('api/prices/refresh-hotels', err);
    return res.status(500).json({ error: 'Hotel price refresh failed', detail: message });
  }
}
