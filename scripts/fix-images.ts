/**
 * Fix destination images by setting reliable Unsplash source URLs.
 * These redirect URLs are permanent and don't require an API key.
 * Run: npx tsx scripts/fix-images.ts
 */
import { Client, Databases, Query } from 'node-appwrite';
import { config } from 'dotenv';
config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const db = new Databases(client);
const DATABASE_ID = 'sogojet';

// Unsplash photo IDs for destinations — curated, permanent
const CITY_PHOTOS: Record<string, string> = {
  'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&h=800&fit=crop',
  'santorini': 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&h=800&fit=crop',
  'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&h=800&fit=crop',
  'machu picchu': 'https://images.unsplash.com/photo-1587595431973-160d0d163571?w=1200&h=800&fit=crop',
  'marrakech': 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1200&h=800&fit=crop',
  'reykjavik': 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1200&h=800&fit=crop',
  'amalfi coast': 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=1200&h=800&fit=crop',
  'cape town': 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200&h=800&fit=crop',
  'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&h=800&fit=crop',
  'barcelona': 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1200&h=800&fit=crop',
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&h=800&fit=crop',
  'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&h=800&fit=crop',
  'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&h=800&fit=crop',
  'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&h=800&fit=crop',
  'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&h=800&fit=crop',
  'amsterdam': 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200&h=800&fit=crop',
  'lisbon': 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&h=800&fit=crop',
  'prague': 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200&h=800&fit=crop',
  'bangkok': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&h=800&fit=crop',
  'rio de janeiro': 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1200&h=800&fit=crop',
  'istanbul': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200&h=800&fit=crop',
  'buenos aires': 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1200&h=800&fit=crop',
  'cancún': 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200&h=800&fit=crop',
  'cancun': 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200&h=800&fit=crop',
  'miami': 'https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1200&h=800&fit=crop',
  'las vegas': 'https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=1200&h=800&fit=crop',
  'san francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&h=800&fit=crop',
  'hawaii': 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=1200&h=800&fit=crop',
  'vancouver': 'https://images.unsplash.com/photo-1559511260-66a68e4b0600?w=1200&h=800&fit=crop',
  'florence': 'https://images.unsplash.com/photo-1543429258-b53a48a2be0e?w=1200&h=800&fit=crop',
  'copenhagen': 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1200&h=800&fit=crop',
  'savannah': 'https://images.unsplash.com/photo-1588974269162-4c0e28af8a17?w=1200&h=800&fit=crop',
  'nassau': 'https://images.unsplash.com/photo-1548574505-5e239809ee19?w=1200&h=800&fit=crop',
  'swiss alps': 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200&h=800&fit=crop',
  'geneva': 'https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=1200&h=800&fit=crop',
  'quebec city': 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=800&fit=crop',
  'yangon': 'https://images.unsplash.com/photo-1535912826909-80e24ac2f552?w=1200&h=800&fit=crop',
  'san josé': 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=1200&h=800&fit=crop',
  'san jose': 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=1200&h=800&fit=crop',
  'bogotá': 'https://images.unsplash.com/photo-1568632234157-ce7aecd03d0d?w=1200&h=800&fit=crop',
  'bogota': 'https://images.unsplash.com/photo-1568632234157-ce7aecd03d0d?w=1200&h=800&fit=crop',
  'myrtle beach': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=800&fit=crop',
  'palm beach': 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&h=800&fit=crop',
  'palm springs': 'https://images.unsplash.com/photo-1545063328-c8e4e3a2ef52?w=1200&h=800&fit=crop',
  'asheville': 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&h=800&fit=crop',
  'clearwater': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=800&fit=crop',
  'providence': 'https://images.unsplash.com/photo-1571406761831-ea352d9d78e6?w=1200&h=800&fit=crop',
  'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&h=800&fit=crop',
  'phuket': 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1200&h=800&fit=crop',
  'mexico city': 'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200&h=800&fit=crop',
  'costa rica': 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=1200&h=800&fit=crop',
};

// Curated generic travel/destination photos for fallback
// (source.unsplash.com is deprecated and returns 503)
const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&h=800&fit=crop', // travel road
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&h=800&fit=crop', // road trip
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&h=800&fit=crop', // lake mountains
  'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1200&h=800&fit=crop', // tropical beach
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=800&fit=crop', // beach sunset
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&h=800&fit=crop', // paris eiffel
  'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1200&h=800&fit=crop', // aerial coast
  'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1200&h=800&fit=crop', // airplane wing
  'https://images.unsplash.com/photo-1473163928189-364b2c4e1135?w=1200&h=800&fit=crop', // city skyline
  'https://images.unsplash.com/photo-1528164344705-47542687000d?w=1200&h=800&fit=crop', // european street
  'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=1200&h=800&fit=crop', // mountain valley
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&h=800&fit=crop', // ocean waves
  'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=1200&h=800&fit=crop', // rice terraces
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1200&h=800&fit=crop', // mountain lake
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&h=800&fit=crop', // resort pool
];

function getFallbackUrl(city: string): string {
  // Deterministic pick based on city name hash
  let hash = 0;
  for (let i = 0; i < city.length; i++) hash = (hash * 31 + city.charCodeAt(i)) | 0;
  return FALLBACK_PHOTOS[Math.abs(hash) % FALLBACK_PHOTOS.length];
}

async function main() {
  const result = await db.listDocuments(DATABASE_ID, 'destinations', [
    Query.equal('is_active', true),
    Query.limit(500),
  ]);

  console.log(`Found ${result.documents.length} active destinations`);

  let updated = 0;
  let skipped = 0;

  for (const dest of result.documents) {
    const city = (dest.city as string || '').toLowerCase();
    const country = dest.country as string || '';
    const currentUrl = dest.image_url as string || '';

    // Skip if already has a direct Unsplash image URL (not source.unsplash.com which is dead)
    if (currentUrl.includes('images.unsplash.com') && !currentUrl.includes('source.unsplash.com')) {
      skipped++;
      continue;
    }

    const newUrl = CITY_PHOTOS[city] || getFallbackUrl(city);

    try {
      await db.updateDocument(DATABASE_ID, 'destinations', dest.$id, {
        image_url: newUrl,
      });
      console.log(`✓ ${dest.city}: ${newUrl.substring(0, 60)}...`);
      updated++;
    } catch (err) {
      console.error(`✗ ${dest.city}: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} already had Unsplash URLs`);
}

main().catch(console.error);
