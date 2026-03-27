/**
 * Seeds batch 4 destinations into Supabase.
 * Safe to re-run — upserts on iata_code.
 *
 * Usage: npx tsx scripts/seed-batch4.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { destinationsBatch4 } from '../data/destinations-batch4';

const supabaseUrl = (process.env.SUPABASE_URL ?? '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`Seeding ${destinationsBatch4.length} destinations...\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const dest of destinationsBatch4) {
    // Check if iata_code already exists
    const { data: existing } = await supabase
      .from('destinations')
      .select('id')
      .eq('iata_code', dest.iataCode)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  ⊘ ${dest.city} (${dest.iataCode}) already exists`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('destinations').insert({
      id: dest.id,
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

    if (error) {
      console.error(`  ✗ ${dest.city} (${dest.iataCode}): ${error.message}`);
      errors++;
    } else {
      console.log(`  ✓ ${dest.city} (${dest.iataCode})`);
      created++;
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`Total destinations now: ${243 + created}`);
}

main().catch(console.error);
