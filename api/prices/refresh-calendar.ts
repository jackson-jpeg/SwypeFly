import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  serverDatabases,
  DATABASE_ID,
  COLLECTIONS,
  Query,
} from '../../services/appwriteServer';
import { ID } from 'node-appwrite';
import { fetchAllCheapPrices, fetchPriceCalendar } from '../../services/travelpayouts';
import { logApiError } from '../../utils/apiLogger';

export const maxDuration = 300;

// Max destinations per run — keeps execution within timeout
const MAX_DESTINATIONS = 15;

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

// Concurrent calendar API calls per chunk (TP rate: 60 req/min → ~10 req/sec safe)
const CONCURRENCY = 5;

// Delay between batches to respect Travelpayouts rate limits
const DELAY_BETWEEN_BATCHES = 1200;

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
    const result = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.userPreferences,
      [Query.limit(500)],
    );
    for (const doc of result.documents) {
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
    const result = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.priceCalendar,
      [Query.orderAsc('fetched_at'), Query.limit(500)],
    );
    statusDocs = result.documents;
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

// ─── Upsert a single calendar entry ─────────────────────────────────

async function upsertCalendarEntry(
  origin: string,
  destIata: string,
  date: string,
  price: number,
  airline: string,
  source: string,
): Promise<string> {
  const data = {
    origin,
    destination_iata: destIata,
    date,
    price,
    return_date: addDays(date, 7),
    trip_days: 7,
    airline,
    source,
    fetched_at: new Date().toISOString(),
  };

  try {
    // Try create first (faster path for new entries)
    await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.priceCalendar,
      ID.unique(),
      data,
    );
    return 'created';
  } catch (createErr) {
    // If duplicate, find and update
    try {
      const existing = await serverDatabases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.priceCalendar,
        [
          Query.equal('origin', origin),
          Query.equal('destination_iata', destIata),
          Query.equal('date', date),
          Query.limit(1),
        ],
      );
      if (existing.documents.length > 0) {
        await serverDatabases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.priceCalendar,
          existing.documents[0].$id,
          data,
        );
        return 'updated';
      }
      return `err:create=${(createErr as Error).message?.slice(0, 80)}`;
    } catch (err) {
      return `err:${(err as Error).message?.slice(0, 80)}|create=${(createErr as Error).message?.slice(0, 40)}`;
    }
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
  };

  // Step 1: Get bulk cheap prices for all destinations from this origin
  const bulkPrices = await fetchAllCheapPrices(origin);
  result.bulkDestinations = bulkPrices.size;
  console.log(
    `[refresh-calendar] ${origin}: ${bulkPrices.size} destinations from bulk prices`,
  );

  if (bulkPrices.size === 0) return result;

  // Upsert bulk prices — one entry per destination with their cheapest price + dates
  // These are the prices that show on feed cards
  const today = new Date().toISOString().split('T')[0];

  // Get our destination IATA codes so we can prioritize matching routes
  let ourDestCodes = new Set<string>();
  try {
    const destResult = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.destinations,
      [Query.equal('is_active', true), Query.limit(500)],
    );
    ourDestCodes = new Set(destResult.documents.map((d) => d.iata_code as string));
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
      if (typeof status === 'string' && status.startsWith('err:')) {
        result.errors++;
        if (!result.firstError) result.firstError = status;
      } else if (status === 'created') result.created++;
      else if (status === 'updated') result.updated++;
      else result.errors++;
    }
  }

  console.log(
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
    let origins: string[];
    if (originParam) {
      origins = [originParam];
    } else {
      origins = await pickNextOrigins(2);
      console.log(
        `[refresh-calendar] Round-robin selected origins: ${origins.join(', ')}`,
      );
    }

    console.log(
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
