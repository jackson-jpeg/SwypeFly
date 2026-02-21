/**
 * Seed feature vectors for existing destinations in Appwrite.
 * Derives beach_score, city_score, etc. from existing vibe_tags,
 * continent from country.
 *
 * Run: npx tsx scripts/seed-feature-vectors.ts
 */
import { Client, Databases, Query } from 'node-appwrite';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local
for (const envFile of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!process.env[key.trim()]) process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new Databases(client);
const DB = 'sogojet';

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  indonesia: 'Asia', japan: 'Asia', thailand: 'Asia', singapore: 'Asia',
  'south korea': 'Asia', vietnam: 'Asia', maldives: 'Asia', india: 'Asia',
  china: 'Asia', malaysia: 'Asia', philippines: 'Asia', cambodia: 'Asia',
  'sri lanka': 'Asia', nepal: 'Asia',
  greece: 'Europe', croatia: 'Europe', italy: 'Europe', portugal: 'Europe',
  iceland: 'Europe', switzerland: 'Europe', spain: 'Europe', france: 'Europe',
  uk: 'Europe', germany: 'Europe', netherlands: 'Europe', turkey: 'Europe',
  'czech republic': 'Europe', austria: 'Europe', norway: 'Europe', sweden: 'Europe',
  ireland: 'Europe', hungary: 'Europe', denmark: 'Europe', finland: 'Europe',
  poland: 'Europe', belgium: 'Europe', scotland: 'Europe',
  usa: 'North America', canada: 'North America', mexico: 'North America',
  jamaica: 'Caribbean', 'dominican republic': 'Caribbean', bahamas: 'Caribbean',
  'puerto rico': 'Caribbean', cuba: 'Caribbean', barbados: 'Caribbean',
  'st. lucia': 'Caribbean', aruba: 'Caribbean', 'turks & caicos': 'Caribbean',
  'us virgin islands': 'Caribbean', 'cayman islands': 'Caribbean',
  peru: 'South America', argentina: 'South America', brazil: 'South America',
  colombia: 'South America', chile: 'South America', 'costa rica': 'Central America',
  ecuador: 'South America', panama: 'Central America', belize: 'Central America',
  guatemala: 'Central America',
  morocco: 'Africa', 'south africa': 'Africa', egypt: 'Africa', kenya: 'Africa',
  tanzania: 'Africa', uae: 'Middle East', jordan: 'Middle East', israel: 'Middle East',
  australia: 'Oceania', 'new zealand': 'Oceania', fiji: 'Oceania',
  'french polynesia': 'Oceania',
};

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
    culture_score: 0, nightlife_score: 0, nature_score: 0,
  };
  for (const tag of vibeTags) {
    const mapping = TAG_TO_FEATURES[tag];
    if (!mapping) continue;
    for (const [key, val] of Object.entries(mapping)) {
      if (key in features) features[key] = Math.max(features[key], val);
    }
  }
  return features;
}

async function main() {
  const result = await db.listDocuments(DB, 'destinations', [
    Query.equal('is_active', true),
    Query.limit(500),
  ]);

  console.log(`Updating feature vectors for ${result.documents.length} destinations...`);

  let updated = 0;
  for (const dest of result.documents) {
    const vibeTags = (dest.vibe_tags as string[]) || [];
    const features = deriveFeatures(vibeTags);
    const continent = COUNTRY_TO_CONTINENT[(dest.country as string).toLowerCase()] || 'Other';

    try {
      await db.updateDocument(DB, 'destinations', dest.$id, {
        continent,
        ...features,
      });
      updated++;
    } catch (err) {
      console.error(`Failed to update ${dest.$id}:`, err);
    }
  }

  console.log(`Successfully updated ${updated}/${result.documents.length} destinations.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
