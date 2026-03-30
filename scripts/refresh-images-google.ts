/**
 * Refresh destination images using Google Places API (New).
 * 
 * Strategy:
 * 1. One Text Search per destination → get place ID + photo references
 * 2. Filter photos: prefer landscape (w > h), large resolution, skip portraits
 * 3. Resolve photo URIs at 1200px wide (good for mobile hero cards)
 * 4. Pick top 5 landscape photos per destination
 * 
 * Cost estimate: ~$14 for 206 destinations (one-time)
 * 
 * Run: npx tsx scripts/refresh-images-google.ts
 * Flags:
 *   --dry-run         Preview without updating Appwrite
 *   --only=Barcelona  Process single city
 *   --skip=N          Skip first N
 *   --retry-stale     Only process destinations not updated today
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

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_API_KEY) throw new Error('GOOGLE_PLACES_API_KEY env var is required');
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);
const db = new Databases(client);

const DATABASE_ID = 'sogojet';
const COLLECTION_ID = 'destinations';

// ─── Args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RETRY_STALE = args.includes('--retry-stale');
const onlyCity = args.find(a => a.startsWith('--only='))?.split('=')[1];
const skip = parseInt(args.find(a => a.startsWith('--skip='))?.split('=')[1] || '0');

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Google Places API ────────────────────────────────────────

interface PlacePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
  authorAttributions: { displayName: string }[];
}

interface PlaceResult {
  id: string;
  displayName: { text: string };
  photos?: PlacePhoto[];
}

/**
 * Search for a destination and return photo references.
 * We request up to 10 photos per place to have selection room.
 * 
 * Key: we use a very specific query to ensure we get THE city/destination,
 * not a restaurant or hotel with the same name.
 */
