import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { OfferRequest } from '@duffel/api/types';
import { supabase, TABLES } from '../services/supabaseServer';
import { destinationQuerySchema, priceCalendarQuerySchema, weekMatrixQuerySchema, priceHistoryQuerySchema, validateRequest } from '../utils/validation';
import { getOffersFromResult, sortOffersByPrice, extractCheapestOfferData } from '../utils/duffelMapper';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors.js';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { env } from '../utils/env';
import { STALE_PRICE_MS } from '../utils/config';
import { sendError } from '../utils/apiResponse';

const BOOKING_MARKUP_PERCENT = env.BOOKING_MARKUP_PERCENT;
const PRICE_STALE_MS = STALE_PRICE_MS;

/** Apply booking markup so displayed prices match checkout. */
function withMarkup(price: number | null | undefined): number | null {
  if (price == null) return null;
  return Math.round(price * (1 + BOOKING_MARKUP_PERCENT / 100));
}

/** Check if a cached price is stale (older than PRICE_STALE_MS). */
function isPriceStale(fetchedAt: string | undefined | null): boolean {
  if (!fetchedAt) return true;
  return Date.now() - new Date(fetchedAt).getTime() > PRICE_STALE_MS;
}

/**
 * Background refresh: run a Duffel search and update cached_prices.
 * Fire-and-forget — doesn't block the response.
 */
function backgroundPriceRefresh(origin: string, destIata: string) {
  (async () => {
    try {
      const { searchFlights } = await import('../services/duffel.js');
      // Pick dates 2-4 weeks out, midweek, 7-day trip
      const now = new Date();
      const offset = 14 + Math.floor(Math.random() * 14);
      const dep = new Date(now.getTime() + offset * 86400000);
      // Nudge to Tuesday-Thursday
      const dow = dep.getDay();
      if (dow === 0) dep.setDate(dep.getDate() + 2);
      else if (dow === 6) dep.setDate(dep.getDate() + 3);
      else if (dow === 5) dep.setDate(dep.getDate() + 4);
      else if (dow === 1) dep.setDate(dep.getDate() + 1);
      const ret = new Date(dep.getTime() + 7 * 86400000);
      const depStr = dep.toISOString().slice(0, 10);
      const retStr = ret.toISOString().slice(0, 10);

      const result = await searchFlights({
        origin,
        destination: destIata,
        departureDate: depStr,
        returnDate: retStr,
        passengers: [{ type: 'adult' }],
        cabinClass: 'economy',
      });

      const offers = getOffersFromResult(result as OfferRequest);
      if (!offers.length) return;

      const sorted = sortOffersByPrice(offers);
      const data = extractCheapestOfferData(sorted[0]);
      const price = data.price;
      const duration = data.duration;
      const airline = data.airlineCode;

      await supabase.from(TABLES.cachedPrices).upsert(
        {
          origin,
          destination_iata: destIata,
          price,
          currency: 'USD',
          airline,
          duration,
          source: 'duffel',
          fetched_at: new Date().toISOString(),
          departure_date: depStr,
          return_date: retStr,
          trip_duration_days: 7,
        },
        { onConflict: 'origin,destination_iata' },
      );
      console.log(`[destination] Background refresh: ${origin}->${destIata} = $${price}`);
    } catch (err) {
      // Silent fail — this is a best-effort background task
      console.warn(`[destination] Background refresh failed for ${origin}->${destIata}:`, err instanceof Error ? err.message : err);
    }
  })();
}

// ─── Price calendar handler ──────────────────────────────────────────

async function handleCalendar(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(priceCalendarQuerySchema, req.query);
  if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);
  const { origin, destination, month } = v.data;

  try {
    const datePrefix = month || new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().split('T')[0];

    // Try price_calendar collection first (cached by cron)
    let calendarDocs: Record<string, unknown>[] = [];
    try {
      const { data } = await supabase
        .from(TABLES.priceCalendar)
        .select('*')
        .eq('origin', origin)
        .eq('destination_iata', destination)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(90);
      calendarDocs = data ?? [];
    } catch {
      calendarDocs = [];
    }

    // Filter to requested month
    const monthDocs = calendarDocs.filter(
      (d) => (d.date as string).startsWith(datePrefix),
    );

    if (monthDocs.length > 0) {
      const calendar = monthDocs.map((d) => ({
        date: d.date as string,
        price: withMarkup(d.price as number) ?? (d.price as number),
        airline: (d.airline as string) || '',
        transferCount: 0,
      }));

      const cheapest = calendar.reduce((min, entry) =>
        entry.price < min.price ? entry : min, calendar[0]);

      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json({
        calendar,
        cheapestDate: cheapest.date,
        cheapestPrice: cheapest.price,
      });
    }

    // Phase 4: no Travelpayouts fallback. If price_calendar is empty for this
    // route, signal "not yet indexed" instead of serving stale indicative data.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      calendar: null,
      cheapestDate: null,
      cheapestPrice: null,
      reason: 'not_yet_indexed',
    });
  } catch (err) {
    logApiError('api/destination?action=calendar', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to load price calendar');
  }
}

