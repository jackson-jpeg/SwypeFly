import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { fetchCityDirections, fetchCheapPrices } from '../../services/travelpayouts';
import { pricesQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';

// Hobby plan allows up to 60s for serverless functions
export const maxDuration = 60;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

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
    const { data } = await supabase
      .from('user_preferences')
      .select('departure_code');
    if (data) {
      for (const row of data) {
        if (row.departure_code) origins.add(row.departure_code);
      }
    }
  } catch {
    // user_preferences table may not exist yet
  }
  return Array.from(origins);
}

// ─── Round-robin: pick the origin refreshed longest ago ──────────────

async function pickNextOrigin(): Promise<string> {
  const origins = await getActiveOrigins();

  // Check which origin was refreshed longest ago
  const { data: statusRows } = await supabase
    .from('cached_prices')
    .select('origin, fetched_at')
    .order('fetched_at', { ascending: true });

  const lastRefreshed = new Map<string, string>();
  if (statusRows) {
    for (const row of statusRows) {
      // Track the most recent fetch per origin
      if (!lastRefreshed.has(row.origin) || row.fetched_at > lastRefreshed.get(row.origin)!) {
        lastRefreshed.set(row.origin, row.fetched_at);
      }
    }
  }

  // Find origin that was refreshed longest ago (or never refreshed)
  let oldest: string = origins[0];
  let oldestTime = Infinity;
  for (const org of origins) {
    const ts = lastRefreshed.get(org);
    if (!ts) return org; // never refreshed — do this one
    const t = new Date(ts).getTime();
    if (t < oldestTime) {
      oldestTime = t;
      oldest = org;
    }
  }
  return oldest;
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

  // Step 4: Upsert into cached_prices
  const rows = Array.from(allResults.values()).map((p) => ({
    origin,
    destination_iata: p.destination,
    price: p.price,
    currency: p.currency,
    airline: p.airline,
    source: p.source,
    fetched_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('cached_prices')
      .upsert(rows, { onConflict: 'origin,destination_iata' });

    if (upsertErr) {
      console.error(`[refresh] Upsert error for ${origin}:`, upsertErr.message);
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
    // Get all active destination IATA codes from Supabase
    const { data: destinations, error: dbErr } = await supabase
      .from('destinations')
      .select('iata_code')
      .eq('is_active', true);

    if (dbErr || !destinations) {
      return res.status(500).json({ error: 'Failed to fetch destinations from DB' });
    }

    const allIatas = destinations.map((d) => d.iata_code as string);

    // Determine which origin(s) to refresh
    let origins: string[];
    if (originParam && originParam !== 'ALL') {
      // Specific origin requested — refresh just that one
      origins = [originParam];
    } else {
      // No param or ALL: round-robin — refresh ONE origin (the stalest)
      const next = await pickNextOrigin();
      origins = [next];
      console.log(`[refresh] Round-robin selected origin: ${next}`);
    }

    console.log(`[refresh] Refreshing ${origins.length} origin(s): ${origins.join(', ')}`);

    const results = [];
    for (const org of origins) {
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