async function searchPlace(city: string, country: string): Promise<PlacePhoto[]> {
  // Build a precise query — "city, country" as a destination
  const query = `${city}, ${country}`;
  
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      // Only request what we need to minimize cost
      'X-Goog-FieldMask': 'places.id,places.displayName,places.photos,places.types',
    },
    body: JSON.stringify({
      textQuery: query,
      // Bias toward locality/geographic results, not businesses
      includedType: 'locality',
      maxResultCount: 1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ Google API error ${res.status}: ${err.slice(0, 200)}`);
    return [];
  }

  const data = await res.json() as { places?: PlaceResult[] };
  const place = data.places?.[0];
  
  if (!place) {
    // Fallback: try without includedType (some destinations aren't "locality" — 
    // e.g. Machu Picchu, Patagonia, Swiss Alps)
    return searchPlaceFallback(city, country);
  }

  console.log(`  📍 Found: ${place.displayName.text} (${place.photos?.length || 0} photos)`);
  return place.photos || [];
}

async function searchPlaceFallback(city: string, country: string): Promise<PlacePhoto[]> {
  const query = `${city} ${country} travel destination`;
  
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.photos',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 1,
    }),
  });

  if (!res.ok) return [];
  const data = await res.json() as { places?: PlaceResult[] };
  const place = data.places?.[0];
  
  if (!place) {
    console.log(`  ⚠ No place found even with fallback`);
    return [];
  }

  console.log(`  📍 Fallback found: ${place.displayName.text} (${place.photos?.length || 0} photos)`);
  return place.photos || [];
}

/**
 * Filter and rank photos for best travel hero images:
 * - MUST be landscape (width > height) — portrait photos look terrible on cards
 * - Prefer wider aspect ratios (16:9 > 4:3)
 * - Prefer higher resolution
 * - Minimum 800px wide
 */
function rankPhotos(photos: PlacePhoto[]): PlacePhoto[] {
  return photos
    .filter(p => {
      // Must be landscape
      if (p.widthPx <= p.heightPx) return false;
      // Must be reasonably sized
      if (p.widthPx < 800) return false;
      return true;
    })
    .sort((a, b) => {
      const aRatio = a.widthPx / a.heightPx;
      const bRatio = b.widthPx / b.heightPx;
      // Score: aspect ratio closeness to 16:9 (1.78) + resolution bonus
      const aScore = -Math.abs(aRatio - 1.6) + (a.widthPx / 10000);
      const bScore = -Math.abs(bRatio - 1.6) + (b.widthPx / 10000);
      return bScore - aScore;
    });
}

/**
 * Resolve a photo reference to an actual URL.
 * Uses skipHttpRedirect to get the URL without following the redirect.
 * Requests 1200px wide — good balance of quality vs load time for mobile.
 */
async function resolvePhotoUrl(photoName: string, maxWidth = 1200): Promise<string | null> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}&skipHttpRedirect=true`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  ✗ Photo resolve failed: ${res.status}`);
    return null;
  }
  const data = await res.json() as { photoUri?: string };
  return data.photoUri || null;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`🌍 Google Places Image Refresh ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('─'.repeat(60));

  // Fetch all destinations
  const allDocs: any[] = [];
  let offset = 0;
  while (true) {
    const batch = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.limit(100), Query.offset(offset), Query.orderAsc('city'),
    ]);
    allDocs.push(...batch.documents);
    if (allDocs.length >= batch.total) break;
    offset += 100;
  }

  console.log(`Found ${allDocs.length} destinations\n`);

  let filtered = allDocs;

  if (RETRY_STALE) {
    const today = new Date().toISOString().slice(0, 10);
    filtered = allDocs.filter(d => !d.$updatedAt.startsWith(today));
    console.log(`Retrying ${filtered.length} stale destinations\n`);
  }
  if (onlyCity) {
    filtered = filtered.filter(d => d.city.toLowerCase() === onlyCity.toLowerCase());
    console.log(`Filtering to: ${onlyCity} (${filtered.length} found)\n`);
  }
  if (skip > 0) {
    filtered = filtered.slice(skip);
    console.log(`Skipping first ${skip}, processing ${filtered.length}\n`);
  }

  let updated = 0, failed = 0, photoApiCalls = 0, searchApiCalls = 0;

  for (let i = 0; i < filtered.length; i++) {
    const dest = filtered[i];
    console.log(`[${i + 1}/${filtered.length}] ${dest.city}, ${dest.country}`);

    // Step 1: Search for the place
    searchApiCalls++;
    const photos = await searchPlace(dest.city, dest.country);

    if (photos.length === 0) {
      console.log(`  ⚠ No photos available`);
      failed++;
      continue;
    }

    // Step 2: Rank and pick best landscape photos
    const ranked = rankPhotos(photos);
    
    if (ranked.length === 0) {
      // If no landscape photos, take the widest ones anyway
      console.log(`  ⚠ No landscape photos, using best available`);
      photos.sort((a, b) => (b.widthPx / b.heightPx) - (a.widthPx / a.heightPx));
    }

    const selected = (ranked.length > 0 ? ranked : photos).slice(0, 5);
    console.log(`  🖼  Selected ${selected.length} photos (${ranked.length} landscape of ${photos.length} total)`);

    // Step 3: Resolve photo URLs — hero at 1200px, rest at 1200px too
    const urls: string[] = [];
    for (const photo of selected) {
      photoApiCalls++;
      const url = await resolvePhotoUrl(photo.name, 1200);
      if (url) {
        urls.push(url);
        if (DRY_RUN) console.log(`    ${photo.widthPx}x${photo.heightPx} → ${url.slice(0, 80)}...`);
      }
      // Tiny delay between photo resolves
      await sleep(100);
    }

    if (urls.length === 0) {
      console.log(`  ✗ All photo resolves failed`);
      failed++;
      continue;
    }

    const heroUrl = urls[0];
    const additionalUrls = urls.slice(1);

    console.log(`  ✓ ${urls.length} URLs resolved (by ${selected.map(p => p.authorAttributions[0]?.displayName || '?').join(', ')})`);

    if (!DRY_RUN) {
      try {
        await db.updateDocument(DATABASE_ID, COLLECTION_ID, dest.$id, {
          image_url: heroUrl,
          image_urls: additionalUrls,
        });
        updated++;
      } catch (e: any) {
        console.log(`  ✗ Appwrite update failed: ${e.message}`);
        failed++;
      }
    } else {
      updated++;
    }

    // Small delay between destinations
    await sleep(200);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Done!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Search API calls: ${searchApiCalls} (~$${(searchApiCalls * 0.032).toFixed(2)})`);
  console.log(`  Photo API calls: ${photoApiCalls} (~$${(photoApiCalls * 0.007).toFixed(2)})`);
  console.log(`  Estimated cost: ~$${(searchApiCalls * 0.032 + photoApiCalls * 0.007).toFixed(2)}`);
}

main().catch(console.error);
