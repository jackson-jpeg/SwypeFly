import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Hobby plan allows up to 60s for serverless functions
export const maxDuration = 60;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const AMADEUS_KEY = process.env.AMADEUS_API_KEY || '';
const AMADEUS_SECRET = process.env.AMADEUS_API_SECRET || '';
const AMADEUS_BASE = 'https://test.api.amadeus.com';

// ─── Auth ────────────────────────────────────────────────────────────

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

// ─── Price Fetching ──────────────────────────────────────────────────

interface PriceResult {
  destination: string;
  price: number;
  currency: string;
  airline: string;
  duration: string;
}

function formatDuration(iso: string): string {
  const m = iso.match(/PT(\d+H)?(\d+M)?/);
  if (!m) return '';
  return `${m[1]?.replace('H', 'h') || ''}${m[2] ? ` ${m[2].replace('M', 'm')}` : ''}`.trim();
}

/**
 * Try Flight Inspiration Search first — returns many destinations in one call.
 * Falls back to individual flight-offers for any destinations not covered.
 */
async function fetchInspirationPrices(
  token: string,
  origin: string,
): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();

  try {
    const res = await fetch(
      `${AMADEUS_BASE}/v1/shopping/flight-destinations?origin=${origin}&oneWay=false&nonStop=false`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        data?: Array<{
          destination: string;
          price: { total: string };
          departureDate: string;
          returnDate: string;
        }>;
      };
      if (data.data) {
        for (const item of data.data) {
          results.set(item.destination, {
            destination: item.destination,
            price: Math.round(parseFloat(item.price.total)),
            currency: 'USD',
            airline: '',
            duration: '',
          });
        }
      }
    }
  } catch {
    // Inspiration endpoint may not work on test sandbox — that's fine
  }

  return results;
}

async function fetchIndividualPrice(
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
    const itin = (offer.itineraries as Array<Record<string, unknown>>)?.[0];
    const seg = (itin?.segments as Array<Record<string, unknown>>)?.[0];
    const dicts = data.dictionaries as Record<string, Record<string, string>> | undefined;
    const carrier = seg?.carrierCode as string;

    return {
      destination: dest,
      price: Math.round(parseFloat(priceObj.grandTotal)),
      currency: priceObj.currency || 'USD',
      airline: dicts?.carriers?.[carrier] || carrier || '',
      duration: formatDuration((itin?.duration as string) || ''),
    };
  } catch {
    return null;
  }
}

// ─── Top-10 fallback airports ────────────────────────────────────────

const DEFAULT_ORIGINS = ['TPA', 'LAX', 'JFK', 'ORD', 'ATL', 'SFO', 'MIA', 'DFW', 'SEA', 'BOS'];

/**
 * Collect all origins that need refreshing:
 * - DISTINCT departure_code values from user_preferences
 * - Merged with the hardcoded top-10 fallback list
 */
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
    // If user_preferences table doesn't exist yet, just use defaults
  }

  return Array.from(origins);
}

/**
 * Refresh prices for a single origin. Extracted from the old handler
 * so it can be called in a loop for multi-origin refresh.
 */
async function refreshOrigin(
  token: string,
  origin: string,
  allIatas: string[],
): Promise<{ origin: string; fetched: number; total: number }> {
  // Step 1: Try inspiration search
  const inspirationPrices = await fetchInspirationPrices(token, origin);
  console.log(`[refresh] Inspiration returned ${inspirationPrices.size} prices for ${origin}`);

  // Step 2: Fill gaps with individual flight-offers (batched, 3 concurrent)
  const missing = allIatas.filter((iata) => !inspirationPrices.has(iata));
  const date = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  console.log(`[refresh] Fetching ${missing.length} individual prices for ${origin}...`);

  const allResults = new Map(inspirationPrices);

  for (let i = 0; i < missing.length; i += 3) {
    const batch = missing.slice(i, i + 3);
    const promises = batch.map((dest) => fetchIndividualPrice(token, origin, dest, date));
    const results = await Promise.all(promises);
    for (const r of results) {
      if (r) allResults.set(r.destination, r);
    }
    if (i + 3 < missing.length) await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`[refresh] Total prices for ${origin}: ${allResults.size}/${allIatas.length}`);

  // Step 3: Upsert into cached_prices
  const rows = Array.from(allResults.values()).map((p) => ({
    origin,
    destination_iata: p.destination,
    price: p.price,
    currency: p.currency,
    airline: p.airline,
    duration: p.duration,
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

  return { origin, fetched: allResults.size, total: allIatas.length };
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

  const originParam = (req.query.origin as string) || '';

  try {
    const token = await getAmadeusToken();

    // Get all active destination IATA codes from Supabase
    const { data: destinations, error: dbErr } = await supabase
      .from('destinations')
      .select('iata_code')
      .eq('is_active', true);

    if (dbErr || !destinations) {
      return res.status(500).json({ error: 'Failed to fetch destinations from DB' });
    }

    const allIatas = destinations.map((d) => d.iata_code as string);

    // Determine which origins to refresh
    let origins: string[];
    if (!originParam || originParam === 'ALL') {
      origins = await getActiveOrigins();
    } else {
      origins = [originParam];
    }

    console.log(`[refresh] Refreshing ${origins.length} origin(s): ${origins.join(', ')}`);

    const results: Array<{ origin: string; fetched: number; total: number }> = [];

    for (let i = 0; i < origins.length; i++) {
      const org = origins[i];
      console.log(`[refresh] Processing origin ${i + 1}/${origins.length}: ${org}`);
      const result = await refreshOrigin(token, org, allIatas);
      results.push(result);

      // 500ms delay between origins to respect Amadeus sandbox rate limits
      if (i < origins.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return res.status(200).json({
      origins: results,
      totalOrigins: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[refresh]', message);
    return res.status(500).json({ error: 'Price refresh failed', detail: message });
  }
}
