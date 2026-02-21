import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';
import { ID } from 'node-appwrite';
import { fetchCityDirections, fetchCheapPrices } from '../../services/travelpayouts';
import { pricesQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';

// Hobby plan allows up to 60s for serverless functions
export const maxDuration = 60;

const AMADEUS_KEY = process.env.AMADEUS_API_KEY || '';
const AMADEUS_SECRET = process.env.AMADEUS_API_SECRET || '';
const AMADEUS_BASE = 'https://test.api.amadeus.com';

// ─── Amadeus Auth ─────────────────────────────────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${AMADEUS_KEY}&client_secret=${AMADEUS_SECRET}`,
  });
  if (!res.ok) throw new Error(`Amadeus auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

// ─── Amadeus Fallback ─────────────────────────────────────────────────

interface PriceResult {
  destination: string;
  price: number;
  currency: string;
  airline: string;
  source: 'travelpayouts' | 'amadeus' | 'estimate';
  departureDate?: string;
  returnDate?: string;
}

async function fetchAmadeusPrice(
  token: string,
  origin: string,
  dest: string,
  date: string,
): Promise<PriceResult | null> {
  try {
    const res = await fetch(
      `${AMADEUS_BASE}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${dest}&departureDate=${date}&adults=1&max=1&currencyCode=USD`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const offers = data.data as Array<Record<string, unknown>> | undefined;
    const offer = offers?.[0];
    if (!offer) return null;

    const priceObj = offer.price as Record<string, string>;
    return {
      destination: dest,
      price: Math.round(parseFloat(priceObj.grandTotal)),
      currency: priceObj.currency || 'USD',
      airline: '',
      source: 'amadeus',
    };
  } catch {
    return null;
  }
}

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

  // Check which origin was refreshed longest ago
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

// ─── Refresh prices for a single origin ──────────────────────────────

async function refreshOrigin(
  origin: string,
  allIatas: string[],
): Promise<{ origin: string; fetched: number; total: number; sources: Record<string, number> }> {
  const sourceCounts: Record<string, number> = { travelpayouts: 0, amadeus: 0 };

  // Step 1: Primary — Travelpayouts city-directions (bulk prices in one call)
  const tpPrices = await fetchCityDirections(origin);
  console.log(`[refresh] Travelpayouts city-directions returned ${tpPrices.size} prices for ${origin}`);

  const allResults = new Map<string, PriceResult>();
  for (const iata of allIatas) {
    const tp = tpPrices.get(iata);
    if (tp) {
      allResults.set(iata, {
        destination: iata,
        price: tp.price,
        currency: 'USD',
        airline: tp.airline,
        source: 'travelpayouts',
        departureDate: tp.departureAt || undefined,
        returnDate: tp.returnAt || undefined,
      });
      sourceCounts.travelpayouts++;
    }
  }

  // Step 2: Fill gaps — Travelpayouts cheap-prices for individual routes
  const missingAfterTP = allIatas.filter((iata) => !allResults.has(iata));
  if (missingAfterTP.length > 0) {
    console.log(`[refresh] Fetching ${missingAfterTP.length} individual Travelpayouts prices for ${origin}...`);
    for (let i = 0; i < missingAfterTP.length; i += 5) {
      const batch = missingAfterTP.slice(i, i + 5);
      const promises = batch.map((dest) => fetchCheapPrices(origin, dest));
      const results = await Promise.all(promises);
      for (const r of results) {
        if (r) {
          allResults.set(r.destination, {
            destination: r.destination,
            price: r.price,
            currency: 'USD',
            airline: r.airline,
            source: 'travelpayouts',
            departureDate: r.departureAt || undefined,
            returnDate: r.returnAt || undefined,
          });
          sourceCounts.travelpayouts++;
        }
      }
    }
  }

  // Step 3: Final fallback — Amadeus for any still-missing destinations
  const missingAfterAll = allIatas.filter((iata) => !allResults.has(iata));
  if (missingAfterAll.length > 0 && AMADEUS_KEY && AMADEUS_SECRET) {
    console.log(`[refresh] Fetching ${missingAfterAll.length} Amadeus fallback prices for ${origin}...`);
    try {
      const amadeusToken = await getAmadeusToken();
      const date = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      for (let i = 0; i < missingAfterAll.length; i += 3) {
        const batch = missingAfterAll.slice(i, i + 3);
        const promises = batch.map((dest) => fetchAmadeusPrice(amadeusToken, origin, dest, date));
        const results = await Promise.all(promises);
        for (const r of results) {
          if (r) {
            allResults.set(r.destination, r);
            sourceCounts.amadeus++;
          }
        }
        if (i + 3 < missingAfterAll.length) await new Promise((r) => setTimeout(r, 250));
      }
    } catch (err) {
      console.warn('[refresh] Amadeus fallback failed:', err);
    }
  }

  console.log(`[refresh] Total prices for ${origin}: ${allResults.size}/${allIatas.length} (TP: ${sourceCounts.travelpayouts}, Amadeus: ${sourceCounts.amadeus})`);

  // Step 4: Query current prices for price history tracking
  const currentPriceMap = new Map<string, { price: number; docId: string }>();
  try {
    const currentResult = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
      Query.equal('origin', origin),
      Query.limit(500),
    ]);
    for (const cp of currentResult.documents) {
      currentPriceMap.set(cp.destination_iata as string, {
        price: cp.price as number,
        docId: cp.$id,
      });
    }
  } catch {
    // No existing prices
  }

  // Step 5: Upsert into cached_prices with dates + price history
  const PRICE_CHANGE_THRESHOLD = 0.05; // 5% threshold for up/down
  for (const p of allResults.values()) {
    const existing = currentPriceMap.get(p.destination);
    let priceDirection: 'up' | 'down' | 'stable' = 'stable';
    const prevPrice = existing?.price;
    if (prevPrice != null && prevPrice > 0) {
      const pctChange = (p.price - prevPrice) / prevPrice;
      if (pctChange > PRICE_CHANGE_THRESHOLD) priceDirection = 'up';
      else if (pctChange < -PRICE_CHANGE_THRESHOLD) priceDirection = 'down';
    }

    let tripDurationDays: number | null = null;
    if (p.departureDate && p.returnDate) {
      const dep = new Date(p.departureDate);
      const ret = new Date(p.returnDate);
      if (!isNaN(dep.getTime()) && !isNaN(ret.getTime())) {
        tripDurationDays = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const data: Record<string, unknown> = {
      origin,
      destination_iata: p.destination,
      price: p.price,
      currency: p.currency,
      airline: p.airline,
      source: p.source,
      fetched_at: new Date().toISOString(),
      departure_date: p.departureDate ? p.departureDate.split('T')[0] : '',
      return_date: p.returnDate ? p.returnDate.split('T')[0] : '',
      trip_duration_days: tripDurationDays ?? 0,
      previous_price: prevPrice ?? 0,
      price_direction: priceDirection,
    };

    try {
      if (existing) {
        await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.cachedPrices, existing.docId, data);
      } else {
        await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.cachedPrices, ID.unique(), data);
      }
    } catch (err) {
      console.error(`[refresh] Upsert error for ${origin}->${p.destination}:`, err);
    }
  }

  return { origin, fetched: allResults.size, total: allIatas.length, sources: sourceCounts };
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authorization: Vercel cron sends CRON_SECRET, manual calls need Authorization header
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret) {
    const provided = authHeader?.replace('Bearer ', '') || '';
    if (provided !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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

    const allIatas = destResult.documents.map((d) => d.iata_code as string);

    // Determine which origin(s) to refresh
    let origins: string[];
    if (originParam && originParam !== 'ALL') {
      origins = [originParam];
    } else {
      origins = await pickNextOrigins(3);
      console.log(`[refresh] Round-robin selected origins: ${origins.join(', ')}`);
    }

    console.log(`[refresh] Refreshing ${origins.length} origin(s): ${origins.join(', ')}`);

    const startTime = Date.now();
    const TIME_BUDGET_MS = 45_000;
    const results = [];
    for (const org of origins) {
      if (results.length > 0 && Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(`[refresh] Time budget exceeded (${Date.now() - startTime}ms), stopping after ${results.length} origin(s)`);
        break;
      }
      const result = await refreshOrigin(org, allIatas);
      results.push(result);
    }

    return res.status(200).json({
      origins: results,
      totalOrigins: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logApiError('api/prices/refresh', err);
    return res.status(500).json({ error: 'Price refresh failed', detail: message });
  }
}
