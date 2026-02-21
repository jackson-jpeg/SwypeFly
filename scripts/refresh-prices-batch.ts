/**
 * Refresh prices by calling the production API in batches.
 * Splits origins across multiple requests to avoid the 60s Vercel timeout.
 * Run: npx tsx scripts/refresh-prices-batch.ts [origin]
 */

const ORIGINS = ['TPA', 'JFK', 'LAX', 'ORD', 'MIA', 'ATL', 'DFW', 'DEN', 'SFO', 'SEA'];
const BASE_URL = 'https://sogojet.com';

async function refreshOrigin(origin: string): Promise<void> {
  console.log(`\n🔄 Refreshing prices for origin: ${origin}...`);
  const start = Date.now();
  
  try {
    const res = await fetch(`${BASE_URL}/api/prices/refresh?origin=${origin}`, {
      method: 'GET',
      signal: AbortSignal.timeout(65000),
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.log(`  ❌ ${res.status}: ${text.slice(0, 200)}`);
      return;
    }
    
    const data = await res.json() as { origins?: Array<{ origin: string; updated: number; errors: number }> };
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    
    if (data.origins) {
      for (const o of data.origins) {
        console.log(`  ✅ ${o.origin}: ${o.updated} prices updated, ${o.errors} errors (${elapsed}s)`);
      }
    } else {
      console.log(`  ✅ Done in ${elapsed}s`, JSON.stringify(data).slice(0, 200));
    }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ⏱️ Timeout or error after ${elapsed}s: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  const arg = process.argv[2];
  const origins = arg ? [arg.toUpperCase()] : ORIGINS;
  
  console.log(`Refreshing prices for ${origins.length} origin(s): ${origins.join(', ')}`);
  
  for (const origin of origins) {
    await refreshOrigin(origin);
    // Small delay between requests
    if (origins.length > 1) await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n✨ Done!');
}

main();
