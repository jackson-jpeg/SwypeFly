/**
 * Retry Pexels image fetch for destinations that still have old/bad images.
 * Identifies destinations updated before the last refresh run and retries them.
 * Uses 30s backoff on 429s.
 * 
 * Run: npx tsx scripts/retry-failed-images.ts
 */
import fs from 'fs';
import path from 'path';
import { Client, Databases, Query } from 'node-appwrite';

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

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);
const db = new Databases(client);

const DATABASE_ID = 'sogojet';
const COLLECTION_ID = 'destinations';

interface PexelsPhoto {
  id: number; width: number; height: number;
  photographer: string;
  src: { original: string; large2x: string; large: string; };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function searchPexels(query: string, perPage = 5): Promise<PexelsPhoto[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=large`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
    if (res.status === 429) {
      const wait = 30 * (attempt + 1);
      console.log(`    ⏳ Rate limited, waiting ${wait}s...`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) return [];
    const data = await res.json() as any;
    return data.photos || [];
  }
  return [];
}

function buildQueries(city: string, country: string): string[] {
  return [
    `${city} ${country} travel landscape`,
    `${city} ${country} aerial`,
    `${city} skyline`,
    `${city} ${country} landmark`,
    `${city} ${country}`,
  ];
}

async function main() {
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

  // Find ones that weren't updated in the last run (updatedAt still equals createdAt)
  // OR ones where image_urls is empty
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
  const needsRetry = allDocs.filter(d => {
    return d.$updatedAt < cutoff || (d.image_urls || []).length === 0;
  });

  console.log(`🔄 Retrying ${needsRetry.length} destinations (of ${allDocs.length} total)\n`);

  let updated = 0, failed = 0;

  for (let i = 0; i < needsRetry.length; i++) {
    const dest = needsRetry[i];
    console.log(`[${i + 1}/${needsRetry.length}] ${dest.city}, ${dest.country}`);

    const queries = buildQueries(dest.city, dest.country);
    let allPhotos: PexelsPhoto[] = [];

    for (const query of queries) {
      const photos = await searchPexels(query);
      console.log(`  "${query}" → ${photos.length}`);
      allPhotos.push(...photos);
      if (allPhotos.length >= 8) break;
      await sleep(2000);
    }

    if (allPhotos.length === 0) {
      console.log(`  ⚠ Still no photos!`);
      failed++;
      continue;
    }

    // Dedupe + pick best
    const seen = new Set<number>();
    const unique = allPhotos.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    unique.sort((a, b) => (b.width / b.height) - (a.width / a.height));
    const best = unique.slice(0, 5);

    const heroUrl = best[0].src.large2x || best[0].src.large || best[0].src.original;
    const additionalUrls = best.slice(1).map(p => p.src.large2x || p.src.large || p.src.original);

    try {
      await db.updateDocument(DATABASE_ID, COLLECTION_ID, dest.$id, {
        image_url: heroUrl,
        image_urls: additionalUrls,
      });
      console.log(`  ✓ ${best.length} photos (hero: ${best[0].photographer})`);
      updated++;
    } catch (e: any) {
      console.log(`  ✗ ${e.message}`);
      failed++;
    }

    await sleep(3000); // Longer delay for retry
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
}

main().catch(console.error);
