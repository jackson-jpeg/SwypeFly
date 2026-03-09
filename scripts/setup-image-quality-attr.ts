/**
 * Adds quality_score float attribute to destination_images collection.
 * Safe to re-run — skips if attribute already exists.
 *
 * Usage: npx tsx scripts/setup-image-quality-attr.ts
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
const COLL = 'destination_images';

async function createAttr(key: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`✓ Created ${COLL}.${key}`);
  } catch (err: any) {
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      console.log(`⊘ ${COLL}.${key} already exists`);
    } else {
      console.error(`✗ ${COLL}.${key}:`, err?.message || err);
    }
  }
}

async function main() {
  console.log('Adding quality_score to destination_images...');
  await createAttr('quality_score', () =>
    db.createFloatAttribute(DB, COLL, 'quality_score', false, undefined, undefined, 0),
  );
  console.log('Done.');
}

main().catch(console.error);
