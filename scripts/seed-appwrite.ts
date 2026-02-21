/**
 * Seed destinations into Appwrite from the local destination catalog.
 * Uses curl subprocess since Node.js fetch may not reach external hosts.
 * Run: npx tsx scripts/seed-appwrite.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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
const DB = 'sogojet';

function apiCurl(method: string, apiPath: string, body?: unknown): unknown {
  const url = `${ENDPOINT}${apiPath}`;
  const args = [
    'curl', '-s', '-X', method, url,
    '-H', `X-Appwrite-Project: ${PROJECT_ID}`,
    '-H', `X-Appwrite-Key: ${API_KEY}`,
    '-H', 'Content-Type: application/json',
  ];
  if (body) {
    args.push('-d', JSON.stringify(body));
  }
  const result = execSync(args.join(' '), {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024,
    // Must use shell to handle the long API key
    shell: '/bin/bash',
  });
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

async function main() {
  const { destinations } = await import('../data/destinations');

  console.log(`Seeding ${destinations.length} destinations into Appwrite...\n`);

  let success = 0;
  let skipped = 0;

  for (const d of destinations) {
    process.stdout.write(`  ${d.city}, ${d.country}...`);

    const doc = {
      iata_code: d.iataCode,
      city: d.city,
      country: d.country,
      continent: '',
      tagline: d.tagline || '',
      description: (d.description || '').slice(0, 2000),
      image_url: d.imageUrl || '',
      image_urls: d.imageUrls || [],
      flight_price: d.flightPrice,
      hotel_price_per_night: d.hotelPricePerNight || 0,
      currency: d.currency || 'USD',
      vibe_tags: d.vibeTags || [],
      rating: d.rating || 0,
      review_count: d.reviewCount || 0,
      best_months: d.bestMonths || [],
      average_temp: d.averageTemp || 0,
      flight_duration: d.flightDuration || '',
      available_flight_days: d.available_flight_days || [],
      is_active: true,
      beach_score: 0,
      city_score: 0,
      adventure_score: 0,
      culture_score: 0,
      nightlife_score: 0,
      nature_score: 0,
      food_score: 0,
      popularity_score: Math.min(d.reviewCount || 0, 100),
      itinerary_json: JSON.stringify(d.itinerary || []),
      restaurants_json: JSON.stringify(d.restaurants || []),
    };

    // Auto-assign feature vectors based on vibe tags
    const tags = (d.vibeTags || []).map((t: string) => t.toLowerCase());
    if (tags.includes('beach') || tags.includes('tropical')) doc.beach_score = 0.8;
    if (tags.includes('city') || tags.includes('nightlife')) { doc.city_score = 0.8; doc.nightlife_score = 0.6; }
    if (tags.includes('adventure')) doc.adventure_score = 0.8;
    if (tags.includes('culture') || tags.includes('historic')) doc.culture_score = 0.8;
    if (tags.includes('nature') || tags.includes('mountain')) doc.nature_score = 0.8;
    if (tags.includes('foodie')) doc.food_score = 0.8;
    if (tags.includes('luxury') || tags.includes('romantic')) { doc.city_score = Math.max(doc.city_score, 0.5); }
    if (tags.includes('budget')) doc.beach_score = Math.max(doc.beach_score, 0.4);

    try {
      // Write body to a temp file to avoid shell quoting issues
      const tmpFile = `/tmp/seed-doc-${d.id}.json`;
      fs.writeFileSync(tmpFile, JSON.stringify({
        documentId: d.id,
        data: doc,
      }));

      const result = execSync(
        `curl -s -X POST "${ENDPOINT}/databases/${DB}/collections/destinations/documents" ` +
        `-H "X-Appwrite-Project: ${PROJECT_ID}" ` +
        `-H "X-Appwrite-Key: ${API_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${tmpFile}`,
        { encoding: 'utf-8', maxBuffer: 1024 * 1024 },
      );

      fs.unlinkSync(tmpFile);

      const parsed = JSON.parse(result);
      if (parsed.$id) {
        console.log(' ✓');
        success++;
      } else if (parsed.code === 409) {
        console.log(' (exists)');
        skipped++;
      } else {
        console.log(` ERROR: ${parsed.message || result}`);
      }
    } catch (err: unknown) {
      console.log(` FAIL: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n✓ Seeded: ${success}, Skipped: ${skipped}, Total: ${destinations.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
