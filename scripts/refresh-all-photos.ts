/**
 * Refresh ALL destination photos with high-quality Unsplash+ images.
 *
 * Usage:
 *   UNSPLASH_ACCESS_KEY=MiXdWSsNVKc2brPZDo6U3H66FsgAEhAfoCPMADTuMps \
 *   APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1 \
 *   APPWRITE_PROJECT_ID=sogojet \
 *   APPWRITE_API_KEY=<your-api-key> \
 *   npx tsx scripts/refresh-all-photos.ts
 */

import { Client, Databases, Query, ID } from 'node-appwrite';

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || 'MiXdWSsNVKc2brPZDo6U3H66FsgAEhAfoCPMADTuMps';
const UNSPLASH_BASE = 'https://api.unsplash.com';
const DATABASE_ID = 'sogojet';
const IMAGES_PER_DEST = 6;
const DELAY_MS = 1500; // Rate limit: be conservative to avoid 403s

// Appwrite setup
const client = new Client();
const endpoint = process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || 'sogojet';
const apiKey = process.env.APPWRITE_API_KEY || '';

if (!apiKey) {
  console.error('❌ APPWRITE_API_KEY is required');
  console.log('Set it: export APPWRITE_API_KEY=your_key_here');
  process.exit(1);
}

client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new Databases(client);

interface UnsplashPhoto {
  id: string;
  urls: { raw: string; regular: string; small: string };
  blur_hash: string | null;
  user: { name: string; links: { html: string } };
  width: number;
  height: number;
  description: string | null;
  alt_description: string | null;
}

// ─── Unsplash Search ────────────────────────────────────────────────

async function searchUnsplash(query: string, count: number = IMAGES_PER_DEST): Promise<UnsplashPhoto[]> {
  const params = new URLSearchParams({
    query,
    per_page: String(Math.min(count * 2, 30)), // Fetch extra for quality filtering
    orientation: 'landscape',
    content_filter: 'high',
    order_by: 'relevant',
  });

  const res = await fetch(`${UNSPLASH_BASE}/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  ⚠ Unsplash API ${res.status}: ${text.slice(0, 100)}`);
    return [];
  }

  const data = await res.json();
  const photos: UnsplashPhoto[] = data.results || [];

  // Filter for quality: minimum 1600px wide, landscape aspect ratio
  return photos
    .filter(p => p.width >= 1600 && p.width > p.height)
    .slice(0, count);
}

// ─── Build search queries ───────────────────────────────────────────

function buildSearchQueries(city: string, country: string, vibeTags?: string[]): string[] {
  const queries = [
    `${city} ${country} travel landscape`,        // Primary: specific + travel context
    `${city} aerial skyline`,                       // Aerial/skyline shots
    `${city} tourism landmark`,                     // Landmark shots
  ];

  // Add vibe-specific queries
  if (vibeTags?.includes('beach')) queries.push(`${city} beach ocean`);
  if (vibeTags?.includes('city')) queries.push(`${city} cityscape night`);
  if (vibeTags?.includes('culture')) queries.push(`${city} architecture culture`);
  if (vibeTags?.includes('nature')) queries.push(`${city} nature landscape`);
  if (vibeTags?.includes('nightlife')) queries.push(`${city} nightlife lights`);
  if (vibeTags?.includes('food')) queries.push(`${city} food restaurant`);

  return queries;
}

// ─── Appwrite Operations ────────────────────────────────────────────

async function getAllDestinations(): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await db.listDocuments(DATABASE_ID, 'destinations', [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    all.push(...response.documents);
    if (response.documents.length < limit) break;
    offset += limit;
  }

  return all;
}

async function getExistingImages(destId: string): Promise<any[]> {
  try {
    const response = await db.listDocuments(DATABASE_ID, 'destination_images', [
      Query.equal('destination_id', destId),
      Query.limit(20),
    ]);
    return response.documents;
  } catch {
    return [];
  }
}

