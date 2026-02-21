/**
 * Seed destination_images for destinations 21-50 into Appwrite.
 * Run: npx tsx scripts/seed-images-batch2.ts
 */
import { Client, Databases, Query, ID } from 'node-appwrite';
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

const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=1080&q=80&auto=format&fit=crop`;
const uSmall = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&q=80&auto=format&fit=crop`;
const uRaw = (id: string) => `https://images.unsplash.com/photo-${id}`;

interface CuratedImage { photoId: string; photographer: string; photographerUrl: string; }

const CURATED_IMAGES: Record<string, CuratedImage[]> = {
  '21': [
    { photoId: '1510097467424-ae18c8e2bd26', photographer: 'Marv Watson', photographerUrl: 'https://unsplash.com/@marvelous' },
    { photoId: '1552074284-5e88ef1aef18', photographer: 'Sandro Schuh', photographerUrl: 'https://unsplash.com/@sandroschuh' },
    { photoId: '1507525428034-b723cf961d3e', photographer: 'Sean Oulashin', photographerUrl: 'https://unsplash.com/@oulashin' },
  ],
  '22': [
    { photoId: '1505881502353-a1986add3762', photographer: 'Chen Mizrach', photographerUrl: 'https://unsplash.com/@chenmizrach' },
    { photoId: '1519046904884-53103b34b206', photographer: 'Maciej Serafinowicz', photographerUrl: 'https://unsplash.com/@maciej' },
  ],
  '23': [
    { photoId: '1580237072617-771c3ecc4a24', photographer: 'Yves Alarie', photographerUrl: 'https://unsplash.com/@yvesalarie' },
    { photoId: '1544551763-46a013bb70d5', photographer: 'Shawn Ang', photographerUrl: 'https://unsplash.com/@shawnanggg' },
  ],
  '35': [
    { photoId: '1513635269975-59663e0ac1ad', photographer: 'Benjamin Davies', photographerUrl: 'https://unsplash.com/@bendavisual' },
    { photoId: '1486299267070-83823f5448dd', photographer: 'Charles Postiaux', photographerUrl: 'https://unsplash.com/@charlpost' },
  ],
  '36': [
    { photoId: '1502602898657-3e91760cbb34', photographer: 'Chris Karidis', photographerUrl: 'https://unsplash.com/@chriskaridis' },
    { photoId: '1499856871958-5b9627545d1a', photographer: 'Anthony DELANOIX', photographerUrl: 'https://unsplash.com/@anthonydelanoix' },
  ],
  '50': [
    { photoId: '1496442226666-8d4d0e62e6e9', photographer: 'Pedro Lastra', photographerUrl: 'https://unsplash.com/@peterlaster' },
    { photoId: '1534430480872-3498386e7856', photographer: 'Colton Duke', photographerUrl: 'https://unsplash.com/@csoref' },
    { photoId: '1522083165195-3424ed4f7b27', photographer: 'Robert Bye', photographerUrl: 'https://unsplash.com/@robertbye' },
  ],
};

async function seedImages() {
  console.log('Seeding curated images for batch 2 into Appwrite...\n');
  let total = 0;
  let errors = 0;

  for (const [destId, images] of Object.entries(CURATED_IMAGES)) {
    try {
      const old = await db.listDocuments(DB, 'destination_images', [
        Query.equal('destination_id', destId),
        Query.limit(100),
      ]);
      for (const doc of old.documents) {
        await db.deleteDocument(DB, 'destination_images', doc.$id);
      }
    } catch { /* empty */ }

    for (let idx = 0; idx < images.length; idx++) {
      const img = images[idx];
      try {
        await db.createDocument(DB, 'destination_images', ID.unique(), {
          destination_id: destId,
          unsplash_id: img.photoId.split('-')[0] || img.photoId,
          url_raw: uRaw(img.photoId),
          url_regular: u(img.photoId),
          url_small: uSmall(img.photoId),
          blur_hash: '',
          photographer: img.photographer,
          photographer_url: img.photographerUrl,
          is_primary: idx === 0,
          fetched_at: new Date().toISOString(),
        });
        total++;
      } catch (err) {
        console.error(`  ✗ Insert failed for dest ${destId}:`, err);
        errors++;
      }
    }
    console.log(`  ✓ Dest ${destId}: ${images.length} images`);
  }

  console.log(`\nDone! Seeded ${total} images for ${Object.keys(CURATED_IMAGES).length} destinations.`);
  if (errors > 0) console.log(`${errors} errors occurred.`);
}

seedImages().catch(console.error);