// ─── Monthly price overview handler ──────────────────────────────────

async function handleMonthly(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(priceCalendarQuerySchema, req.query);
  if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);

  // Phase 4: Travelpayouts removed from user-facing paths. Monthly overview
  // is not backed by Duffel yet — return empty with a reason.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({
    months: [],
    cheapestMonth: null,
    cheapestPrice: null,
    reason: 'not_yet_indexed',
  });
}

// ─── Week flexibility matrix handler ─────────────────────────────────

async function handleWeekMatrix(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(weekMatrixQuerySchema, req.query);
  if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);

  // Phase 4: Travelpayouts removed from user-facing paths. Week-matrix
  // flexibility grid is not backed by Duffel yet — return empty with a reason.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({
    matrix: [],
    cheapest: null,
    reason: 'not_yet_indexed',
  });
}

// ─── Price history handler ───────────────────────────────────────────

// In-memory cache for price history (30 min TTL)
const priceHistoryCache = new Map<string, { data: unknown; expires: number }>();

async function handlePriceHistory(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(priceHistoryQuerySchema, req.query);
  if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);
  const { origin, destination } = v.data;

  const cacheKey = `ph:${origin}:${destination}`;
  const cached = priceHistoryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(cached.data);
  }

  try {
    // Query ai_cache for price_history documents matching this destination
    const { data: aiCacheData } = await supabase
      .from(TABLES.aiCache)
      .select('*')
      .eq('type', 'price_history')
      .ilike('key', '%' + destination + '%')
      .order('created_at', { ascending: true })
      .limit(100);

    const result = aiCacheData ?? [];

    // Also pull current cached_prices for this route
    const { data: currentPriceData } = await Promise.resolve(
      supabase
        .from(TABLES.cachedPrices)
        .select('*')
        .eq('origin', origin)
        .eq('destination_iata', destination)
        .order('price', { ascending: true })
        .limit(1)
    ).catch(() => ({ data: [] as Record<string, unknown>[] }));

    const currentPriceDoc = (currentPriceData ?? [])[0];
    const currentPrice = (currentPriceDoc?.price as number) ?? null;

    // Parse history entries
    const history: { date: string; price: number; source: string; airline: string }[] = [];
    for (const doc of result) {
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
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to load price history');
  }
}

