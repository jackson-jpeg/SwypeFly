/**
 * One-time script to set up Appwrite schema for the Deal Quality Engine.
 * Creates price_history_stats collection and adds deal quality attributes
 * to cached_prices and price_calendar collections.
 *
 * Run with: npx tsx scripts/setup-deal-quality-schema.ts
 */

import { Client, Databases, ID, IndexType } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT?.trim() || 'https://nyc.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID?.trim() || '';
const apiKey = process.env.APPWRITE_API_KEY?.trim() || '';
const DATABASE_ID = 'sogojet';

if (!projectId || !apiKey) {
  console.error('Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

async function createAttribute(
  collectionId: string,
  type: 'string' | 'number' | 'boolean',
  key: string,
  opts: { required?: boolean; default?: unknown; size?: number; array?: boolean } = {},
) {
  try {
    if (type === 'string') {
      await databases.createStringAttribute(
        DATABASE_ID, collectionId, key,
        opts.size || 255,
        opts.required ?? false,
        (opts.default as string) ?? undefined,
        opts.array ?? false,
      );
    } else if (type === 'number') {
      await databases.createFloatAttribute(
        DATABASE_ID, collectionId, key,
        opts.required ?? false,
        undefined, undefined,
        (opts.default as number) ?? undefined,
        opts.array ?? false,
      );
    } else if (type === 'boolean') {
      await databases.createBooleanAttribute(
        DATABASE_ID, collectionId, key,
        opts.required ?? false,
        (opts.default as boolean) ?? undefined,
        opts.array ?? false,
      );
    }
    console.log(`  ✓ ${collectionId}.${key} (${type})`);
  } catch (err: any) {
    if (err.code === 409 || err.message?.includes('already exists')) {
      console.log(`  – ${collectionId}.${key} already exists, skipping`);
    } else {
      console.error(`  ✗ ${collectionId}.${key}: ${err.message}`);
    }
  }
}

async function createIndex(
  collectionId: string,
  key: string,
  type: 'key' | 'unique' | 'fulltext',
  attributes: string[],
) {
  try {
    await databases.createIndex(
      DATABASE_ID, collectionId, key, type as IndexType, attributes,
    );
    console.log(`  ✓ index ${collectionId}/${key}`);
  } catch (err: any) {
    if (err.code === 409 || err.message?.includes('already exists')) {
      console.log(`  – index ${collectionId}/${key} already exists`);
    } else {
      console.error(`  ✗ index ${collectionId}/${key}: ${err.message}`);
    }
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n═══ Deal Quality Engine — Appwrite Schema Setup ═══\n');

  // ─── Step 1: Create price_history_stats collection ──────────────────
  console.log('1. Creating price_history_stats collection...');
  try {
    await databases.createCollection(
      DATABASE_ID,
      'price_history_stats',
      'price_history_stats',
      undefined, // permissions — server-only access via API key
      false, // documentSecurity
      true, // enabled
    );
    console.log('  ✓ Collection created');
  } catch (err: any) {
    if (err.code === 409 || err.message?.includes('already exists')) {
      console.log('  – Collection already exists');
    } else {
      console.error('  ✗ Failed:', err.message);
      // Don't exit — try adding attributes anyway
    }
  }

  // Wait for collection to be ready
  await sleep(2000);

  console.log('\n2. Adding price_history_stats attributes...');
  await createAttribute('price_history_stats', 'string', 'route_key', { required: true });
  await sleep(1500);
  await createAttribute('price_history_stats', 'string', 'origin', { required: true });
  await sleep(1500);
  await createAttribute('price_history_stats', 'string', 'destination_iata', { required: true });
  await sleep(1500);
  await createAttribute('price_history_stats', 'number', 'median_price', { required: true });
  await sleep(1500);
  await createAttribute('price_history_stats', 'number', 'p20_price');
  await sleep(1500);
  await createAttribute('price_history_stats', 'number', 'p5_price');
  await sleep(1500);
  await createAttribute('price_history_stats', 'number', 'p80_price');
  await sleep(1500);
  await createAttribute('price_history_stats', 'number', 'min_price_ever');
  await sleep(1500);
  await createAttribute('price_history_stats', 'number', 'max_price_ever');
  await sleep(1500);
  await createAttribute('price_history_stats', 'number', 'sample_count');
  await sleep(1500);
  await createAttribute('price_history_stats', 'number', 'last_30d_avg');
  await sleep(1500);
  await createAttribute('price_history_stats', 'string', 'last_updated');
  await sleep(1500);

  console.log('\n3. Adding price_history_stats indexes...');
  await sleep(3000); // Wait for attributes to be ready
  await createIndex('price_history_stats', 'idx_route_key', 'key', ['route_key']);
  await sleep(2000);
  await createIndex('price_history_stats', 'idx_origin', 'key', ['origin']);
  await sleep(2000);

  // ─── Step 2: Add deal quality attributes to cached_prices ───────────
  console.log('\n4. Adding deal quality attributes to cached_prices...');
  const dealAttrs: [string, 'string' | 'number' | 'boolean'][] = [
    ['deal_score', 'number'],
    ['deal_tier', 'string'],
    ['quality_score', 'number'],
    ['price_percentile', 'number'],
    ['total_stops', 'number'],
    ['max_layover_minutes', 'number'],
    ['total_travel_minutes', 'number'],
    ['is_nonstop', 'boolean'],
  ];

  for (const [key, type] of dealAttrs) {
    await createAttribute('cached_prices', type, key);
    await sleep(1500);
  }

  console.log('\n5. Adding deal_score index to cached_prices...');
  await sleep(3000);
  await createIndex('cached_prices', 'idx_deal_score', 'key', ['deal_score']);
  await sleep(2000);

  // ─── Step 3: Add deal quality attributes to price_calendar ──────────
  console.log('\n6. Adding deal quality attributes to price_calendar...');
  for (const [key, type] of dealAttrs) {
    await createAttribute('price_calendar', type, key);
    await sleep(1500);
  }

  console.log('\n7. Adding deal_score index to price_calendar...');
  await sleep(3000);
  await createIndex('price_calendar', 'idx_deal_score', 'key', ['deal_score']);

  console.log('\n═══ Schema setup complete! ═══');
  console.log('\nNext steps:');
  console.log('  1. Trigger a price refresh cron to populate deal scores');
  console.log('  2. After cron runs, feed cards will show deal tier badges');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