async function upsertImage(destId: string, photo: UnsplashPhoto, rank: number, isPrimary: boolean): Promise<void> {
  const imageData = {
    destination_id: destId,
    unsplash_id: photo.id,
    url_raw: photo.urls.raw,
    url_regular: photo.urls.regular,
    url_small: photo.urls.small,
    blur_hash: photo.blur_hash || '',
    photographer: photo.user.name,
    photographer_url: photo.user.links.html,
    is_primary: isPrimary,
    quality_score: 90 - rank * 5, // First result = 90, second = 85, etc.
    fetched_at: new Date().toISOString(),
  };

  await db.createDocument(DATABASE_ID, 'destination_images', ID.unique(), imageData);
}

async function updateDestinationMainImage(destId: string, imageUrl: string, imageUrls: string[]): Promise<void> {
  try {
    await db.updateDocument(DATABASE_ID, 'destinations', destId, {
      image_url: imageUrl,
      image_urls: imageUrls,
    });
  } catch (e: any) {
    try {
      await db.updateDocument(DATABASE_ID, 'destinations', destId, { image_url: imageUrl });
    } catch {
      console.error(`    ⚠ Could not update destination ${destId}`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('🖼  SoGoJet Photo Refresh — Unsplash+');
  console.log(`   Key: ${UNSPLASH_KEY.slice(0, 8)}...`);
  console.log(`   Appwrite: ${endpoint}`);
  console.log('');

  // 1. Fetch all destinations
  const destinations = await getAllDestinations();
  console.log(`📍 Found ${destinations.length} destinations\n`);

  // Support --skip=N to resume from a specific index
  const skipArg = process.argv.find(a => a.startsWith('--skip='));
  const skipCount = skipArg ? parseInt(skipArg.split('=')[1]) : 0;
  if (skipCount > 0) console.log(`⏭  Skipping first ${skipCount} destinations\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = skipCount; i < destinations.length; i++) {
    const dest = destinations[i];
    const city = dest.city;
    const country = dest.country;
    const vibeTags = dest.vibeTags || [];

    process.stdout.write(`[${i + 1}/${destinations.length}] ${city}, ${country}... `);

    // 2. Search Unsplash with multiple queries for variety
    const queries = buildSearchQueries(city, country, vibeTags);
    let allPhotos: UnsplashPhoto[] = [];

    for (const query of queries.slice(0, 2)) { // Use first 2 queries to stay within rate limits
      const photos = await searchUnsplash(query, 4);
      allPhotos.push(...photos);
      await sleep(DELAY_MS);
    }

    // Deduplicate by photo ID
    const seen = new Set<string>();
    const uniquePhotos = allPhotos.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, IMAGES_PER_DEST);

    if (uniquePhotos.length === 0) {
      console.log('⚠ No photos found');
      failed++;
      continue;
    }

    // 3. Delete old images for this destination
    const existingDocs = await getExistingImages(dest.$id);
    for (const doc of existingDocs) {
      try { await db.deleteDocument(DATABASE_ID, 'destination_images', doc.$id); } catch {}
    }

    // 4. Insert fresh photos into destination_images
    for (let rank = 0; rank < uniquePhotos.length; rank++) {
      await upsertImage(dest.$id, uniquePhotos[rank], rank, rank === 0);
    }

    // 5. Update the main destination's imageUrl and imageUrls
    const mainImageUrl = uniquePhotos[0].urls.regular;
    const imageUrlsArray = uniquePhotos.map(p => p.urls.regular);
    await updateDestinationMainImage(dest.$id, mainImageUrl, imageUrlsArray);

    console.log(`✅ ${uniquePhotos.length} photos (${uniquePhotos[0].user.name})`);
    updated++;

    // Rate limit courtesy
    await sleep(DELAY_MS);
  }

  console.log('\n─────────────────────────────────');
  console.log(`✅ Updated: ${updated}`);
  console.log(`⚠  Failed:  ${failed}`);
  console.log(`⏭  Skipped: ${skipped}`);
  console.log(`📸 Total:   ${destinations.length}`);
  console.log('─────────────────────────────────');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
