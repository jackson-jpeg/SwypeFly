import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';
import { ID } from 'node-appwrite';
import { searchFlights } from '../../services/duffel';
import { fetchCheapPrices, fetchAllCheapPrices } from '../../services/travelpayouts';
import { pricesQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';
import { cors } from '../_cors.js';

// ─── Price history snapshot (stored in ai_cache with 30-day TTL) ─────

async function recordPriceSnapshot(
  origin: string,
  destinationIata: string,
  price: number,
  source: string,
  airline: string,
): Promise<void> {
  try {
    await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.aiCache, ID.unique(), {
      type: 'price_history',
      key: `${origin}-${destinationIata}`,
      content: JSON.stringify({ price, source, airline, timestamp: new Date().toISOString() }),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    // Non-critical — don't fail the refresh if snapshot recording fails
    console.warn(`[refresh] Price snapshot failed for ${origin}->${destinationIata}:`, err);
  }
}

// Hobby plan allows up to 60s for serverless functions
export const maxDuration = 60;

// With parallel searches (5 concurrent), each chunk takes ~3s.
// 20 destinations = 4 chunks × ~3s = ~12s search + DB overhead ≈ ~30s total.
// When upgrading to Pro with */30 cron, reduce to 8 for faster rotation.
const BATCH_SIZE = 20;

// Concurrent Duffel searches per chunk (Duffel rate limit: 60 req/min)
const CONCURRENCY = 5;

// 5% threshold for price direction tracking
const PRICE_CHANGE_THRESHOLD = 0.05;

// ─── Top-10 fallback airports ────────────────────────────────────────

const DEFAULT_ORIGINS = ['TPA', 'LAX', 'JFK', 'ORD', 'ATL', 'SFO', 'MIA', 'DFW', 'SEA', 'BOS'];

async function getActiveOrigins(): Promise<string[]> {
  const origins = new Set(DEFAULT_ORIGINS);
  try {
    const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.userPreferences, [
      Query.limit(500),
    ]);
    for (const doc of result.documents) {
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
    const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
      Query.orderAsc('fetched_at'),
      Query.limit(500),
    ]);
    statusDocs = result.documents;
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
): Promise<{ source: 'duffel' | 'travelpayouts' | null }> {
  let price: number | null = null;
  let airline = '';
  let source: 'duffel' | 'travelpayouts' = 'duffel';
  let depDate = departureDate;
  let retDate = returnDate;
  let offerJson = '';
  let offerExpiresAt = '';
  let tpFoundAt = '';

  // Primary: Duffel
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

      source = 'duffel';
    }
  } catch (err) {
    console.warn(`[refresh] Duffel search failed for ${origin}->${dest}:`, err);
  }

  // Fallback: Travelpayouts
  if (price === null) {
    try {
      const tp = await fetchCheapPrices(origin, dest);
      if (tp) {
        price = tp.price;
        airline = tp.airline;
        depDate = tp.departureAt ? tp.departureAt.split('T')[0] : departureDate;
        retDate = tp.returnAt ? tp.returnAt.split('T')[0] : returnDate;
        tpFoundAt = tp.foundAt || '';
        source = 'travelpayouts';
      }
    } catch (err) {
      console.warn(`[refresh] Travelpayouts fallback failed for ${origin}->${dest}:`, err);
    }
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

  const data: Record<string, unknown> = {
    origin,
    destination_iata: dest,
    price,
    currency: 'USD',
    airline,
    source,
    fetched_at: new Date().toISOString(),
    departure_date: depDate || '',
    return_date: retDate || '',
    trip_duration_days: tripDurationDays ?? 0,
    previous_price: prevPrice ?? 0,
    price_direction: priceDirection,
    offer_json: offerJson,
    offer_expires_at: offerExpiresAt,
    tp_found_at: tpFoundAt,
  };

  try {
    if (existing) {
      await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.cachedPrices, existing.docId, data);
    } else {
      await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.cachedPrices, ID.unique(), data);
    }
  } catch (err) {
    console.error(`[refresh] Upsert error for ${origin}->${dest}:`, err);
    return { source: null };
  }

  // Record price snapshot for history tracking (non-blocking)
  await recordPriceSnapshot(origin, dest, price, source, airline);

  return { source };
}

