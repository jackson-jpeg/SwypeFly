import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../../services/supabaseServer';
import { fetchAllCheapPrices, fetchLatestPrices, fetchByPriceRange } from '../../services/travelpayouts';
import { logApiError } from '../../utils/apiLogger';
import { withRetry } from '../../utils/retry';
import { evaluateDealQuality, US_AIRPORTS } from '../../utils/dealQuality';
import {
  getRouteStats,
  computePricePercentile,
  updateRouteStats,
  clearStatsCache,
} from '../../utils/priceStats';
import { env } from '../../utils/env';
import { sendError } from '../../utils/apiResponse';

export const maxDuration = 300;

// Travelpayouts returns city codes, our destinations use airport codes.
// Map TP city codes → our airport IATA codes so prices match feed destinations.
const CITY_TO_AIRPORT: Record<string, string> = {
  TYO: 'NRT', LON: 'LHR', PAR: 'CDG', ROM: 'FCO', BUE: 'EZE',
  REK: 'KEF', MOW: 'SVO', BKK: 'BKK', OSA: 'KIX', MIL: 'MXP',
  RIO: 'GIG', SAO: 'GRU', NYC: 'JFK', WAS: 'IAD', CHI: 'ORD',
  YTO: 'YYZ', YMQ: 'YUL', SEL: 'ICN', BER: 'TXL', STO: 'ARN',
  SPK: 'CTS', OKA: 'OKA', IZM: 'ADB', IST: 'IST', BJS: 'PEK',
  SHA: 'PVG', HKG: 'HKG', TPE: 'TPE', BOM: 'BOM', DEL: 'DEL',
  DXB: 'DXB', JKT: 'CGK', KUL: 'KUL', MNL: 'MNL', MEX: 'MEX',
  BOG: 'BOG', SCL: 'SCL', LIM: 'LIM', PTY: 'PTY',
};

// ─── Top-10 fallback airports ────────────────────────────────────────

const DEFAULT_ORIGINS = [
  'TPA',
  'LAX',
  'JFK',
  'ORD',
  'ATL',
  'SFO',
  'MIA',
  'DFW',
  'SEA',
  'BOS',
];

// ─── Helpers ─────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

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
    console.warn('[refresh-calendar] Failed to fetch user departure codes:', err);
  }
  return Array.from(origins);
}

async function pickNextOrigins(count: number): Promise<string[]> {
  const origins = await getActiveOrigins();

  let statusDocs: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await supabase
      .from(TABLES.priceCalendar)
      .select('origin, fetched_at')
      .order('fetched_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    statusDocs = data ?? [];
  } catch (err) {
    console.warn('[refresh-calendar] Failed to fetch calendar staleness data:', err);
  }

  const lastRefreshed = new Map<string, string>();
  for (const row of statusDocs) {
    const o = row.origin as string;
    const ts = row.fetched_at as string;
    if (!lastRefreshed.has(o) || ts > lastRefreshed.get(o)!) {
      lastRefreshed.set(o, ts);
    }
  }

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
    console.warn('[refresh-calendar] Failed to load destination metadata:', err);
  }
  return destMetaCache;
}

// ─── Upsert a single calendar entry ─────────────────────────────────

