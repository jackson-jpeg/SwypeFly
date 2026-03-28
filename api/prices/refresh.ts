import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../../services/supabaseServer';
import { searchFlights } from '../../services/duffel';
import { pricesQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';
import { cors } from '../_cors.js';
import {
  evaluateDealQuality,
  extractSegmentData,
  US_AIRPORTS,
} from '../../utils/dealQuality';
import {
  getRouteStats,
  computePricePercentile,
  updateRouteStats,
  clearStatsCache,
} from '../../utils/priceStats';

// ─── Price history snapshot (stored in ai_cache with 30-day TTL) ─────

async function recordPriceSnapshot(
  origin: string,
  destinationIata: string,
  price: number,
  source: string,
  airline: string,
): Promise<void> {
  try {
    const { error } = await supabase.from(TABLES.aiCache).insert({
      type: 'price_history',
      key: `${origin}-${destinationIata}`,
      content: JSON.stringify({ price, source, airline, timestamp: new Date().toISOString() }),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw error;
  } catch (err) {
    // Non-critical — don't fail the refresh if snapshot recording fails
    console.warn(`[refresh] Price snapshot failed for ${origin}->${destinationIata}:`, err);
  }
}

// ─── Destination metadata cache (for deal quality scoring) ───────────

interface DestMeta {
  country: string;
  popularityScore: number;
  bestMonths: string[];
}

let destMetaCache: Map<string, DestMeta> | null = null;

async function getDestMeta(): Promise<Map<string, DestMeta>> {
  if (destMetaCache) return destMetaCache;
  destMetaCache = new Map();
  try {
    const { data, error } = await supabase
      .from(TABLES.destinations)
      .select('iata_code, country, popularity_score, best_months')
      .eq('is_active', true)
      .limit(500);
    if (error) throw error;
    for (const doc of data ?? []) {
      destMetaCache.set(doc.iata_code as string, {
        country: (doc.country as string) || '',
        popularityScore: (doc.popularity_score as number) || 0,
        bestMonths: (doc.best_months as string[]) || [],
      });
    }
  } catch {
    // Non-fatal
  }
  return destMetaCache;
}

// Pro plan allows up to 300s for serverless functions
export const maxDuration = 300;

// With parallel searches (15 concurrent), each chunk takes ~3s.
// 60 destinations = 4 chunks × ~3s + 1s delays = ~15s search + DB overhead.
const BATCH_SIZE = 60;

// Concurrent Duffel searches per chunk (Duffel rate limit: 60 req/min — 15 concurrent stays under limit)
const CONCURRENCY = 15;

// 5% threshold for price direction tracking
const PRICE_CHANGE_THRESHOLD = 0.05;

// ─── Top-10 fallback airports ────────────────────────────────────────

const DEFAULT_ORIGINS = ['TPA', 'LAX', 'JFK', 'ORD', 'ATL', 'SFO', 'MIA', 'DFW', 'SEA', 'BOS'];

async function getActiveOrigins(): Promise<string[]> {
  const origins = new Set(DEFAULT_ORIGINS);
  try {
    const { data, error } = await supabase
      .from(TABLES.userPreferences)
      .select('departure_code')
      .limit(500);
    if (error) throw error;
    for (const doc of data ?? []) {
      if (doc.departure_code) origins.add(doc.departure_code as string);
    }
  } catch {
    // user_preferences collection may not have data yet
  }
  return Array.from(origins);
}

// ─── Round-robin: pick the N origins refreshed longest ago ───────────

async function pickNextOrigins(count: number): Promise<string[]> {
  const origins = await getActiveOrigins();

  let statusDocs: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await supabase
      .from(TABLES.cachedPrices)
      .select('origin, fetched_at')
      .order('fetched_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    statusDocs = data ?? [];
  } catch {
    // No cached prices yet
  }

  const lastRefreshed = new Map<string, string>();
  for (const row of statusDocs) {
    const o = row.origin as string;
    const ts = row.fetched_at as string;
    if (!lastRefreshed.has(o) || ts > lastRefreshed.get(o)!) {
      lastRefreshed.set(o, ts);
    }
  }

  // Sort origins by staleness (never refreshed first, then oldest)
  const sorted = [...origins].sort((a, b) => {
    const tsA = lastRefreshed.get(a);
    const tsB = lastRefreshed.get(b);
    if (!tsA && !tsB) return 0;
    if (!tsA) return -1;
    if (!tsB) return 1;
    return new Date(tsA).getTime() - new Date(tsB).getTime();
  });

  return sorted.slice(0, count);
}

// ─── Date strategy for discovery searches ────────────────────────────

function getSearchDates(): { departureDate: string; returnDate: string } {
  // ~2 weeks out, shifted to next Wednesday (cheaper mid-week flights)
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86400000);
  const dayOfWeek = twoWeeksOut.getDay(); // 0=Sun, 3=Wed
  const daysUntilWed = (3 - dayOfWeek + 7) % 7 || 7;
  const departure = new Date(twoWeeksOut.getTime() + daysUntilWed * 86400000);
  // Return: departure + 7 days (standard 1-week trip)
  const returnDate = new Date(departure.getTime() + 7 * 86400000);

  return {
    departureDate: departure.toISOString().split('T')[0],
    returnDate: returnDate.toISOString().split('T')[0],
  };
}

// ─── Compact offer JSON for caching ──────────────────────────────────

function compactOfferJson(offer: Record<string, unknown>): string {
  const compact = {
    id: offer.id,
    total_amount: offer.total_amount,
    total_currency: offer.total_currency,
    expires_at: offer.expires_at,
    slices: ((offer.slices as any[]) || []).map((slice: any) => ({
      segments: ((slice.segments as any[]) || []).map((seg: any) => ({
        operating_carrier: {
          name: seg.operating_carrier?.name,
          iata_code: seg.operating_carrier?.iata_code,
        },
        operating_carrier_flight_number: seg.operating_carrier_flight_number,
        departing_at: seg.departing_at,
        arriving_at: seg.arriving_at,
        origin: { iata_code: seg.origin?.iata_code },
        destination: { iata_code: seg.destination?.iata_code },
        aircraft: seg.aircraft ? { name: seg.aircraft.name } : null,
      })),
    })),
  };
  return JSON.stringify(compact);
}

// ─── Refresh a batch of destinations for one origin via Duffel ───────

interface BatchResult {
  origin: string;
  fetched: number;
  total: number;
  sources: Record<string, number>;
}

async function refreshOneDest(
  origin: string,
  dest: string,
  departureDate: string,
  returnDate: string,
  currentPriceMap: Map<string, { price: number; docId: string }>,
): Promise<{ source: 'duffel' | null }> {
  let price: number | null = null;
  let airline = '';
  let depDate = departureDate;
  let retDate = returnDate;
  let offerJson = '';
  let offerExpiresAt = '';

  // Duffel search
  try {
    const result = await searchFlights({
      origin,
      destination: dest,
      departureDate,
      returnDate,
      passengers: [{ type: 'adult' }],
      cabinClass: 'economy',
    });

    const offers = (result as any).offers as any[] | undefined;
    if (offers && offers.length > 0) {
      offers.sort(
        (a: any, b: any) => parseFloat(a.total_amount) - parseFloat(b.total_amount),
      );
      const cheapest = offers[0];

      price = Math.round(parseFloat(cheapest.total_amount));
      offerExpiresAt = cheapest.expires_at || '';

      const firstSlice = cheapest.slices?.[0];
      const firstSeg = firstSlice?.segments?.[0];
      if (firstSeg?.operating_carrier) {
        airline = firstSeg.operating_carrier.name || firstSeg.operating_carrier.iata_code || '';
      }
      if (firstSeg?.departing_at) {
        depDate = firstSeg.departing_at.split('T')[0];
      }
      const lastSlice = cheapest.slices?.[cheapest.slices.length - 1];
      const lastSeg = lastSlice?.segments?.[0];
      if (lastSeg?.departing_at) {
        retDate = lastSeg.departing_at.split('T')[0];
      }

      offerJson = compactOfferJson(cheapest);
      if (offerJson.length > 10000) {
        offerJson = offerJson.slice(0, 10000);
      }
    }
  } catch (err) {
    console.warn(`[refresh] Duffel search failed for ${origin}->${dest}:`, err);
  }

  if (price === null) return { source: null };

  // Price history tracking
  const existing = currentPriceMap.get(dest);
  let priceDirection: 'up' | 'down' | 'stable' = 'stable';
  const prevPrice = existing?.price;
  if (prevPrice != null && prevPrice > 0) {
    const pctChange = (price - prevPrice) / prevPrice;
    if (pctChange > PRICE_CHANGE_THRESHOLD) priceDirection = 'up';
    else if (pctChange < -PRICE_CHANGE_THRESHOLD) priceDirection = 'down';
  }

  let tripDurationDays: number | null = null;
  if (depDate && retDate) {
    const dep = new Date(depDate);
    const ret = new Date(retDate);
    if (!isNaN(dep.getTime()) && !isNaN(ret.getTime())) {
      tripDurationDays = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // ── Deal quality gate ──────────────────────────────────────────────
  const meta = (await getDestMeta()).get(dest);
  const isDomestic = US_AIRPORTS.has(origin) && US_AIRPORTS.has(dest);
  const segData = offerJson ? extractSegmentData(offerJson) : null;

  const stats = await getRouteStats(origin, dest);
  const pricePercentile = computePricePercentile(price, stats);

  const dealResult = evaluateDealQuality({
    originIata: origin,
    destinationIata: dest,
    price,
    departureDate: depDate || departureDate,
    returnDate: retDate || returnDate,
    isDomestic,
    destinationCountry: meta?.country,
    airline: segData?.airlineCode || airline,
    totalStops: segData?.totalStops,
    totalTravelTimeMinutes: segData?.totalTravelTimeMinutes,
    maxLayoverMinutes: segData?.maxLayoverMinutes,
    departureHour: segData?.departureHour,
    pricePercentile,
    popularityScore: meta?.popularityScore,
    bestMonths: meta?.bestMonths,
    foundAt: new Date().toISOString(),
  });

  if (!dealResult.pass) {
    console.info(`[refresh] Rejected ${origin}->${dest}: ${dealResult.rejectReason}`);
    return { source: null };
  }

  // Update route stats with this price (non-blocking)
  updateRouteStats(origin, dest, price).catch(() => {});

  const data: Record<string, unknown> = {
    origin,
    destination_iata: dest,
    price,
    currency: 'USD',
    airline,
    source: 'duffel',
    fetched_at: new Date().toISOString(),
    departure_date: depDate || '',
    return_date: retDate || '',
    trip_duration_days: tripDurationDays ?? 0,
    previous_price: prevPrice ?? 0,
    price_direction: priceDirection,
    offer_json: offerJson,
    offer_expires_at: offerExpiresAt,
    tp_found_at: '',
    // Deal quality fields
    deal_score: dealResult.dealScore,
    deal_tier: dealResult.dealTier,
    quality_score: dealResult.qualityScore,
    price_percentile: Math.round(pricePercentile),
    is_nonstop: segData?.isNonstop ?? false,
    total_stops: segData?.totalStops ?? -1,
    max_layover_minutes: segData?.maxLayoverMinutes ?? -1,
    total_travel_minutes: segData?.totalTravelTimeMinutes ?? -1,
  };

  try {
    if (existing) {
      const { error } = await supabase
        .from(TABLES.cachedPrices)
        .update(data)
        .eq('id', existing.docId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(TABLES.cachedPrices).insert(data);
      if (error) throw error;
    }
  } catch (err) {
    console.error(`[refresh] Upsert error for ${origin}->${dest}:`, err);
    return { source: null };
  }

  // Record price snapshot for history tracking (non-blocking)
  await recordPriceSnapshot(origin, dest, price, 'duffel', airline);

  return { source: 'duffel' };
}

async function refreshBatch(
  origin: string,
  batch: string[],
  currentPriceMap: Map<string, { price: number; docId: string }>,
): Promise<BatchResult> {
  const sourceCounts: Record<string, number> = { duffel: 0 };
  const { departureDate, returnDate } = getSearchDates();
  let fetched = 0;

  // Duffel searches for the stalest destinations
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((dest) => refreshOneDest(origin, dest, departureDate, returnDate, currentPriceMap)),
    );
    for (const r of results) {
      if (r.source) {
        sourceCounts[r.source]++;
        fetched++;
      }
    }

    // Rate limit: 1-second delay between chunks (concurrency cap already limits Duffel load)
    if (i + CONCURRENCY < batch.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.info(`[refresh] Batch for ${origin}: ${fetched} total (Duffel: ${sourceCounts.duffel})`);

  return { origin, fetched, total: batch.length, sources: sourceCounts };
}

// ─── Pick stalest destinations for an origin ─────────────────────────

async function pickStalestDestinations(
  origin: string,
  allIatas: string[],
  count: number,
): Promise<{ batch: string[]; currentPriceMap: Map<string, { price: number; docId: string }> }> {
  const currentPriceMap = new Map<string, { price: number; docId: string }>();

  try {
    const { data, error } = await supabase
      .from(TABLES.cachedPrices)
      .select('id, destination_iata, price')
      .eq('origin', origin)
      .limit(500);
    if (error) throw error;
    for (const doc of data ?? []) {
      currentPriceMap.set(doc.destination_iata as string, {
        price: doc.price as number,
        docId: doc.id,
      });
    }
  } catch {
    // No existing prices for this origin
  }

  // Build staleness map: iata -> fetched_at timestamp
  const fetchedAtMap = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .from(TABLES.cachedPrices)
      .select('destination_iata, fetched_at')
      .eq('origin', origin)
      .order('fetched_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    for (const doc of data ?? []) {
      fetchedAtMap.set(doc.destination_iata as string, doc.fetched_at as string);
    }
  } catch {
    // No data yet
  }

  // Sort: never-refreshed first, then oldest fetched_at
  const sorted = [...allIatas].sort((a, b) => {
    const tsA = fetchedAtMap.get(a);
    const tsB = fetchedAtMap.get(b);
    if (!tsA && !tsB) return 0;
    if (!tsA) return -1;
    if (!tsB) return 1;
    return new Date(tsA).getTime() - new Date(tsB).getTime();
  });

  return { batch: sorted.slice(0, count), currentPriceMap };
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  // Verify authorization: Vercel cron sends CRON_SECRET, manual calls need Authorization header
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' });
  }
  const authHeader = req.headers.authorization;
  const provided = authHeader?.replace('Bearer ', '') || '';
  if (provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const v = validateRequest(pricesQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const originParam = v.data.origin || '';

  try {
    // Clear caches for fresh cron run
    clearStatsCache();
    destMetaCache = null;

    // Get all active destination IATA codes from Supabase
    const { data: destData, error: destError } = await supabase
      .from(TABLES.destinations)
      .select('iata_code')
      .eq('is_active', true)
      .limit(500);
    if (destError) throw destError;

    const allIatasList = (destData ?? []).map((d) => d.iata_code as string);

    // Determine which origin to refresh
    let origins: string[];
    if (originParam && originParam !== 'ALL') {
      origins = [originParam];
    } else {
      origins = await pickNextOrigins(1);
      console.info(`[refresh] Round-robin selected origins: ${origins.join(', ')}`);
    }

    console.info(`[refresh] Refreshing ${origins.length} origin(s): ${origins.join(', ')}`);

    const results = [];
    for (const org of origins) {
      // Pick the stalest BATCH_SIZE destinations for targeted Duffel searches
      const { batch, currentPriceMap } = await pickStalestDestinations(org, allIatasList, BATCH_SIZE);
      console.info(`[refresh] Duffel batch for ${org}: ${batch.join(', ')}`);

      const result = await refreshBatch(org, batch, currentPriceMap);
      results.push(result);
    }

    return res.status(200).json({
      origins: results,
      totalOrigins: results.length,
      batchSize: BATCH_SIZE,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logApiError('api/prices/refresh', err);
    return res.status(500).json({ error: 'Price refresh failed', detail: message });
  }
}
