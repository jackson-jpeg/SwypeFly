/**
 * Seed feature vectors for existing destinations.
 * Derives beach_score, city_score, etc. from existing vibe_tags,
 * continent from country, and budget_level from flight_price.
 *
 * Run: npx tsx scripts/seed-feature-vectors.ts
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

// ─── Continent mapping ──────────────────────────────────────────────

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // Asia
  indonesia: 'Asia', japan: 'Asia', thailand: 'Asia', singapore: 'Asia',
  'south korea': 'Asia', vietnam: 'Asia', maldives: 'Asia', india: 'Asia',
  china: 'Asia', malaysia: 'Asia', philippines: 'Asia', cambodia: 'Asia',
  'sri lanka': 'Asia', nepal: 'Asia',
  // Europe
  greece: 'Europe', croatia: 'Europe', italy: 'Europe', portugal: 'Europe',
  iceland: 'Europe', switzerland: 'Europe', spain: 'Europe', france: 'Europe',
  uk: 'Europe', germany: 'Europe', netherlands: 'Europe', turkey: 'Europe',
  'czech republic': 'Europe', austria: 'Europe', norway: 'Europe', sweden: 'Europe',
  ireland: 'Europe', hungary: 'Europe', denmark: 'Europe', finland: 'Europe',
  poland: 'Europe', belgium: 'Europe', scotland: 'Europe',
  // North America
  usa: 'North America', canada: 'North America', mexico: 'North America',
  // Caribbean
  jamaica: 'Caribbean', 'dominican republic': 'Caribbean', bahamas: 'Caribbean',
  'puerto rico': 'Caribbean', cuba: 'Caribbean', barbados: 'Caribbean',
  'st. lucia': 'Caribbean', aruba: 'Caribbean', 'turks & caicos': 'Caribbean',
  'us virgin islands': 'Caribbean', 'cayman islands': 'Caribbean',
  // Central & South America
  peru: 'South America', argentina: 'South America', brazil: 'South America',
  colombia: 'South America', chile: 'South America', 'costa rica': 'Central America',
  ecuador: 'South America', panama: 'Central America', belize: 'Central America',
  guatemala: 'Central America',
  // Africa / Middle East
  morocco: 'Africa', 'south africa': 'Africa', egypt: 'Africa', kenya: 'Africa',
  tanzania: 'Africa', uae: 'Middle East', jordan: 'Middle East', israel: 'Middle East',
  // Oceania
  australia: 'Oceania', 'new zealand': 'Oceania', fiji: 'Oceania',
  'french polynesia': 'Oceania',
};

function getContinent(country: string): string {
  return COUNTRY_TO_CONTINENT[country.toLowerCase()] || 'Other';
}

// ─── Feature vector derivation from vibe_tags ───────────────────────

const TAG_TO_FEATURES: Record<string, Record<string, number>> = {
  beach:     { beach_score: 0.9, nature_score: 0.3 },
  tropical:  { beach_score: 0.7, nature_score: 0.5 },
  mountain:  { adventure_score: 0.6, nature_score: 0.9 },
  nature:    { nature_score: 0.9, adventure_score: 0.3 },
  adventure: { adventure_score: 0.9, nature_score: 0.4 },
  city:      { city_score: 0.9, nightlife_score: 0.4 },
  nightlife: { nightlife_score: 0.9, city_score: 0.5 },
  culture:   { culture_score: 0.9, food_score: 0.3 },
  historic:  { culture_score: 0.7, city_score: 0.2 },
  foodie:    { food_score: 0.9, culture_score: 0.3 },
  romantic:  { beach_score: 0.3, culture_score: 0.2 },
  luxury:    { city_score: 0.3 },
  winter:    { adventure_score: 0.5, nature_score: 0.6 },
  budget:    {},
};

function deriveFeatures(vibeTags: string[]): Record<string, number> {
  const features: Record<string, number> = {
    beach_score: 0, city_score: 0, adventure_score: 0,
    culture_score: 0, nightlife_score: 0, nature_score: 0, food_score: 0,
  };

  for (const tag of vibeTags) {
    const mapping = TAG_TO_FEATURES[tag];
    if (!mapping) continue;
    for (const [key, val] of Object.entries(mapping)) {
      features[key] = Math.max(features[key], val);
    }
  }

  return features;
}

function deriveBudgetLevel(flightPrice: number): number {
  if (flightPrice <= 400) return 1;  // Budget
  if (flightPrice <= 800) return 2;  // Mid-range
  if (flightPrice <= 1200) return 3; // Upper mid
  return 4;                          // Luxury
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const { data: destinations, error } = await supabase
    .from('destinations')
    .select('id, country, vibe_tags, flight_price')
    .eq('is_active', true);

  if (error || !destinations) {
    console.error('Failed to fetch destinations:', error?.message);
    process.exit(1);
  }

  console.log(`Updating feature vectors for ${destinations.length} destinations...`);

  let updated = 0;
  for (const dest of destinations) {
    const features = deriveFeatures(dest.vibe_tags || []);
    const continent = getContinent(dest.country);
    const budget = deriveBudgetLevel(dest.flight_price);

    const { error: updateErr } = await supabase
      .from('destinations')
      .update({
        continent,
        ...features,
        budget_level: budget,
      })
      .eq('id', dest.id);

    if (updateErr) {
      console.error(`Failed to update ${dest.id}:`, updateErr.message);
    } else {
      updated++;
    }
  }

  console.log(`Successfully updated ${updated}/${destinations.length} destinations.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
