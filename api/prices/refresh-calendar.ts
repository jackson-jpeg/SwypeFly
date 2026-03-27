import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../../services/supabaseServer';
import { fetchAllCheapPrices } from '../../services/travelpayouts';
import { logApiError } from '../../utils/apiLogger';
import { evaluateDealQuality, US_AIRPORTS } from '../../utils/dealQuality';
import {
  getRouteStats,
  computePricePercentile,
  updateRouteStats,
  clearStatsCache,
} from '../../utils/priceStats';

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
  } catch {
    // user_preferences may not have data yet
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
  } catch {
    // No calendar data yet
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
  } catch {
    // Non-fatal
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

  // Get price stats for percentile calculation
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

  // Update route stats with this price observation (non-blocking)
  updateRouteStats(origin, destIata, price).catch(() => {});

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
    return 'created';
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

  // Step 1: Get bulk cheap prices for all destinations from this origin
  const bulkPrices = await fetchAllCheapPrices(origin);
  result.bulkDestinations = bulkPrices.size;
  console.info(
    `[refresh-calendar] ${origin}: ${bulkPrices.size} destinations from bulk prices`,
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
  } catch {
    // Non-fatal — just won't prioritize
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
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' });
  }
  const authHeader = req.headers.authorization;
  const provided = authHeader?.replace('Bearer ', '') || '';
  if (provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
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
    return res.status(500).json({
      error: 'Price calendar refresh failed',
      detail: message,
    });
  }
}
