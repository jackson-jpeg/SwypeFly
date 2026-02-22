/**
 * Refresh all destination images using Pexels API with smart query fallbacks.
 * Run: npx tsx scripts/refresh-images-pexels.ts
 * Options:
 *   --dry-run     Preview queries without updating Appwrite
 *   --only=Paris  Only process a specific city
 *   --skip=10     Skip first N destinations
 */
import fs from 'fs';
import path from 'path';
import { Client, Databases, Query } from 'node-appwrite';

// ─── Load env ─────────────────────────────────────────────────
for (const f of ['.env', '.env.local']) {
  const p = path.resolve(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf-8').split('\n')) {
    const t = l.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...r] = t.split('=');
    process.env[k.trim()] = r.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const PEXELS_KEY = process.env.PEXELS_API_KEY || '4VjqfnzOEd1t5fimxXoR63CfCG8aWRo9NIwMLBsmuksdIVsTr1gn9rTu';
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const db = new Databases(client);

const DATABASE_ID = 'sogojet';
const COLLECTION_ID = 'destinations';

// ─── Args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RETRY_EMPTY = args.includes('--retry-empty');
const onlyCity = args.find(a => a.startsWith('--only='))?.split('=')[1];
const skip = parseInt(args.find(a => a.startsWith('--skip='))?.split('=')[1] || '0');

// ─── Pexels API ───────────────────────────────────────────────
interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    landscape: string;
  };
}

interface PexelsResponse {
  total_results: number;
  photos: PexelsPhoto[];
}

async function searchPexels(query: string, perPage = 5, retries = 3): Promise<PexelsPhoto[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=large`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_KEY },
    });
    if (res.status === 429) {
      const waitSec = 30 * (attempt + 1);
      console.log(`  ⏳ Rate limited on "${query}", waiting ${waitSec}s (attempt ${attempt + 1}/${retries + 1})`);
      await sleep(waitSec * 1000);
      continue;
    }
    if (!res.ok) {
      console.error(`  Pexels error ${res.status} for "${query}"`);
      return [];
    }
    const data = (await res.json()) as PexelsResponse;
    return data.photos || [];
  }
  console.error(`  Pexels exhausted retries for "${query}"`);
  return [];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Query strategy ───────────────────────────────────────────
function buildQueries(city: string, country: string): string[] {
  return [
    `${city} ${country} travel landscape`,
    `${city} ${country} aerial`,
    `${city} skyline`,
    `${city} ${country} landmark`,
    `${city} ${country}`,
  ];
}

function pickBestPhotos(allPhotos: PexelsPhoto[], count: number): PexelsPhoto[] {
  // Deduplicate by photographer to get variety
  const seen = new Set<number>();
  const unique: PexelsPhoto[] = [];
  for (const p of allPhotos) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      unique.push(p);
    }
  }

  // Prefer landscape-oriented, high-res photos
  unique.sort((a, b) => {
    const aRatio = a.width / a.height;
    const bRatio = b.width / b.height;
    // Prefer wider aspect ratios (landscape)
    const aScore = (aRatio >= 1.3 ? 2 : 0) + (a.width >= 3000 ? 1 : 0);
    const bScore = (bRatio >= 1.3 ? 2 : 0) + (b.width >= 3000 ? 1 : 0);
    return bScore - aScore;
  });

  return unique.slice(0, count);
}

function photoUrl(photo: PexelsPhoto): string {
  // Use large2x for hero, add Pexels optimization params
  return photo.src.large2x || photo.src.large || photo.src.original;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`🔍 Pexels Image Refresh ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('─'.repeat(60));

  // Fetch all destinations
  const allDocs: any[] = [];
  let offset = 0;
  while (true) {
    const batch = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.limit(100),
      Query.offset(offset),
      Query.orderAsc('city'),
    ]);
    allDocs.push(...batch.documents);
    if (allDocs.length >= batch.total) break;
    offset += 100;
  }

  console.log(`Found ${allDocs.length} destinations\n`);

  let filtered = allDocs;
  if (RETRY_EMPTY) {
    filtered = allDocs.filter(d => !d.image_url || d.image_urls?.length === 0 || d.image_url.includes('pexels') === false);
    // Actually, check for ones that still have old non-pexels URLs or empty
    filtered = allDocs.filter(d => {
      const urls = d.image_urls || [];
      return urls.length === 0;
    });
    console.log(`Retrying ${filtered.length} destinations with no images\n`);
  }
  if (onlyCity) {
    filtered = allDocs.filter(d => d.city.toLowerCase() === onlyCity.toLowerCase());
    console.log(`Filtering to: ${onlyCity} (${filtered.length} found)\n`);
  }
  if (skip > 0) {
    filtered = filtered.slice(skip);
    console.log(`Skipping first ${skip}, processing ${filtered.length}\n`);
  }

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < filtered.length; i++) {
    const dest = filtered[i];
    const city = dest.city;
    const country = dest.country;
    console.log(`[${i + 1}/${filtered.length}] ${city}, ${country}`);

    const queries = buildQueries(city, country);
    let allPhotos: PexelsPhoto[] = [];

    for (const query of queries) {
      const photos = await searchPexels(query, 5);
      console.log(`  "${query}" → ${photos.length} results`);
      allPhotos.push(...photos);

      // If we have enough good photos after first 2 queries, stop
      if (allPhotos.length >= 8 && queries.indexOf(query) >= 1) break;

      await sleep(1500); // Rate limit respect
    }

    if (allPhotos.length === 0) {
      console.log(`  ⚠ No photos found! Skipping.`);
      failed++;
      continue;
    }

    const best = pickBestPhotos(allPhotos, 5);
    const heroUrl = photoUrl(best[0]);
    const additionalUrls = best.slice(1).map(photoUrl);

    console.log(`  ✓ Selected ${best.length} photos (hero: ${best[0].photographer})`);

    if (!DRY_RUN) {
      try {
        await db.updateDocument(DATABASE_ID, COLLECTION_ID, dest.$id, {
          image_url: heroUrl,
          image_urls: additionalUrls,
        });
        updated++;
      } catch (e: any) {
        console.log(`  ✗ Update failed: ${e.message}`);
        failed++;
      }
    } else {
      console.log(`  [DRY] Hero: ${heroUrl.slice(0, 80)}...`);
      console.log(`  [DRY] +${additionalUrls.length} additional`);
      updated++;
    }

    // 2s delay between destinations
    if (i < filtered.length - 1) await sleep(2000);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Done! Updated: ${updated}, Failed: ${failed}, Total: ${filtered.length}`);
}

main().catch(console.error);
