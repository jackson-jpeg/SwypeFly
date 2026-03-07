/**
 * Creates the Appwrite attributes needed for Duffel Stays integration:
 * - destinations: latitude (float), longitude (float)
 * - cached_hotel_prices: hotels_json (string, 10000 chars)
 *
 * Safe to re-run — skips attributes that already exist.
 *
 * Usage: npx tsx scripts/setup-appwrite-attrs.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Client, Databases } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '';
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '';
const apiKey = process.env.APPWRITE_API_KEY ?? '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new Databases(client);
const DB = 'sogojet';

async function createAttr(collection: string, key: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`✓ Created ${collection}.${key}`);
  } catch (err: any) {
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      console.log(`⊘ ${collection}.${key} already exists`);
    } else {
      console.error(`✗ ${collection}.${key}:`, err?.message || err);
    }
  }
}

async function main() {
  await createAttr('destinations', 'latitude', () =>
    db.createFloatAttribute(DB, 'destinations', 'latitude', false),
  );
  await createAttr('destinations', 'longitude', () =>
    db.createFloatAttribute(DB, 'destinations', 'longitude', false),
  );
  await createAttr('cached_hotel_prices', 'hotels_json', () =>
    db.createStringAttribute(DB, 'cached_hotel_prices', 'hotels_json', 10000, false),
  );

  console.log('\nDone. Attributes may take a few seconds to become available.');
  console.log('Next: npx tsx scripts/seed-destination-coords.ts');
}

main().catch(console.error);