async function upsertCalendarEntry(
  origin: string,
  destIata: string,
  date: string,
  price: number,
  airline: string,
  source: string,
): Promise<string> {
  // ── Deal quality gate ──────────────────────────────────────────────
  const returnDate = addDays(date, 7);
  const meta = (await getDestMeta()).get(destIata);
  const isDomestic = US_AIRPORTS.has(origin) && US_AIRPORTS.has(destIata);

  // IMPORTANT: Update route stats FIRST so new routes immediately have
  // statistical context for percentile calculation, discovery scoring,
  // and flash deal detection. Without this, first-time routes get
  // usual_price=undefined and all discovery signals return 0.
  await updateRouteStats(origin, destIata, price).catch((err) =>
    console.warn(`[refresh-calendar] updateRouteStats failed for ${origin}->${destIata}:`, err),
  );

  // Now get stats (which include the price we just recorded)
  const stats = await getRouteStats(origin, destIata);
  const pricePercentile = computePricePercentile(price, stats);

  const dealResult = evaluateDealQuality({
    originIata: origin,
    destinationIata: destIata,
    price,
    departureDate: date,
    returnDate,
    isDomestic,
    destinationCountry: meta?.country,
    airline,
    pricePercentile,
    popularityScore: meta?.popularityScore,
    bestMonths: meta?.bestMonths,
    foundAt: new Date().toISOString(),
  });

  // Hard reject — don't store this price at all
  if (!dealResult.pass) {
    return `rejected:${dealResult.rejectReason}`;
  }

  // ── Price drop detection ────────────────────────────────────────────
  // Compare new price against previous stored price and usual price to
  // detect drops, compute direction, and flag flash deals.
  let previousPrice: number | undefined;
  let priceDirection: 'up' | 'down' | 'stable' = 'stable';
  let flashDeal = false;

  try {
    const { data: existing } = await supabase
      .from(TABLES.priceCalendar)
      .select('price')
      .eq('origin', origin)
      .eq('destination_iata', destIata)
      .order('fetched_at', { ascending: false })
      .limit(1);
    if (existing && existing.length > 0) {
      previousPrice = existing[0].price as number;
      if (previousPrice > 0) {
        const changePct = (previousPrice - price) / previousPrice;
        if (changePct > 0.05) priceDirection = 'down';
        else if (changePct < -0.05) priceDirection = 'up';
      }
    }
  } catch (err) {
    console.warn(`[refresh-calendar] Failed to fetch previous price for ${origin}->${destIata}:`, err);
  }

  // Flash deal: >30% below usual price AND found in last refresh
  const usualPrice = stats ? stats.medianPrice : undefined;
  if (usualPrice && usualPrice > 0 && price > 0) {
    const pctBelowUsual = (usualPrice - price) / usualPrice;
    if (pctBelowUsual > 0.30) flashDeal = true;
  }

  const data = {
    origin,
    destination_iata: destIata,
    date,
    price,
    return_date: returnDate,
    trip_days: 7,
    airline,
    source,
    fetched_at: new Date().toISOString(),
    // Deal quality fields
    deal_score: dealResult.dealScore,
    deal_tier: dealResult.dealTier,
    quality_score: dealResult.qualityScore,
    price_percentile: Math.round(pricePercentile),
    savings_percent: dealResult.savingsPercent > 0 ? dealResult.savingsPercent : undefined,
    usual_price: usualPrice ?? undefined,
    previous_price: previousPrice ?? undefined,
    price_direction: priceDirection,
    flash_deal: flashDeal,
    is_nonstop: false,  // Unknown for TP data
    total_stops: -1,    // -1 = unknown
    max_layover_minutes: -1,
    total_travel_minutes: -1,
  };

  try {
    const { error } = await supabase
      .from(TABLES.priceCalendar)
      .upsert(data, { onConflict: 'origin,destination_iata,date' });
    if (error) throw error;
    return flashDeal ? 'flash' : 'created';
  } catch (err) {
    return `err:${(err as Error).message?.slice(0, 80)}`;
  }
}

// ─── Refresh calendar for one origin ─────────────────────────────────

interface OriginResult {
  origin: string;
  bulkDestinations: number;
  calendarEntries: number;
  created: number;
  updated: number;
  errors: number;
  rejected: number;
  firstError?: string;
}

