/**
 * Seed destination_images with curated Unsplash photos (destinations 1-20).
 * Run: npx tsx scripts/seed-images.ts
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
  '1': [
    { photoId: '1537996194471-e657df975ab4', photographer: 'Alfiano Sutianto', photographerUrl: 'https://unsplash.com/@alfiano' },
    { photoId: '1555400038-63f5ba517a47', photographer: 'Jezael Melgoza', photographerUrl: 'https://unsplash.com/@jezar' },
    { photoId: '1573790387438-4da905039392', photographer: 'Ruben Hutabarat', photographerUrl: 'https://unsplash.com/@ruben244' },
  ],
  '2': [
    { photoId: '1570077188670-e3a8d69ac5ff', photographer: 'Tom Podmore', photographerUrl: 'https://unsplash.com/@tompodmore86' },
    { photoId: '1613395877344-13d4a8e0d49e', photographer: 'Heidi Kaden', photographerUrl: 'https://unsplash.com/@heidikaden' },
    { photoId: '1533105079780-92b9be482077', photographer: 'Aleksandar Pasaric', photographerUrl: 'https://unsplash.com/@apasaric' },
  ],
  '3': [
    { photoId: '1540959733332-eab4deabeeaf', photographer: 'Jezael Melgoza', photographerUrl: 'https://unsplash.com/@jezar' },
    { photoId: '1536098561742-ca998e48cbcc', photographer: 'Arto Marttinen', photographerUrl: 'https://unsplash.com/@wandervisions' },
    { photoId: '1542051841857-5f90071e7989', photographer: 'Jezael Melgoza', photographerUrl: 'https://unsplash.com/@jezar' },
  ],
};
// Note: Add more destination images as needed. For a full set, see seed-images-batch2.ts.

async function seedImages() {
  console.log('Seeding curated destination images into Appwrite...\n');
  let total = 0;
  let errors = 0;

  for (const [destId, images] of Object.entries(CURATED_IMAGES)) {
    // Delete old images
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

  console.log(`\nDone! Seeded ${total} images across ${Object.keys(CURATED_IMAGES).length} destinations.`);
  if (errors > 0) console.log(`${errors} errors occurred.`);
}

seedImages().catch(console.error);
