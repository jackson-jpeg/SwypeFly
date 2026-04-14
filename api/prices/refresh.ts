import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../../services/supabaseServer';
import { searchFlights } from '../../services/duffel';
import type { OfferRequest, OfferSlice, OfferSliceSegment } from '@duffel/api/types';
import {
  compactOfferJson as sharedCompactOfferJson,
  getOffersFromResult,
  sortOffersByPrice,
} from '../../utils/duffelMapper';
import { pricesQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';
import { cors } from '../_cors.js';
import { withRetry } from '../../utils/retry';
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
import { env } from '../../utils/env';
import {
  REFRESH_BATCH_SIZE,
  DUFFEL_CONCURRENCY,
  PRICE_CHANGE_THRESHOLD,
  SEARCH_WINDOW_MONTHS,
  MAX_LAYOVER_HOURS,
  MIN_DEST_TIME_RATIO,
  TRIP_LENGTH_BUCKETS,
  SEARCH_MONTH_OFFSETS,
  TRIP_LENGTHS_PER_ROUTE,
} from '../../utils/config';
import { sendError } from '../../utils/apiResponse';

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
  } catch (err) {
    console.warn('[refresh] Failed to load destination metadata:', err);
  }
  return destMetaCache;
}

// Pro plan allows up to 300s for serverless functions
export const maxDuration = 300;

// With parallel searches (15 concurrent), each chunk takes ~3s.
// 200 destinations = ~14 chunks × ~1s each = ~14s search + DB overhead — well within 60s limit.
const BATCH_SIZE = REFRESH_BATCH_SIZE;

// Concurrent Duffel searches per chunk (Duffel rate limit: 60 req/min — 15 concurrent stays under limit)
const CONCURRENCY = DUFFEL_CONCURRENCY;

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
  } catch (err) {
    console.warn('[refresh] Failed to fetch user departure codes:', err);
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
  } catch (err) {
    console.warn('[refresh] Failed to fetch cached price timestamps:', err);
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

/** Parse ISO 8601 duration string like "PT6H30M" → minutes. Returns null if unparseable. */
function parseIsoDurationToMinutes(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!m) return null;
  const days = m[1] ? parseInt(m[1], 10) : 0;
  const hours = m[2] ? parseInt(m[2], 10) : 0;
  const mins = m[3] ? parseInt(m[3], 10) : 0;
  return days * 24 * 60 + hours * 60 + mins;
}

/** Shift a Date to the next Wednesday (cheaper mid-week flight heuristic). */
function shiftToWednesday(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun, 3=Wed
  const delta = (3 - day + 7) % 7;
  return new Date(d.getTime() + delta * 86400000);
}

