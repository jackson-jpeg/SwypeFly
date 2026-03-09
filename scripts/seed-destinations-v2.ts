/**
 * Seeds 100+ new destinations (V2 expansion) into Appwrite.
 * Safe to re-run — skips destinations with existing IATA codes.
 *
 * Usage: npx tsx scripts/seed-destinations-v2.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Client, Databases, Query } from 'node-appwrite';
import { destinationsV2 } from '../data/destinations-v2';

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '';
const projectId =
  process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '';
const apiKey = process.env.APPWRITE_API_KEY ?? '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new Databases(client);
const DB = 'sogojet';

async function main() {
  // Get existing IATA codes to skip duplicates
  const existingResult = await db.listDocuments(DB, 'destinations', [Query.limit(500)]);
  const existingIatas = new Set(existingResult.documents.map((d) => d.iata_code as string));

  let created = 0;
  let skipped = 0;

  for (const dest of destinationsV2) {
    if (existingIatas.has(dest.iataCode)) {
      console.log(`⊘ ${dest.city} (${dest.iataCode}) already exists`);
      skipped++;
      continue;
    }

    try {
      await db.createDocument(DB, 'destinations', dest.id, {
        iata_code: dest.iataCode,
        city: dest.city,
        country: dest.country,
        tagline: dest.tagline,
        description: dest.description,
        vibe_tags: dest.vibeTags,
        best_months: dest.bestMonths,
        average_temp: dest.averageTemp,
        flight_price: dest.flightPrice,
        hotel_price_per_night: dest.hotelPricePerNight,
        flight_duration: dest.flightDuration,
        currency: dest.currency,
        latitude: dest.latitude,
        longitude: dest.longitude,
        is_active: true,
        image_url: '',
      });
      console.log(`✓ ${dest.city} (${dest.iataCode})`);
      created++;
    } catch (err: any) {
      if (err?.code === 409 || err?.message?.includes('already exists')) {
        console.log(`⊘ ${dest.city} (${dest.iataCode}) already exists`);
        skipped++;
      } else {
        console.error(`✗ ${dest.city}:`, err?.message || err);
      }
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

main().catch(console.error);
