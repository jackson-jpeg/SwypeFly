/**
 * Seed destinations into Supabase from the local destination catalog.
 * Run: npx tsx scripts/seed-destinations.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Import destinations — we use dynamic import since data/destinations.ts uses TS path aliases
// Instead, inline-require the compiled module
async function main() {
  // Dynamic import of the destinations file
  const { destinations } = await import('../data/destinations');

  console.log(`Seeding ${destinations.length} destinations...`);

  const rows = destinations.map((d) => ({
    id: d.id,
    iata_code: d.iataCode,
    city: d.city,
    country: d.country,
    tagline: d.tagline,
    description: d.description,
    image_url: d.imageUrl,
    image_urls: d.imageUrls || [],
    flight_price: d.flightPrice,
    hotel_price_per_night: d.hotelPricePerNight,
    currency: d.currency,
    vibe_tags: d.vibeTags,
    rating: d.rating,
    review_count: d.reviewCount,
    best_months: d.bestMonths,
    average_temp: d.averageTemp,
    flight_duration: d.flightDuration,
    available_flight_days: d.available_flight_days || [],
    itinerary: d.itinerary || [],
    restaurants: d.restaurants || [],
    is_active: true,
  }));

  const { data, error } = await supabase
    .from('destinations')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`Successfully seeded ${rows.length} destinations.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
