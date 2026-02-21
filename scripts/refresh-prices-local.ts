/**
 * Local price refresh — fetches from Travelpayouts + Amadeus and writes to Appwrite directly.
 * Bypasses the 60s Vercel limit by running locally.
 * 
 * Run: npx tsx scripts/refresh-prices-local.ts [origin]
 * Default origins: TPA, JFK, LAX, ORD, MIA
 */
import fs from 'node:fs';
import path from 'node:path';

// Load env
for (const envFile of ['.env', '.env.local']) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const [k, ...r] = t.split('=');
      process.env[k.trim()] = r.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const TP_TOKEN = process.env.TRAVELPAYOUTS_API_TOKEN || '';
const AMADEUS_KEY = process.env.AMADEUS_API_KEY || '';
const AMADEUS_SECRET = process.env.AMADEUS_API_SECRET || '';
const AW_ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const AW_PROJECT = process.env.APPWRITE_PROJECT_ID!;
const AW_KEY = process.env.APPWRITE_API_KEY!;
const DB = 'sogojet';

// ── Appwrite helpers ──

async function awList(collection: string, queries: string[]): Promise<any[]> {
  const params = queries.map(q => `queries[]=${encodeURIComponent(q)}`).join('&');
  const res = await fetch(`${AW_ENDPOINT}/databases/${DB}/collections/${collection}/documents?${params}`, {
    headers: { 'X-Appwrite-Project': AW_PROJECT, 'X-Appwrite-Key': AW_KEY },
  });
  const data = await res.json();
  return data.documents || [];
}

async function awUpsert(collection: string, docId: string, body: Record<string, unknown>): Promise<boolean> {
  // Try update first
  const updateRes = await fetch(`${AW_ENDPOINT}/databases/${DB}/collections/${collection}/documents/${docId}`, {
    method: 'PATCH',
    headers: { 'X-Appwrite-Project': AW_PROJECT, 'X-Appwrite-Key': AW_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: body }),
  });
  if (updateRes.ok) return true;
  
  // Create
  const createRes = await fetch(`${AW_ENDPOINT}/databases/${DB}/collections/${collection}/documents`, {
    method: 'POST',
    headers: { 'X-Appwrite-Project': AW_PROJECT, 'X-Appwrite-Key': AW_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: docId, data: body }),
  });
  return createRes.ok;
}

// ── Travelpayouts ──

async function tpCityDirections(origin: string): Promise<Map<string, { price: number; airline: string; departureAt: string; returnAt: string }>> {
  const map = new Map();
  if (!TP_TOKEN) return map;
  try {
    const res = await fetch(`https://api.travelpayouts.com/v1/city-directions?origin=${origin}&currency=USD`, {
      headers: { 'X-Access-Token': TP_TOKEN },
    });
    if (!res.ok) { console.log(`  TP city-directions ${origin}: ${res.status}`); return map; }
    const json = await res.json() as any;
    if (json.success && json.data) {
      for (const [iata, item] of Object.entries(json.data) as any) {
        map.set(iata, { price: Math.round(item.price), airline: item.airline || '', departureAt: item.departure_at || '', returnAt: item.return_at || '' });
      }
    }
  } catch (e) { console.log(`  TP error: ${e}`); }
  return map;
}

async function tpLatestPrices(origin: string): Promise<Map<string, { price: number; airline: string }>> {
  const map = new Map();
  if (!TP_TOKEN) return map;
  try {
    const res = await fetch(`https://api.travelpayouts.com/v2/prices/latest?origin=${origin}&period_type=year&limit=50&sorting=price&currency=USD`, {
      headers: { 'X-Access-Token': TP_TOKEN },
    });
    if (!res.ok) return map;
    const json = await res.json() as any;
    if (json.success && json.data) {
      for (const item of json.data) {
        if (!map.has(item.destination)) {
          map.set(item.destination, { price: Math.round(item.value), airline: item.airline || '' });
        }
      }
    }
  } catch (e) { console.log(`  TP latest error: ${e}`); }
  return map;
}

// ── Amadeus ──

let amadeusToken: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string | null> {
  if (!AMADEUS_KEY || !AMADEUS_SECRET) return null;
  if (amadeusToken && amadeusToken.expiresAt > Date.now() + 60000) return amadeusToken.token;
  try {
    const res = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${AMADEUS_KEY}&client_secret=${AMADEUS_SECRET}`,
    });
    if (!res.ok) { console.log(`  Amadeus auth failed: ${res.status}`); return null; }
    const data = await res.json() as any;
    amadeusToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return amadeusToken.token;
  } catch { return null; }
}

async function amadeusSearch(origin: string, dest: string, token: string): Promise<{ price: number; airline: string; duration: string } | null> {
  const departDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const returnDate = new Date(Date.now() + 37 * 86400000).toISOString().split('T')[0];
  try {
    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${dest}&departureDate=${departDate}&returnDate=${returnDate}&adults=1&max=1&currencyCode=USD`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const offer = data.data?.[0];
    if (!offer) return null;
    return {
      price: Math.round(parseFloat(offer.price.total)),
      airline: offer.validatingAirlineCodes?.[0] || '',
      duration: offer.itineraries?.[0]?.duration?.replace('PT', '').toLowerCase() || '',
    };
  } catch { return null; }
}