function toYmd(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Build candidate departure dates across the 6-month window. */
function buildDepartureDates(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (const monthOffset of SEARCH_MONTH_OFFSETS) {
    if (monthOffset >= SEARCH_WINDOW_MONTHS) continue;
    const d = new Date(now.getTime());
    d.setUTCMonth(d.getUTCMonth() + monthOffset);
    d.setUTCDate(10); // ~mid-month to avoid first/last-day pricing weirdness
    out.push(toYmd(shiftToWednesday(d)));
  }
  return out;
}

/** Pick trip-length candidates based on classified one-way flight duration (minutes). */
function pickTripLengths(oneWayMinutes: number): number[] {
  const hours = oneWayMinutes / 60;
  const bucket = TRIP_LENGTH_BUCKETS.find((b) => hours < b.maxFlightHours)
    ?? TRIP_LENGTH_BUCKETS[TRIP_LENGTH_BUCKETS.length - 1];
  return bucket.nights.slice(0, TRIP_LENGTHS_PER_ROUTE);
}

/** Compute one-way flight time (minutes) from the outbound slice of an offer. */
function outboundOneWayMinutes(slice: OfferSlice | undefined): number | null {
  if (!slice) return null;
  const fromIso = parseIsoDurationToMinutes(slice.duration);
  if (fromIso != null) return fromIso;
  const segs = slice.segments ?? [];
  if (segs.length === 0) return null;
  const firstDep = new Date(segs[0].departing_at);
  const lastArr = new Date(segs[segs.length - 1].arriving_at);
  if (isNaN(firstDep.getTime()) || isNaN(lastArr.getTime())) return null;
  return Math.round((lastArr.getTime() - firstDep.getTime()) / 60000);
}

/** Sum of flight time (minutes) across both slices of a roundtrip offer. */
function roundtripFlightMinutes(slices: OfferSlice[] | undefined): number | null {
  if (!slices || slices.length === 0) return null;
  let total = 0;
  for (const s of slices) {
    const m = outboundOneWayMinutes(s);
    if (m == null) return null;
    total += m;
  }
  return total;
}

/** Max layover across any slice of the offer. */
function maxLayoverMinutesAcrossOffer(slices: OfferSlice[] | undefined): number {
  if (!slices) return 0;
  let worst = 0;
  for (const s of slices) {
    const segs: OfferSliceSegment[] = s.segments ?? [];
    for (let i = 1; i < segs.length; i++) {
      const prevArr = new Date(segs[i - 1].arriving_at);
      const nextDep = new Date(segs[i].departing_at);
      const layover = Math.round((nextDep.getTime() - prevArr.getTime()) / 60000);
      if (layover > worst) worst = layover;
    }
  }
  return worst;
}

// Per-invocation cache: route -> one-way minutes from probe (reused across calls within a batch).
const routeProbeCache = new Map<string, number>();

// compactOfferJson is now imported from shared duffelMapper

// ─── Refresh a batch of destinations for one origin via Duffel ───────

interface BatchResult {
  origin: string;
  fetched: number;
  total: number;
  sources: Record<string, number>;
}

/** Pull the cheapest offer from a single (origin, dest, dep, ret) search, with filters applied. */
async function searchCheapestOffer(
  origin: string,
  dest: string,
  departureDate: string,
  returnDate: string,
  label: string,
): Promise<
  | {
      offer: ReturnType<typeof sortOffersByPrice>[number];
      price: number;
      roundtripFlightMin: number;
      maxLayoverMin: number;
    }
  | null
> {
  try {
    const result = await withRetry(
      () =>
        searchFlights({
          origin,
          destination: dest,
          departureDate,
          returnDate,
          passengers: [{ type: 'adult' }],
          cabinClass: 'economy',
        }),
      { maxRetries: 2, baseDelayMs: 1000, label },
    );
    const offers = getOffersFromResult(result as OfferRequest);
    if (offers.length === 0) return null;
    const sorted = sortOffersByPrice(offers);

    // Walk cheapest → most expensive until one passes sanity filters.
    for (const offer of sorted) {
      const roundtripFlightMin = roundtripFlightMinutes(offer.slices);
      if (roundtripFlightMin == null || roundtripFlightMin <= 0) continue;

      const maxLayoverMin = maxLayoverMinutesAcrossOffer(offer.slices);
      if (maxLayoverMin > MAX_LAYOVER_HOURS * 60) continue;

      // time_at_destination = (return_departure - outbound_arrival). Use segment timestamps.
      const outbound = offer.slices?.[0];
      const inbound = offer.slices?.[1];
      if (!outbound || !inbound) continue;
      const outSegs = outbound.segments ?? [];
      const inSegs = inbound.segments ?? [];
      if (outSegs.length === 0 || inSegs.length === 0) continue;
      const destArrival = new Date(outSegs[outSegs.length - 1].arriving_at);
      const destDeparture = new Date(inSegs[0].departing_at);
      const destMin = Math.round((destDeparture.getTime() - destArrival.getTime()) / 60000);
      if (destMin < MIN_DEST_TIME_RATIO * roundtripFlightMin) continue;

      const price = Math.round(parseFloat(offer.total_amount));
      return { offer, price, roundtripFlightMin, maxLayoverMin };
    }
    return null;
  } catch (err) {
    console.warn(`[refresh] Duffel search failed (${label}):`, err);
    return null;
  }
}

async function refreshOneDest(
  origin: string,
  dest: string,
  currentPriceMap: Map<string, { price: number; docId: string }>,
): Promise<{ source: 'duffel' | null }> {
  // ── Step 1: Probe search to classify route (one-way flight duration) ──────
  const probeDeparture = shiftToWednesday(new Date(Date.now() + 28 * 86400000));
  const probeReturn = new Date(probeDeparture.getTime() + 7 * 86400000);
  const probeDepYmd = toYmd(probeDeparture);
  const probeRetYmd = toYmd(probeReturn);

  let oneWayMin = routeProbeCache.get(`${origin}-${dest}`);
  if (oneWayMin == null) {
    try {
      const result = await withRetry(
        () =>
          searchFlights({
            origin,
            destination: dest,
            departureDate: probeDepYmd,
            returnDate: probeRetYmd,
            passengers: [{ type: 'adult' }],
            cabinClass: 'economy',
          }),
        { maxRetries: 2, baseDelayMs: 1000, label: `duffel-probe:${origin}->${dest}` },
      );
      const offers = getOffersFromResult(result as OfferRequest);
      if (offers.length > 0) {
        const sorted = sortOffersByPrice(offers);
        const m = outboundOneWayMinutes(sorted[0].slices?.[0]);
        if (m && m > 0) {
          oneWayMin = m;
          routeProbeCache.set(`${origin}-${dest}`, m);
        }
      }
    } catch (err) {
      console.warn(`[refresh] Probe search failed for ${origin}->${dest}:`, err);
    }
  }

  if (oneWayMin == null) {
    // Probe failed entirely — no offers on this route at all.
    return { source: null };
  }

  // ── Step 2: Narrow search — N departure months × K trip lengths ───────────
  const tripLengths = pickTripLengths(oneWayMin);
  const departureDates = buildDepartureDates();

  type Winner = Awaited<ReturnType<typeof searchCheapestOffer>>;
  let best: Winner = null;

  for (const dep of departureDates) {
    for (const nights of tripLengths) {
      const depDate = new Date(`${dep}T00:00:00Z`);
      const retDate = new Date(depDate.getTime() + nights * 86400000);
      const candidate = await searchCheapestOffer(
        origin,
        dest,
        dep,
        toYmd(retDate),
        `duffel:${origin}->${dest}:${dep}+${nights}n`,
      );
      if (candidate && (!best || candidate.price < best.price)) {
        best = candidate;
      }
    }
  }

  if (!best) return { source: null };

  const cheapest = best.offer;
  const price = best.price;
  const offerExpiresAt = cheapest.expires_at || '';
  let airline = '';
  let depDate = '';
  let retDate = '';

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

  let offerJson = sharedCompactOfferJson(cheapest);
  if (offerJson.length > 10000) {
    offerJson = offerJson.slice(0, 10000);
  }

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
    departureDate: depDate,
    returnDate: retDate,
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
  updateRouteStats(origin, dest, price).catch((err) =>
    console.warn(`[refresh] updateRouteStats failed for ${origin}->${dest}:`, err),
  );

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
  let fetched = 0;

  // Duffel searches for the stalest destinations
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((dest) => refreshOneDest(origin, dest, currentPriceMap)),
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
  } catch (err) {
    console.warn(`[refresh] Failed to fetch existing prices for ${origin}:`, err);
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
  } catch (err) {
    console.warn(`[refresh] Failed to fetch staleness data for ${origin}:`, err);
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
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'CRON_SECRET not configured');
  }
  const authHeader = req.headers.authorization;
  const provided = authHeader?.replace('Bearer ', '') || '';
  if (provided !== cronSecret) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
  }

  const v = validateRequest(pricesQuerySchema, req.query);
  if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);
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
      console.info(`[refresh] Duffel batch for ${org}: ${batch.length} destinations`);

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
    return sendError(res, 500, 'INTERNAL_ERROR', 'Price refresh failed', { detail: message });
  }
}
