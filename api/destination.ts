import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { destinationQuerySchema, priceCalendarQuerySchema, weekMatrixQuerySchema, priceHistoryQuerySchema, validateRequest } from '../utils/validation';
import { fetchPriceCalendar, fetchMonthlyPrices, fetchWeekMatrix } from '../services/travelpayouts';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors.js';

// ─── Price calendar handler ──────────────────────────────────────────

async function handleCalendar(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(priceCalendarQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { origin, destination, month } = v.data;

  try {
    const calendar = await fetchPriceCalendar(origin, destination, 'USD', month);
    if (calendar.length === 0) {
      return res.status(200).json({ calendar: [], cheapestDate: null, cheapestPrice: null });
    }

    const cheapest = calendar.reduce((min, entry) =>
      entry.price < min.price ? entry : min, calendar[0]);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({
      calendar,
      cheapestDate: cheapest.date,
      cheapestPrice: cheapest.price,
    });
  } catch (err) {
    logApiError('api/destination?action=calendar', err);
    return res.status(500).json({ error: 'Failed to load price calendar' });
  }
}

// ─── Monthly price overview handler ──────────────────────────────────

async function handleMonthly(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(priceCalendarQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { origin, destination } = v.data;

  try {
    const monthly = await fetchMonthlyPrices(origin, destination, 'USD');
    if (monthly.length === 0) {
      return res.status(200).json({ months: [], cheapestMonth: null, cheapestPrice: null });
    }

    const cheapest = monthly.reduce((min, entry) =>
      entry.price < min.price ? entry : min, monthly[0]);

    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=14400');
    return res.status(200).json({
      months: monthly,
      cheapestMonth: cheapest.month,
      cheapestPrice: cheapest.price,
    });
  } catch (err) {
    logApiError('api/destination?action=monthly', err);
    return res.status(500).json({ error: 'Failed to load monthly prices' });
  }
}

// ─── Week flexibility matrix handler ─────────────────────────────────

async function handleWeekMatrix(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(weekMatrixQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { origin, destination, departDate, returnDate } = v.data;

  try {
    const matrix = await fetchWeekMatrix(origin, destination, departDate, returnDate);
    const cheapest = matrix.length > 0 ? matrix[0] : null;

    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=14400');
    return res.status(200).json({
      matrix,
      cheapest: cheapest
        ? { departDate: cheapest.departDate, returnDate: cheapest.returnDate, price: cheapest.price }
        : null,
    });
  } catch (err) {
    logApiError('api/destination?action=week-matrix', err);
    return res.status(500).json({ error: 'Failed to load week matrix' });
  }
}

// ─── Price history handler ───────────────────────────────────────────

// In-memory cache for price history (30 min TTL)
const priceHistoryCache = new Map<string, { data: unknown; expires: number }>();

async function handlePriceHistory(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(priceHistoryQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { origin, destination } = v.data;

  const cacheKey = `${origin}-${destination}`;
  const cached = priceHistoryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(cached.data);
  }

  try {
    // Query ai_cache for price_history documents matching this destination
    const result = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.aiCache,
      [
        Query.equal('type', 'price_history'),
        Query.search('key', destination),
        Query.orderAsc('created_at'),
        Query.limit(100),
      ],
    );

    // Also pull current cached_prices for this route
    const currentPriceResult = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.cachedPrices,
      [
        Query.equal('origin', origin),
        Query.equal('destination_iata', destination),
        Query.limit(1),
      ],
    ).catch(() => ({ documents: [] }));

    const currentPriceDoc = currentPriceResult.documents[0];
    const currentPrice = (currentPriceDoc?.price as number) ?? null;

    // Parse history entries
    const history: { date: string; price: number; source: string; airline: string }[] = [];
    for (const doc of result.documents) {
      try {
        // Filter: key must end with the destination code
        const key = doc.key as string;
        if (!key.endsWith(`-${destination}`)) continue;

        const content = JSON.parse(doc.content as string);
        history.push({
          date: content.timestamp || (doc.created_at as string),
          price: content.price as number,
          source: (content.source as string) || 'unknown',
          airline: (content.airline as string) || '',
        });
      } catch {
        // Skip malformed entries
      }
    }

    // Compute stats
    const prices = history.map((h) => h.price).filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

    // Determine trend from last few data points
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (prices.length >= 3) {
      const recent = prices.slice(-3);
      const older = prices.slice(-6, -3);
      if (older.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const pctChange = (recentAvg - olderAvg) / olderAvg;
        if (pctChange > 0.05) trend = 'up';
        else if (pctChange < -0.05) trend = 'down';
      }
    }

    const responseData = {
      history,
      currentPrice,
      avgPrice,
      minPrice,
      maxPrice,
      trend,
    };

    // Cache for 30 minutes
    priceHistoryCache.set(cacheKey, { data: responseData, expires: Date.now() + 30 * 60 * 1000 });

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(responseData);
  } catch (err) {
    logApiError('api/destination?action=price-history', err);
    return res.status(500).json({ error: 'Failed to load price history' });
  }
}

// ─── Main handler ────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Route by action param
  if (req.query.action === 'calendar') {
    return handleCalendar(req, res);
  }
  if (req.query.action === 'monthly') {
    return handleMonthly(req, res);
  }
  if (req.query.action === 'week-matrix') {
    return handleWeekMatrix(req, res);
  }
  if (req.query.action === 'price-history') {
    return handlePriceHistory(req, res);
  }

  const v = validateRequest(destinationQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { id, origin } = v.data;

  try {
    // Fetch destination from Appwrite (getDocument throws on 404)
    let dest;
    try {
      dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, id);
    } catch {
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
          Query.orderAsc('price'),
          Query.limit(1),
        ],
      );
      if (priceResult.documents.length > 0) {
        price = priceResult.documents[0];
      }
    } catch {
      // No cached prices
    }

    // Fetch other prices, hotel price, refreshed images, and similar destinations in parallel
    const [allPricesResult, hotelPriceResult, imageResult, similarResult] = await Promise.all([
      serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
        Query.equal('destination_iata', dest.iata_code as string),
        Query.limit(20),
      ]).catch(() => ({ documents: [] })),
      serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedHotelPrices, [
        Query.equal('destination_iata', dest.iata_code as string),
        Query.limit(1),
      ]).catch(() => ({ documents: [] })),
      serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinationImages, [
        Query.equal('destination_id', id),
        Query.equal('is_primary', true),
        Query.limit(1),
      ]).catch(() => ({ documents: [] })),
      serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [
        Query.equal('country', dest.country as string),
        Query.notEqual('$id', id),
        Query.limit(3),
      ]).catch(() => ({ documents: [] })),
    ]);

    const otherPrices = allPricesResult.documents
      .filter((p) => p.origin !== origin)
      .map((p) => ({ origin: p.origin as string, price: p.price as number, source: p.source as string }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);

    const hotelPriceDoc = hotelPriceResult.documents[0];
    const hotelPrice = hotelPriceDoc;

    // Parse hotels_json from cached hotel prices
    let hotels: any[] | undefined;
    try {
      hotels = hotelPriceDoc?.hotels_json ? JSON.parse(hotelPriceDoc.hotels_json as string) : undefined;
    } catch {
      hotels = undefined;
    }
    const refreshedImage = imageResult.documents[0];

    const similarDestinations = similarResult.documents.map((d) => ({
      id: d.$id as string,
      city: d.city as string,
      flightPrice: (d.flight_price as number) ?? 0,
      imageUrl: (d.image_url as string) ?? '',
    }));

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
      imageUrl: (refreshedImage?.url_regular as string) || dest.image_url,
      imageUrls: dest.image_urls,
      flightPrice: (price?.price as number) ?? dest.flight_price,
      hotelPricePerNight: (hotelPrice?.price_per_night as number) ?? dest.hotel_price_per_night,
      currency: dest.currency,
      vibeTags: dest.vibe_tags,
      bestMonths: dest.best_months,
      averageTemp: dest.average_temp,
      flightDuration: (price?.duration as string) || dest.flight_duration,
      livePrice: (price?.price as number) ?? null,
      priceSource: price ? ((price.source as string) || 'estimate') : 'estimate',
      priceFetchedAt: (price?.fetched_at as string) || undefined,
      liveHotelPrice: (hotelPrice?.price_per_night as number) ?? null,
      hotelPriceSource: hotelPrice ? ((hotelPrice.source as string) || 'estimate') : 'estimate',
      hotels: hotels ?? undefined,
      available_flight_days: dest.available_flight_days,
      itinerary,
      restaurants,
      departureDate: (price?.departure_date as string) || undefined,
      returnDate: (price?.return_date as string) || undefined,
      tripDurationDays: (price?.trip_duration_days as number) ?? undefined,
      airline: (price?.airline as string) || undefined,
      priceDirection: (price?.price_direction as string) || undefined,
      previousPrice: (price?.previous_price as number) ?? undefined,
      offerJson: (price?.offer_json as string) || undefined,
      offerExpiresAt: (price?.offer_expires_at as string) || undefined,
      flightNumber: (price?.flight_number as string) || undefined,
      tpFoundAt: (price?.tp_found_at as string) || undefined,
      latitude: (dest.latitude as number) ?? undefined,
      longitude: (dest.longitude as number) ?? undefined,
      otherPrices,
      similarDestinations,
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/destination', err);
    return res.status(500).json({ error: 'Failed to load destination' });
  }
}
