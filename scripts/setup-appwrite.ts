/**
 * Sets up the Appwrite database, collections, and attributes for SoGoJet.
 * Run: npx tsx scripts/setup-appwrite.ts
 */
import fs from 'node:fs';
import path from 'node:path';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] = rest.join('=').trim();
  }
}

const ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY in .env');
  process.exit(1);
}

const DATABASE_ID = 'sogojet';

// ─── REST helper ────────────────────────────────────────────────

async function api(method: string, path: string, body?: unknown) {
  const url = `${ENDPOINT}${path}`;
  const headers: Record<string, string> = {
    'X-Appwrite-Project': PROJECT_ID,
    'X-Appwrite-Key': API_KEY,
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok && res.status !== 409) {
    // 409 = already exists, that's fine
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 409) {
    console.log(`  (already exists, skipping)`);
    return null;
  }
  return text ? JSON.parse(text) : null;
}

// ─── Create database ──────────────────────────────────────────

async function createDatabase() {
  console.log('Creating database...');
  await api('POST', '/databases', {
    databaseId: DATABASE_ID,
    name: 'SoGoJet',
  });
  console.log('  ✓ Database created');
}

// ─── Attribute helpers ──────────────────────────────────────────

type AttrDef =
  | { type: 'string'; key: string; size?: number; required?: boolean; default?: string | null; array?: boolean }
  | { type: 'integer'; key: string; required?: boolean; default?: number | null }
  | { type: 'float'; key: string; required?: boolean; default?: number | null }
  | { type: 'boolean'; key: string; required?: boolean; default?: boolean | null }
  | { type: 'email'; key: string; required?: boolean; default?: string | null };

async function createAttribute(collectionId: string, attr: AttrDef) {
  const basePath = `/databases/${DATABASE_ID}/collections/${collectionId}/attributes`;

  if (attr.type === 'string') {
    await api('POST', `${basePath}/string`, {
      key: attr.key,
      size: attr.size ?? 255,
      required: attr.required ?? false,
      default: attr.default ?? null,
      array: attr.array ?? false,
    });
  } else if (attr.type === 'integer') {
    await api('POST', `${basePath}/integer`, {
      key: attr.key,
      required: attr.required ?? false,
      default: attr.default ?? null,
      min: -2147483647,
      max: 2147483647,
    });
  } else if (attr.type === 'float') {
    await api('POST', `${basePath}/float`, {
      key: attr.key,
      required: attr.required ?? false,
      default: attr.default ?? null,
      min: -999999999,
      max: 999999999,
    });
  } else if (attr.type === 'boolean') {
    await api('POST', `${basePath}/boolean`, {
      key: attr.key,
      required: attr.required ?? false,
      default: attr.default ?? null,
    });
  } else if (attr.type === 'email') {
    await api('POST', `${basePath}/email`, {
      key: attr.key,
      required: attr.required ?? false,
      default: attr.default ?? null,
    });
  }
}

async function createIndex(collectionId: string, key: string, type: string, attributes: string[], orders?: string[]) {
  const basePath = `/databases/${DATABASE_ID}/collections/${collectionId}/indexes`;
  await api('POST', basePath, {
    key,
    type,
    attributes,
    orders: orders ?? attributes.map(() => 'ASC'),
  });
}

// ─── Collections ─────────────────────────────────────────────

