/**
 * Refresh images for rejected destinations using multi-query strategy.
 * For destinations with poor images, we do multiple Google Places searches:
 * 1. Main city/locality search  
 * 2. "city beach/landmarks" search for scenic photos
 * 3. "city travel" general fallback
 * 
 * This gets us 5+ high-quality landscape photos per destination.
 * 
 * Run: npx tsx scripts/refresh-rejected-images.ts
 */
import fs from 'fs';
import path from 'path';
import { Client, Databases, Query } from 'node-appwrite';

// Load env
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

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY as string;
if (!GOOGLE_API_KEY) throw new Error('GOOGLE_PLACES_API_KEY env var is required');
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);
const db = new Databases(client);

const DATABASE_ID = 'sogojet';
const COLLECTION_ID = 'destinations';
const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Rejected destination IDs from audit
const REJECTED_IDS = [
  '166', // Anguilla
  '174', // Cayman Brac
  '53',  // Charleston
  '159', // Clearwater
  '144', // Colombo
  '52',  // Denver
  '167', // Dominica
  '64',  // Grand Cayman
  '180', // Ljubljana
  '190', // Lombok
  '35',  // London
  '11',  // Maldives
  '171', // Montserrat
  '45',  // Seoul
  '112', // Turks & Caicos
  '88',  // Warsaw
];

// Better search queries per destination to get scenic/travel photos
const QUERY_OVERRIDES: Record<string, string[]> = {
  'Anguilla': ['Shoal Bay Anguilla beach', 'Anguilla Caribbean island'],
  'Cayman Brac': ['Cayman Brac island beach', 'Cayman Brac diving cliffs'],
  'Charleston': ['Charleston South Carolina downtown', 'Rainbow Row Charleston'],
  'Clearwater': ['Clearwater Beach Florida', 'Clearwater Beach sunset'],
  'Colombo': ['Colombo Sri Lanka skyline', 'Galle Face Green Colombo'],
  'Denver': ['Denver Colorado skyline mountains', 'Denver downtown'],
  'Dominica': ['Dominica Caribbean island', 'Trafalgar Falls Dominica'],
  'Grand Cayman': ['Seven Mile Beach Grand Cayman', 'Grand Cayman island'],
  'Ljubljana': ['Ljubljana Slovenia old town', 'Ljubljana castle dragon bridge'],
  'Lombok': ['Lombok Indonesia beach', 'Gili Islands Lombok'],
  'London': ['London skyline Tower Bridge', 'Big Ben London'],
  'Maldives': ['Maldives overwater bungalow', 'Maldives beach island'],
  'Montserrat': ['Montserrat Caribbean island', 'Montserrat volcano'],
  'Seoul': ['Seoul South Korea skyline', 'Gyeongbokgung Palace Seoul'],
  'Turks & Caicos': ['Grace Bay Beach Turks Caicos', 'Turks and Caicos island'],
  'Warsaw': ['Warsaw Poland old town', 'Warsaw skyline Palace of Culture'],
};

interface PlacePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
  authorAttributions: { displayName: string }[];
}

async function searchPhotos(query: string, type?: string): Promise<PlacePhoto[]> {
  const body: any = { textQuery: query, maxResultCount: 3 };
  if (type) body.includedType = type;

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.photos',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];
  const data = await res.json() as { places?: any[] };
  
  // Gather photos from all returned places
  const allPhotos: PlacePhoto[] = [];
  for (const place of data.places || []) {
    if (place.photos) allPhotos.push(...place.photos);
  }
  return allPhotos;
}