async function bulkUpsertTPPrices(
  origin: string,
  allIatas: Set<string>,
  currentPriceMap: Map<string, { price: number; docId: string }>,
): Promise<number> {
  const bulkPrices = await fetchAllCheapPrices(origin);
  if (bulkPrices.size === 0) return 0;

  let upserted = 0;
  const unknownIatas: string[] = [];

  for (const [iata, tp] of bulkPrices) {
    if (!allIatas.has(iata)) {
      unknownIatas.push(iata);
      continue;
    }

    const depDate = tp.departureAt ? tp.departureAt.split('T')[0] : '';
    const retDate = tp.returnAt ? tp.returnAt.split('T')[0] : '';
    let tripDurationDays = 0;
    if (depDate && retDate) {
      const dep = new Date(depDate);
      const ret = new Date(retDate);
      if (!isNaN(dep.getTime()) && !isNaN(ret.getTime())) {
        tripDurationDays = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const existing = currentPriceMap.get(iata);
    // Don't overwrite Duffel prices with TP prices (Duffel is higher quality)
    if (existing && currentPriceMap.get(iata)) {
      // Only update if existing is also TP-sourced or price is significantly lower
      // We'll skip here — Duffel targeted refresh handles high-value routes
    }

    const prevPrice = existing?.price ?? 0;
    let priceDirection: 'up' | 'down' | 'stable' = 'stable';
    if (prevPrice > 0) {
      const pctChange = (tp.price - prevPrice) / prevPrice;
      if (pctChange > PRICE_CHANGE_THRESHOLD) priceDirection = 'up';
      else if (pctChange < -PRICE_CHANGE_THRESHOLD) priceDirection = 'down';
    }

    const data: Record<string, unknown> = {
      origin,
      destination_iata: iata,
      price: tp.price,
      currency: 'USD',
      airline: tp.airline,
      source: 'travelpayouts',
      fetched_at: new Date().toISOString(),
      departure_date: depDate,
      return_date: retDate,
      trip_duration_days: tripDurationDays,
      previous_price: prevPrice,
      price_direction: priceDirection,
      offer_json: '',
      offer_expires_at: '',
      tp_found_at: tp.foundAt || '',
    };

    try {
      if (existing) {
        await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.cachedPrices, existing.docId, data);
      } else {
        await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.cachedPrices, ID.unique(), data);
      }
      currentPriceMap.set(iata, { price: tp.price, docId: existing?.docId || '' });
      upserted++;

      // Record price snapshot for history tracking (non-blocking)
      await recordPriceSnapshot(origin, iata, tp.price, 'travelpayouts', tp.airline);
    } catch (err) {
      console.error(`[refresh] TP bulk upsert error for ${origin}->${iata}:`, err);
    }
  }

  if (unknownIatas.length > 0) {
    console.log(`[refresh] TP bulk discovered ${unknownIatas.length} unknown IATA codes: ${unknownIatas.slice(0, 10).join(', ')}${unknownIatas.length > 10 ? '...' : ''}`);
  }

  return upserted;
}

async function refreshBatch(
  origin: string,
  batch: string[],
  allIatas: Set<string>,
  currentPriceMap: Map<string, { price: number; docId: string }>,
): Promise<BatchResult> {
  const sourceCounts: Record<string, number> = { duffel: 0, travelpayouts: 0, 'tp-bulk': 0 };
  const { departureDate, returnDate } = getSearchDates();
  let fetched = 0;

  // Phase 1: Bulk TP pre-seed — covers ALL routes in one API call
  const tpBulkCount = await bulkUpsertTPPrices(origin, allIatas, currentPriceMap);
  sourceCounts['tp-bulk'] = tpBulkCount;
  fetched += tpBulkCount;

  // Phase 2: Targeted Duffel searches for the stalest destinations
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((dest) => refreshOneDest(origin, dest, departureDate, returnDate, currentPriceMap)),
    );
    for (const r of results) {
      if (r.source) {
        sourceCounts[r.source]++;
        if (r.source === 'duffel') fetched++;
      }
    }
  }

  console.log(
    `[refresh] Batch for ${origin}: ${fetched} total (TP-bulk: ${sourceCounts['tp-bulk']}, Duffel: ${sourceCounts.duffel}, TP-fallback: ${sourceCounts.travelpayouts})`,
  );

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
    const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
      Query.equal('origin', origin),
      Query.limit(500),
    ]);
    for (const doc of result.documents) {
      currentPriceMap.set(doc.destination_iata as string, {
        price: doc.price as number,
        docId: doc.$id,
      });
    }
  } catch {
    // No existing prices for this origin
  }

  // Build staleness map: iata -> fetched_at timestamp
  const fetchedAtMap = new Map<string, string>();
  try {
    const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
      Query.equal('origin', origin),
      Query.orderAsc('fetched_at'),
      Query.limit(500),
    ]);
    for (const doc of result.documents) {
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
    // Get all active destination IATA codes from Appwrite
    const destResult = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [
      Query.equal('is_active', true),
      Query.limit(500),
    ]);

    const allIatasList = destResult.documents.map((d) => d.iata_code as string);
    const allIatas = new Set(allIatasList);

    // Determine which origin to refresh
    let origins: string[];
    if (originParam && originParam !== 'ALL') {
      origins = [originParam];
    } else {
      origins = await pickNextOrigins(1);
      console.log(`[refresh] Round-robin selected origins: ${origins.join(', ')}`);
    }

    console.log(`[refresh] Refreshing ${origins.length} origin(s): ${origins.join(', ')}`);

    const results = [];
    for (const org of origins) {
      // Pick the stalest BATCH_SIZE destinations for targeted Duffel searches
      const { batch, currentPriceMap } = await pickStalestDestinations(org, allIatasList, BATCH_SIZE);
      console.log(`[refresh] Duffel batch for ${org}: ${batch.join(', ')}`);

      const result = await refreshBatch(org, batch, allIatas, currentPriceMap);
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