// ── Main ──

async function refreshOrigin(origin: string, iatas: string[]) {
  console.log(`\n🔄 ${origin} — fetching prices for ${iatas.length} destinations...`);
  
  // Step 1: Travelpayouts bulk (fast, covers many)
  const tpDir = await tpCityDirections(origin);
  const tpLatest = await tpLatestPrices(origin);
  console.log(`  TP city-directions: ${tpDir.size} prices, latest: ${tpLatest.size} prices`);
  
  // Step 2: Amadeus for remaining (slower, per-route)
  const token = await getAmadeusToken();
  const covered = new Set([...tpDir.keys(), ...tpLatest.keys()]);
  const uncovered = iatas.filter(i => !covered.has(i)).slice(0, 20); // Cap Amadeus at 20 to avoid timeouts
  console.log(`  Amadeus needed for ${uncovered.length} uncovered destinations (capped at 20)`);
  
  let amadeusResults = new Map<string, { price: number; airline: string; duration: string }>();
  if (token && uncovered.length > 0) {
    // Batch Amadeus calls with concurrency limit
    const BATCH = 5;
    for (let i = 0; i < uncovered.length; i += BATCH) {
      const batch = uncovered.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(dest => amadeusSearch(origin, dest, token)));
      for (let j = 0; j < batch.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled' && r.value) {
          amadeusResults.set(batch[j], r.value);
        }
      }
      if (i + BATCH < uncovered.length) await new Promise(r => setTimeout(r, 500)); // rate limit
    }
    console.log(`  Amadeus: ${amadeusResults.size} prices found`);
  }
  
  // Step 3: Write all to Appwrite
  let written = 0;
  const now = new Date().toISOString();
  
  for (const iata of iatas) {
    let price: number | null = null;
    let airline = '';
    let source = 'estimate';
    let duration = '';
    let departureDate = '';
    let returnDate = '';
    let tripDays = 0;
    
    if (tpDir.has(iata)) {
      const d = tpDir.get(iata)!;
      price = d.price;
      airline = d.airline;
      source = 'travelpayouts';
      departureDate = d.departureAt?.split('T')[0] || '';
      returnDate = d.returnAt?.split('T')[0] || '';
      if (departureDate && returnDate) {
        tripDays = Math.round((new Date(returnDate).getTime() - new Date(departureDate).getTime()) / 86400000);
      }
    } else if (tpLatest.has(iata)) {
      const d = tpLatest.get(iata)!;
      price = d.price;
      airline = d.airline;
      source = 'travelpayouts';
    } else if (amadeusResults.has(iata)) {
      const d = amadeusResults.get(iata)!;
      price = d.price;
      airline = d.airline;
      source = 'amadeus';
      duration = d.duration;
    }
    
    if (price === null) continue;
    
    const docId = `${origin}_${iata}`;
    const ok = await awUpsert('cached_prices', docId, {
      origin,
      destination_iata: iata,
      price,
      airline,
      source,
      duration,
      fetched_at: now,
      departure_date: departureDate,
      return_date: returnDate,
      trip_duration_days: tripDays,
      previous_price: 0,
      price_direction: 'stable',
    });
    
    if (ok) written++;
  }
  
  console.log(`  ✅ Wrote ${written} prices to Appwrite for origin ${origin}`);
  return written;
}

async function main() {
  const arg = process.argv[2];
  const DEFAULT_ORIGINS = ['TPA', 'JFK', 'LAX', 'ORD', 'MIA'];
  const origins = arg ? [arg.toUpperCase()] : DEFAULT_ORIGINS;
  
  // Get all destination IATA codes from Appwrite
  console.log('Fetching destinations from Appwrite...');
  const docs = await awList('destinations', ['equal("is_active",true)', 'limit(500)']);
  
  // Appwrite query format might differ, try alternative
  let iatas: string[];
  if (docs.length > 0) {
    iatas = docs.map((d: any) => d.iata_code);
    console.log(`Found ${iatas.length} active destinations in Appwrite`);
  } else {
    // Fallback: load from local data
    const { destinations } = await import('../data/destinations');
    iatas = destinations.map(d => d.iataCode);
    console.log(`Loaded ${iatas.length} destinations from local data`);
  }
  
  let totalWritten = 0;
  for (const origin of origins) {
    totalWritten += await refreshOrigin(origin, iatas);
  }
  
  console.log(`\n✨ Done! ${totalWritten} total prices written across ${origins.length} origin(s)`);
}

main().catch(err => { console.error(err); process.exit(1); });