async function resolvePhotoUrl(photoName: string): Promise<string | null> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${GOOGLE_API_KEY}&skipHttpRedirect=true`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as { photoUri?: string };
  return data.photoUri || null;
}

function pickBestPhotos(photos: PlacePhoto[], max = 5): PlacePhoto[] {
  // Deduplicate by photo name
  const seen = new Set<string>();
  const unique = photos.filter(p => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });

  // Prefer landscape, larger
  const landscape = unique.filter(p => p.widthPx > p.heightPx && p.widthPx >= 800);
  const rest = unique.filter(p => !(p.widthPx > p.heightPx && p.widthPx >= 800));
  
  landscape.sort((a, b) => {
    const aRatio = a.widthPx / a.heightPx;
    const bRatio = b.widthPx / b.heightPx;
    return (-Math.abs(bRatio - 1.6) + b.widthPx / 10000) - (-Math.abs(aRatio - 1.6) + a.widthPx / 10000);
  });

  const result = [...landscape, ...rest].slice(0, max);
  return result;
}

async function main() {
  console.log(`🔄 Refreshing ${REJECTED_IDS.length} rejected destinations ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('─'.repeat(60));

  let updated = 0, failed = 0, searchCalls = 0, photoCalls = 0;

  for (const id of REJECTED_IDS) {
    let dest: any;
    try {
      dest = await db.getDocument(DATABASE_ID, COLLECTION_ID, id);
    } catch {
      console.log(`✗ Could not find destination ${id}`);
      failed++;
      continue;
    }

    const city = dest.city;
    const country = dest.country;
    console.log(`\n[${city}, ${country}] (ID: ${id})`);

    // Multi-query strategy
    const queries = QUERY_OVERRIDES[city] || [`${city} ${country} travel`, `${city} ${country} landmark`];
    let allPhotos: PlacePhoto[] = [];

    // First: try locality search
    searchCalls++;
    const localityPhotos = await searchPhotos(`${city}, ${country}`, 'locality');
    allPhotos.push(...localityPhotos);
    console.log(`  📍 Locality: ${localityPhotos.length} photos`);
    await sleep(300);

    // Second: supplementary queries
    for (const q of queries) {
      searchCalls++;
      const photos = await searchPhotos(q);
      allPhotos.push(...photos);
      console.log(`  🔍 "${q}": ${photos.length} photos`);
      await sleep(300);
    }

    // Pick best 5
    const best = pickBestPhotos(allPhotos, 5);
    console.log(`  🖼  Best ${best.length} selected (${allPhotos.length} total found)`);

    if (best.length === 0) {
      console.log(`  ✗ No usable photos found`);
      failed++;
      continue;
    }

    // Resolve URLs
    const urls: string[] = [];
    for (const photo of best) {
      photoCalls++;
      const url = await resolvePhotoUrl(photo.name);
      if (url) urls.push(url);
      await sleep(100);
    }

    if (urls.length === 0) {
      console.log(`  ✗ All resolves failed`);
      failed++;
      continue;
    }

    console.log(`  ✓ ${urls.length} URLs resolved`);

    if (!DRY_RUN) {
      try {
        await db.updateDocument(DATABASE_ID, COLLECTION_ID, id, {
          image_url: urls[0],
          image_urls: urls.slice(1),
          approved: null, // Reset to pending so Jackson can re-review
        });
        updated++;
        console.log(`  ✅ Updated + reset to pending`);
      } catch (e: any) {
        console.log(`  ✗ Update failed: ${e.message}`);
        failed++;
      }
    } else {
      urls.forEach((u, i) => console.log(`    ${i === 0 ? 'Hero' : `  #${i + 1}`}: ${u.slice(0, 80)}...`));
      updated++;
    }

    await sleep(500);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Done!`);
  console.log(`  Updated: ${updated} / ${REJECTED_IDS.length}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Search calls: ${searchCalls} (~$${(searchCalls * 0.032).toFixed(2)})`);
  console.log(`  Photo calls: ${photoCalls} (~$${(photoCalls * 0.007).toFixed(2)})`);
  console.log(`  Estimated cost: ~$${(searchCalls * 0.032 + photoCalls * 0.007).toFixed(2)}`);
}

main().catch(console.error);
