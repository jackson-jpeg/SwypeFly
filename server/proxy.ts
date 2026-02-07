// Lightweight price proxy server — self-contained, no project imports
// Run: npx tsx server/proxy.ts
// Serves flight prices at http://localhost:3001/api/flights

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] = rest.join('=').trim();
  }
}

const PORT = parseInt(process.env.PORT || '3001', 10);
const API_KEY = process.env.AMADEUS_API_KEY || '';
const API_SECRET = process.env.AMADEUS_API_SECRET || '';
const DEFAULT_ORIGIN = process.env.DEFAULT_ORIGIN || 'TPA';
const BASE_URL = 'https://test.api.amadeus.com';

// Destination IATA codes matching our catalog
const DESTINATIONS = [
  // Original 20
  'DPS', 'JTR', 'NRT', 'CUZ', 'RAK', 'KEF', 'NAP', 'CPT', 'KIX', 'DBV',
  'MLE', 'BCN', 'YYC', 'LIS', 'ZQN', 'DXB', 'EZE', 'CNX', 'ZRH', 'HAV',
  // Caribbean & Mexico
  'CUN', 'PUJ', 'MBJ', 'SJU', 'AUA', 'NAS', 'CZM', 'UVF',
  // Central & South America
  'SJO', 'BOG', 'MDE', 'LIM', 'CTG', 'PTY',
  // Europe
  'LHR', 'CDG', 'AMS', 'FCO', 'DUB', 'PRG', 'CPH', 'TXL',
  // Asia
  'BKK', 'SIN', 'ICN', 'HAN',
  // Domestic US
  'HNL', 'MSY', 'BNA', 'JFK',
];

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${API_KEY}&client_secret=${API_SECRET}`,
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

interface PriceResult {
  price: number;
  currency: string;
  airline: string;
  duration: string;
}

async function getPrice(token: string, origin: string, dest: string, date: string): Promise<PriceResult | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${dest}&departureDate=${date}&adults=1&max=1&currencyCode=USD`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const offers = data.data as Array<Record<string, unknown>>;
    const offer = offers?.[0];
    if (!offer) return null;

    const priceObj = offer.price as Record<string, string>;
    const itin = (offer.itineraries as Array<Record<string, unknown>>)?.[0];
    const seg = (itin?.segments as Array<Record<string, unknown>>)?.[0];
    const dicts = data.dictionaries as Record<string, Record<string, string>>;
    const carrier = seg?.carrierCode as string;

    return {
      price: Math.round(parseFloat(priceObj.grandTotal)),
      currency: priceObj.currency || 'USD',
      airline: dicts?.carriers?.[carrier] || carrier || '',
      duration: formatDuration((itin?.duration as string) || ''),
    };
  } catch {
    return null;
  }
}

function formatDuration(iso: string): string {
  const m = iso.match(/PT(\d+H)?(\d+M)?/);
  if (!m) return '';
  return `${m[1]?.replace('H', 'h') || ''}${m[2] ? ` ${m[2].replace('M', 'm')}` : ''}`.trim();
}

// Cache: origin → { prices, timestamp }
const cache = new Map<string, { prices: Record<string, PriceResult>; ts: number }>();
const CACHE_TTL = 4 * 60 * 60 * 1000;

async function fetchAll(origin: string): Promise<Record<string, PriceResult>> {
  const c = cache.get(origin);
  if (c && Date.now() - c.ts < CACHE_TTL) return c.prices;

  console.log(`[proxy] Fetching ${DESTINATIONS.length} prices from ${origin}...`);
  const token = await getToken();
  const date = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const results: Record<string, PriceResult> = {};
  // Batch in groups of 3 to avoid rate limits
  for (let i = 0; i < DESTINATIONS.length; i += 3) {
    const batch = DESTINATIONS.slice(i, i + 3);
    const promises = batch.map((dest) => getPrice(token, origin, dest, date));
    const settled = await Promise.all(promises);
    for (let j = 0; j < batch.length; j++) {
      if (settled[j]) results[batch[j]] = settled[j]!;
    }
    // Small delay between batches
    if (i + 3 < DESTINATIONS.length) await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[proxy] Got ${Object.keys(results).length}/${DESTINATIONS.length} live prices`);
  cache.set(origin, { prices: results, ts: Date.now() });
  return results;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (url.pathname === '/api/flights') {
    const origin = url.searchParams.get('origin') || DEFAULT_ORIGIN;
    try {
      const prices = await fetchAll(origin);
      res.writeHead(200);
      res.end(JSON.stringify({ origin, count: Object.keys(prices).length, prices }));
    } catch (err) {
      console.error('[proxy]', err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch prices' }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n  SwypeFly Price Proxy`);
  console.log(`  http://localhost:${PORT}/api/flights\n`);
});