async function refreshOrigin(origin: string): Promise<OriginResult> {
  const result: OriginResult = {
    origin,
    bulkDestinations: 0,
    calendarEntries: 0,
    created: 0,
    updated: 0,
    errors: 0,
    rejected: 0,
  };

  // Step 1: Get prices from multiple Travelpayouts endpoints in parallel
  const [bulkPrices, latestPrices, budgetDeals] = await Promise.all([
    withRetry(() => fetchAllCheapPrices(origin), {
      maxRetries: 2,
      baseDelayMs: 1000,
      label: `tp-bulk:${origin}`,
    }),
    withRetry(() => fetchLatestPrices(origin), {
      maxRetries: 2,
      baseDelayMs: 1000,
      label: `tp-latest:${origin}`,
    }).catch((err) => {
      console.warn(`[refresh-calendar] fetchLatestPrices failed for ${origin}:`, err);
      return new Map() as Awaited<ReturnType<typeof fetchLatestPrices>>;
    }),
    withRetry(() => fetchByPriceRange(origin, 1, 350), {
      maxRetries: 2,
      baseDelayMs: 1000,
      label: `tp-budget:${origin}`,
    }).catch((err) => {
      console.warn(`[refresh-calendar] fetchByPriceRange failed for ${origin}:`, err);
      return [] as Awaited<ReturnType<typeof fetchByPriceRange>>;
    }),
  ]);

  // Merge: bulk is primary, supplement with latest 48h prices and budget discoveries
  for (const [dest, info] of latestPrices) {
    if (!bulkPrices.has(dest) || info.price < (bulkPrices.get(dest)?.price ?? Infinity)) {
      bulkPrices.set(dest, {
        destination: dest,
        price: info.price,
        airline: info.airline,
        departureAt: '',
        returnAt: '',
        foundAt: new Date().toISOString(),
      });
    }
  }
  for (const deal of budgetDeals) {
    const dest = deal.destination;
    if (!bulkPrices.has(dest) || deal.price < (bulkPrices.get(dest)?.price ?? Infinity)) {
      bulkPrices.set(dest, {
        destination: dest,
        price: deal.price,
        airline: deal.airline,
        departureAt: deal.departureDate,
        returnAt: deal.returnDate,
        foundAt: new Date().toISOString(),
      });
    }
  }

  result.bulkDestinations = bulkPrices.size;
  console.info(
    `[refresh-calendar] ${origin}: ${bulkPrices.size} destinations (bulk + latest + budget)`,
  );

  if (bulkPrices.size === 0) return result;

  // Upsert bulk prices — one entry per destination with their cheapest price + dates
  // These are the prices that show on feed cards
  const today = new Date().toISOString().split('T')[0];

  // Get our destination IATA codes so we can prioritize matching routes
  let ourDestCodes = new Set<string>();
  try {
    const { data, error } = await supabase
      .from(TABLES.destinations)
      .select('iata_code')
      .eq('is_active', true)
      .limit(500);
    if (error) throw error;
    ourDestCodes = new Set((data ?? []).map((d) => d.iata_code as string));
  } catch (err) {
    console.warn('[refresh-calendar] Failed to fetch destination IATA codes:', err);
  }

  const allBulkEntries = Array.from(bulkPrices.entries())
    .map(([code, info]) => {
      const mappedCode = CITY_TO_AIRPORT[code] || code;
      return [mappedCode, info] as [string, typeof info];
    })
    .filter(([, info]) => {
      const dep = info.departureAt?.split('T')[0];
      return dep && dep >= today;
    });

  // Sort: our destinations first, then by price ascending
  allBulkEntries.sort((a, b) => {
    const aInOurs = ourDestCodes.has(a[0]) ? 0 : 1;
    const bInOurs = ourDestCodes.has(b[0]) ? 0 : 1;
    if (aInOurs !== bInOurs) return aInOurs - bInOurs;
    return a[1].price - b[1].price;
  });

  const bulkEntries = allBulkEntries.slice(0, 200);

  // Process in parallel chunks of 10
  const UPSERT_CONCURRENCY = 10;
  for (let i = 0; i < bulkEntries.length; i += UPSERT_CONCURRENCY) {
    const chunk = bulkEntries.slice(i, i + UPSERT_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(([destIata, info]) =>
        upsertCalendarEntry(
          origin,
          destIata,
          info.departureAt.split('T')[0],
          info.price,
          info.airline,
          'travelpayouts',
        ),
      ),
    );
    for (const status of results) {
      result.calendarEntries++;
      if (typeof status === 'string' && status.startsWith('rejected:')) {
        result.rejected++;
      } else if (typeof status === 'string' && status.startsWith('err:')) {
        result.errors++;
        if (!result.firstError) result.firstError = status;
      } else if (status === 'created') result.created++;
      else if (status === 'updated') result.updated++;
      else result.errors++;
    }
  }

  console.info(
    `[refresh-calendar] ${origin}: ${result.calendarEntries} entries (${result.created} created, ${result.updated} updated, ${result.errors} errors)`,
  );

  return result;
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify CRON_SECRET
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'CRON_SECRET not configured');
  }
  const authHeader = req.headers.authorization;
  const provided = authHeader?.replace('Bearer ', '') || '';
  if (provided !== cronSecret) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
  }

  const originParam =
    typeof req.query.origin === 'string' ? req.query.origin : '';

  try {
    // Clear caches for fresh cron run
    clearStatsCache();
    destMetaCache = null;

    let origins: string[];
    if (originParam) {
      origins = [originParam];
    } else {
      origins = await pickNextOrigins(2);
      console.info(
        `[refresh-calendar] Round-robin selected origins: ${origins.join(', ')}`,
      );
    }

    console.info(
      `[refresh-calendar] Refreshing ${origins.length} origin(s): ${origins.join(', ')}`,
    );

    const results: OriginResult[] = [];
    for (const org of origins) {
      const result = await refreshOrigin(org);
      results.push(result);
    }

    return res.status(200).json({
      origins: results,
      totalOrigins: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logApiError('api/prices/refresh-calendar', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Price calendar refresh failed', { detail: message });
  }
}