async function createCollections() {
  const basePath = `/databases/${DATABASE_ID}/collections`;

  // 1. Destinations
  console.log('Creating destinations collection...');
  await api('POST', basePath, {
    collectionId: 'destinations',
    name: 'Destinations',
    permissions: ['read("any")'], // Public read, server-side write via API key
  });

  const destAttrs: AttrDef[] = [
    { type: 'string', key: 'iata_code', size: 10, required: true },
    { type: 'string', key: 'city', size: 100, required: true },
    { type: 'string', key: 'country', size: 100, required: true },
    { type: 'string', key: 'continent', size: 50 },
    { type: 'string', key: 'tagline', size: 500 },
    { type: 'string', key: 'description', size: 2000 },
    { type: 'string', key: 'image_url', size: 500 },
    { type: 'string', key: 'image_urls', size: 500, array: true },
    { type: 'float', key: 'flight_price', required: true },
    { type: 'float', key: 'hotel_price_per_night' },
    { type: 'string', key: 'currency', size: 10, default: 'USD' },
    { type: 'string', key: 'vibe_tags', size: 50, array: true },
    { type: 'float', key: 'rating' },
    { type: 'integer', key: 'review_count' },
    { type: 'string', key: 'best_months', size: 10, array: true },
    { type: 'integer', key: 'average_temp' },
    { type: 'string', key: 'flight_duration', size: 20 },
    { type: 'string', key: 'available_flight_days', size: 10, array: true },
    { type: 'boolean', key: 'is_active', default: true },
    // Feature vectors
    { type: 'float', key: 'beach_score' },
    { type: 'float', key: 'city_score' },
    { type: 'float', key: 'adventure_score' },
    { type: 'float', key: 'culture_score' },
    { type: 'float', key: 'nightlife_score' },
    { type: 'float', key: 'nature_score' },
    { type: 'float', key: 'food_score' },
    { type: 'float', key: 'popularity_score' },
    // JSON stored as string
    { type: 'string', key: 'itinerary_json', size: 5000 },
    { type: 'string', key: 'restaurants_json', size: 5000 },
  ];

  for (const attr of destAttrs) {
    process.stdout.write(`  attr: ${attr.key}...`);
    await createAttribute('destinations', attr);
    console.log(' ✓');
  }

  // 2. Saved Trips
  console.log('Creating saved_trips collection...');
  await api('POST', basePath, {
    collectionId: 'saved_trips',
    name: 'Saved Trips',
    permissions: [
      'create("users")',
      'read("users")',
      'delete("users")',
    ],
  });

  const savedAttrs: AttrDef[] = [
    { type: 'string', key: 'user_id', size: 100, required: true },
    { type: 'string', key: 'destination_id', size: 100, required: true },
    { type: 'string', key: 'saved_at', size: 30 },
  ];

  for (const attr of savedAttrs) {
    process.stdout.write(`  attr: ${attr.key}...`);
    await createAttribute('saved_trips', attr);
    console.log(' ✓');
  }

  // 3. User Preferences
  console.log('Creating user_preferences collection...');
  await api('POST', basePath, {
    collectionId: 'user_preferences',
    name: 'User Preferences',
    permissions: [
      'create("users")',
      'read("users")',
      'update("users")',
    ],
  });

  const prefAttrs: AttrDef[] = [
    { type: 'string', key: 'user_id', size: 100, required: true },
    { type: 'string', key: 'traveler_type', size: 20 },
    { type: 'string', key: 'budget_level', size: 20 },
    { type: 'float', key: 'budget_numeric', default: 2 },
    { type: 'string', key: 'departure_city', size: 50, default: 'Tampa' },
    { type: 'string', key: 'departure_code', size: 10, default: 'TPA' },
    { type: 'string', key: 'currency', size: 10, default: 'USD' },
    { type: 'float', key: 'pref_beach', default: 0.5 },
    { type: 'float', key: 'pref_city', default: 0.5 },
    { type: 'float', key: 'pref_adventure', default: 0.5 },
    { type: 'float', key: 'pref_culture', default: 0.5 },
    { type: 'float', key: 'pref_nightlife', default: 0.5 },
    { type: 'float', key: 'pref_nature', default: 0.5 },
    { type: 'float', key: 'pref_food', default: 0.5 },
    { type: 'boolean', key: 'has_completed_onboarding', default: false },
  ];

  for (const attr of prefAttrs) {
    process.stdout.write(`  attr: ${attr.key}...`);
    await createAttribute('user_preferences', attr);
    console.log(' ✓');
  }

  // 4. Swipe History
  console.log('Creating swipe_history collection...');
  await api('POST', basePath, {
    collectionId: 'swipe_history',
    name: 'Swipe History',
    permissions: [
      'create("users")',
      'read("users")',
    ],
  });

  const swipeAttrs: AttrDef[] = [
    { type: 'string', key: 'user_id', size: 100, required: true },
    { type: 'string', key: 'destination_id', size: 100, required: true },
    { type: 'string', key: 'action', size: 20, required: true },
    { type: 'integer', key: 'time_spent_ms' },
    { type: 'float', key: 'price_shown' },
  ];

  for (const attr of swipeAttrs) {
    process.stdout.write(`  attr: ${attr.key}...`);
    await createAttribute('swipe_history', attr);
    console.log(' ✓');
  }

  // 5. Cached Prices
  console.log('Creating cached_prices collection...');
  await api('POST', basePath, {
    collectionId: 'cached_prices',
    name: 'Cached Prices',
    permissions: ['read("any")'],
  });

  const priceAttrs: AttrDef[] = [
    { type: 'string', key: 'origin', size: 10, required: true },
    { type: 'string', key: 'destination_iata', size: 10, required: true },
    { type: 'float', key: 'price', required: true },
    { type: 'string', key: 'currency', size: 10, default: 'USD' },
    { type: 'string', key: 'airline', size: 100 },
    { type: 'string', key: 'duration', size: 20 },
    { type: 'string', key: 'source', size: 50 },
    { type: 'string', key: 'departure_date', size: 20 },
    { type: 'string', key: 'return_date', size: 20 },
    { type: 'integer', key: 'trip_duration_days' },
    { type: 'float', key: 'previous_price' },
    { type: 'string', key: 'price_direction', size: 10 },
    { type: 'string', key: 'fetched_at', size: 30 },
  ];

  for (const attr of priceAttrs) {
    process.stdout.write(`  attr: ${attr.key}...`);
    await createAttribute('cached_prices', attr);
    console.log(' ✓');
  }

  // Wait for attributes to be available before creating indexes
  console.log('\nWaiting 5s for attributes to propagate...');
  await new Promise((r) => setTimeout(r, 5000));

  // Indexes
  console.log('Creating indexes...');
  await createIndex('destinations', 'idx_active', 'key', ['is_active']);
  console.log('  ✓ destinations.is_active');
  await createIndex('destinations', 'idx_iata', 'key', ['iata_code']);
  console.log('  ✓ destinations.iata_code');
  await createIndex('saved_trips', 'idx_user', 'key', ['user_id']);
  console.log('  ✓ saved_trips.user_id');
  await createIndex('swipe_history', 'idx_swipe_user', 'key', ['user_id']);
  console.log('  ✓ swipe_history.user_id');
  await createIndex('cached_prices', 'idx_price_origin', 'key', ['origin']);
  console.log('  ✓ cached_prices.origin');
  await createIndex('user_preferences', 'idx_pref_user', 'unique', ['user_id']);
  console.log('  ✓ user_preferences.user_id (unique)');
}

async function main() {
  console.log('=== SoGoJet Appwrite Setup ===\n');
  await createDatabase();
  await createCollections();
  console.log('\n✓ Setup complete!');
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