// ─── Main handler ────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  // Rate limit: 30 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`dest:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests', { retryAfter });
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
  if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);
  const { id, origin } = v.data;

  try {
    // Fetch destination from Supabase
    let dest: Record<string, unknown>;
    const { data: destData, error: destError } = await supabase
      .from(TABLES.destinations)
      .select('*')
      .eq('id', id)
      .single();

    if (destError || !destData) {
      return sendError(res, 404, 'NOT_FOUND', 'Destination not found');
    }
    dest = destData;

    // Fetch cached prices for this origin + destination.
    // Phase 4: only Duffel-sourced prices are user-facing. Ignore any
    // Travelpayouts / indicative cache rows.
    let price: Record<string, unknown> | null = null;
    try {
      const { data: priceData } = await supabase
        .from(TABLES.cachedPrices)
        .select('*')
        .eq('origin', origin)
        .eq('destination_iata', dest.iata_code as string)
        .eq('source', 'duffel')
        .order('price', { ascending: true })
        .limit(1);
      if (priceData && priceData.length > 0) {
        price = priceData[0];
      }
    } catch {
      // No cached prices
    }

    // If no cached Duffel price, try an on-demand Duffel search synchronously
    // (best-effort, short timeout). Falls through to null if Duffel doesn't
    // support the route.
    if (!price && origin && dest.iata_code) {
      try {
        const { searchFlights } = await import('../services/duffel.js');
        const now = new Date();
        const offset = 14 + Math.floor(Math.random() * 14);
        const dep = new Date(now.getTime() + offset * 86400000);
        const dow = dep.getDay();
        if (dow === 0) dep.setDate(dep.getDate() + 2);
        else if (dow === 6) dep.setDate(dep.getDate() + 3);
        else if (dow === 5) dep.setDate(dep.getDate() + 4);
        else if (dow === 1) dep.setDate(dep.getDate() + 1);
        const ret = new Date(dep.getTime() + 7 * 86400000);
        const depStr = dep.toISOString().slice(0, 10);
        const retStr = ret.toISOString().slice(0, 10);

        const result = await searchFlights({
          origin,
          destination: dest.iata_code as string,
          departureDate: depStr,
          returnDate: retStr,
          passengers: [{ type: 'adult' }],
          cabinClass: 'economy',
        });
        const offers = getOffersFromResult(result as OfferRequest);
        if (offers.length) {
          const sorted = sortOffersByPrice(offers);
          const data = extractCheapestOfferData(sorted[0]);
          price = {
            price: data.price,
            airline: data.airlineCode,
            duration: data.duration,
            source: 'duffel',
            fetched_at: new Date().toISOString(),
            departure_date: depStr,
            return_date: retStr,
            trip_duration_days: 7,
          };
          // Best-effort cache write
          supabase.from(TABLES.cachedPrices).upsert(
            {
              origin,
              destination_iata: dest.iata_code as string,
              price: data.price,
              currency: 'USD',
              airline: data.airlineCode,
              duration: data.duration,
              source: 'duffel',
              fetched_at: new Date().toISOString(),
              departure_date: depStr,
              return_date: retStr,
              trip_duration_days: 7,
            },
            { onConflict: 'origin,destination_iata' },
          ).then(() => {}, () => {});
        }
      } catch (err) {
        console.warn(`[destination] On-demand Duffel fetch failed:`, err instanceof Error ? err.message : err);
      }
    }

    // If cached price is stale (>2h old), trigger a background Duffel search.
    // This is fire-and-forget — the current response uses the stale price,
    // but the next visitor will see the fresh one. Costs nothing on cache hit,
    // ~1 Duffel call per stale destination view.
    if (origin && dest.iata_code && isPriceStale(price?.fetched_at as string | undefined)) {
      backgroundPriceRefresh(origin, dest.iata_code as string);
    }

    // Fetch other prices, hotel price, refreshed images, and similar destinations in parallel
    const [allPricesResult, hotelPriceResult, imageResult, similarResult] = await Promise.all([
      Promise.resolve(
        supabase.from(TABLES.cachedPrices).select('*').eq('destination_iata', dest.iata_code as string).limit(20)
      ).then(({ data }) => data ?? []).catch(() => [] as Record<string, unknown>[]),
      Promise.resolve(
        supabase.from(TABLES.cachedHotelPrices).select('*').eq('destination_iata', dest.iata_code as string).limit(1)
      ).then(({ data }) => data ?? []).catch(() => [] as Record<string, unknown>[]),
      Promise.resolve(
        supabase.from(TABLES.destinationImages).select('*').eq('destination_id', id).eq('is_primary', true).limit(1)
      ).then(({ data }) => data ?? []).catch(() => [] as Record<string, unknown>[]),
      Promise.resolve(
        supabase.from(TABLES.destinations).select('*').eq('country', dest.country as string).neq('id', id).limit(3)
      ).then(({ data }) => data ?? []).catch(() => [] as Record<string, unknown>[]),
    ]);

    const otherPrices = allPricesResult
      .filter((p) => p.origin !== origin)
      .map((p) => ({ origin: p.origin as string, price: p.price as number, source: p.source as string }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);

    const hotelPriceDoc = hotelPriceResult[0];
    const hotelPrice = hotelPriceDoc;

    // Parse hotels_json from cached hotel prices
    let hotels: Record<string, unknown>[] | undefined;
    try {
      hotels = hotelPriceDoc?.hotels_json ? JSON.parse(hotelPriceDoc.hotels_json as string) : undefined;
    } catch {
      hotels = undefined;
    }
    const refreshedImage = imageResult[0];

    // Phase 4: similarDestinations no longer carries Travelpayouts indicative
    // flightPrice. Clients should fetch live Duffel price on tap if needed.
    const similarDestinations = similarResult.map((d) => ({
      id: d.id as string,
      city: d.city as string,
      flightPrice: null,
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
      id: dest.id,
      iataCode: dest.iata_code,
      city: dest.city,
      country: dest.country,
      tagline: dest.tagline,
      description: dest.description,
      imageUrl: (refreshedImage?.url_regular as string) || dest.image_url,
      imageUrls: dest.image_urls,
      // Phase 4: no Travelpayouts/indicative fallback. If no Duffel price, null.
      flightPrice: withMarkup((price?.price as number) ?? null),
      hotelPricePerNight: (hotelPrice?.price_per_night as number) ?? dest.hotel_price_per_night,
      currency: dest.currency,
      vibeTags: dest.vibe_tags,
      bestMonths: dest.best_months,
      averageTemp: dest.average_temp,
      flightDuration: (price?.duration as string) || dest.flight_duration,
      livePrice: withMarkup((price?.price as number) ?? null),
      priceSource: price ? ((price.source as string) || 'duffel') : null,
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
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to load destination');
  }
}
