/**
 * Purge stale prices (>2 hours old) and trigger full live price refresh.
 *
 * Usage: npx tsx scripts/purge-and-refresh-prices.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\\n/g, '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(/\\n/g, '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

async function purgeStaleFlightPrices() {
  console.log(`\n🔥 Purging flight prices older than ${TWO_HOURS_AGO}...`);

  // Count before
  const { count: totalBefore } = await supabase
    .from('cached_prices')
    .select('*', { count: 'exact', head: true });

  const { count: staleCount } = await supabase
    .from('cached_prices')
    .select('*', { count: 'exact', head: true })
    .lt('fetched_at', TWO_HOURS_AGO);

  console.log(`  Total flight prices: ${totalBefore}`);
  console.log(`  Stale (>2h): ${staleCount}`);

  if (staleCount && staleCount > 0) {
    // Supabase delete has a row limit, so delete in batches
    let deleted = 0;
    while (deleted < staleCount) {
      const { data, error } = await supabase
        .from('cached_prices')
        .delete()
        .lt('fetched_at', TWO_HOURS_AGO)
        .select('id')
        .limit(1000);
      if (error) {
        console.error('  Delete error:', error.message);
        break;
      }
      if (!data || data.length === 0) break;
      deleted += data.length;
      console.log(`  Deleted batch: ${data.length} (total: ${deleted})`);
    }
    console.log(`  ✅ Purged ${deleted} stale flight prices`);
  } else {
    console.log('  No stale flight prices to purge');
  }

  const { count: remaining } = await supabase
    .from('cached_prices')
    .select('*', { count: 'exact', head: true });
  console.log(`  Remaining flight prices: ${remaining}`);
}

async function purgeStaleHotelPrices() {
  console.log(`\n🔥 Purging hotel prices older than ${TWO_HOURS_AGO}...`);

  const { count: totalBefore } = await supabase
    .from('cached_hotel_prices')
    .select('*', { count: 'exact', head: true });

  const { count: staleCount } = await supabase
    .from('cached_hotel_prices')
    .select('*', { count: 'exact', head: true })
    .lt('fetched_at', TWO_HOURS_AGO);

  console.log(`  Total hotel prices: ${totalBefore}`);
  console.log(`  Stale (>2h): ${staleCount}`);

  if (staleCount && staleCount > 0) {
    let deleted = 0;
    while (deleted < staleCount) {
      const { data, error } = await supabase
        .from('cached_hotel_prices')
        .delete()
        .lt('fetched_at', TWO_HOURS_AGO)
        .select('id')
        .limit(1000);
      if (error) {
        console.error('  Delete error:', error.message);
        break;
      }
      if (!data || data.length === 0) break;
      deleted += data.length;
      console.log(`  Deleted batch: ${data.length} (total: ${deleted})`);
    }
    console.log(`  ✅ Purged ${deleted} stale hotel prices`);
  } else {
    console.log('  No stale hotel prices to purge');
  }

  const { count: remaining } = await supabase
    .from('cached_hotel_prices')
    .select('*', { count: 'exact', head: true });
  console.log(`  Remaining hotel prices: ${remaining}`);
}

async function triggerFlightRefresh() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('Missing CRON_SECRET — cannot trigger refresh');
    return;
  }

  // Get all active origins from user_preferences + defaults
  const defaultOrigins = ['TPA', 'LAX', 'JFK', 'ORD', 'ATL', 'SFO', 'MIA', 'DFW', 'SEA', 'BOS'];
  const origins = new Set(defaultOrigins);

  const { data: userPrefs } = await supabase
    .from('user_preferences')
    .select('departure_code')
    .limit(500);
  for (const p of userPrefs ?? []) {
    if (p.departure_code) origins.add(p.departure_code);
  }

  const originList = Array.from(origins);
  console.log(`\n🛫 Triggering flight price refresh for ${originList.length} origins...`);
  console.log(`  Origins: ${originList.join(', ')}`);

  // Trigger refresh for each origin sequentially (each call takes up to 300s)
  // Hit the deployed Vercel endpoint
  const baseUrl = process.env.API_BASE || 'https://www.sogojet.com';

  for (const origin of originList) {
    console.log(`\n  Refreshing ${origin}...`);
    try {
      const resp = await fetch(`${baseUrl}/api/prices/refresh?origin=${origin}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const json = await resp.json();
      if (resp.ok) {
        const r = json.origins?.[0];
        console.log(`  ✅ ${origin}: ${r?.fetched ?? 0}/${r?.total ?? 0} prices fetched (Duffel: ${r?.sources?.duffel ?? 0})`);
      } else {
        console.error(`  ❌ ${origin}: ${json.error || resp.statusText}`);
      }
    } catch (err) {
      console.error(`  ❌ ${origin}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function triggerHotelRefresh() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return;

  const baseUrl = process.env.API_BASE || 'https://www.sogojet.com';
  console.log(`\n🏨 Triggering hotel price refresh...`);

  try {
    const resp = await fetch(`${baseUrl}/api/prices/refresh-hotels`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const json = await resp.json();
    if (resp.ok) {
      console.log(`  ✅ Hotels: ${json.fetched}/${json.total} prices fetched`);
    } else {
      console.error(`  ❌ Hotels: ${json.error || resp.statusText}`);
    }
  } catch (err) {
    console.error(`  ❌ Hotels: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  console.log('=== PRICE PURGE & REFRESH ===');
  console.log(`Cutoff: ${TWO_HOURS_AGO}`);
  console.log(`Now:    ${new Date().toISOString()}`);

  // Step 1: Purge stale prices
  await purgeStaleFlightPrices();
  await purgeStaleHotelPrices();

  // Step 2: Trigger live price refresh
  await triggerFlightRefresh();
  await triggerHotelRefresh();

  console.log('\n=== DONE ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
