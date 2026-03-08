/**
 * Creates Appwrite attributes on `cached_prices` for Duffel offer caching:
 * - offer_json (string, 10000 chars) — serialized Duffel offer for tap-through
 * - offer_expires_at (string, 30 chars) — ISO datetime when offer expires
 * - flight_number (string, 20 chars) — flight number for display
 *
 * Safe to re-run — skips attributes that already exist.
 *
 * Usage: npx tsx scripts/setup-duffel-price-attrs.ts
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
  await createAttr('cached_prices', 'offer_json', () =>
    db.createStringAttribute(DB, 'cached_prices', 'offer_json', 10000, false),
  );
  await createAttr('cached_prices', 'offer_expires_at', () =>
    db.createStringAttribute(DB, 'cached_prices', 'offer_expires_at', 30, false),
  );
  await createAttr('cached_prices', 'flight_number', () =>
    db.createStringAttribute(DB, 'cached_prices', 'flight_number', 20, false),
  );

  console.log('\nDone. Attributes may take a few seconds to become available.');
}

main().catch(console.error);
