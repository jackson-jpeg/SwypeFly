/**
 * Fixes bad photos for specific destinations.
 * Deletes existing images and fetches new ones with better search queries.
 *
 * Usage: UNSPLASH_ACCESS_KEY=xxx npx tsx scripts/fix-bad-photos.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\\n/g, '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(/\\n/g, '').trim();
const UNSPLASH_KEY = (process.env.UNSPLASH_ACCESS_KEY ?? '').trim();

if (!supabaseUrl || !supabaseKey || !UNSPLASH_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNSPLASH_ACCESS_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function searchUnsplash(query: string, count = 10): Promise<any[]> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape&content_filter=high`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    console.warn(`  ⚠ Unsplash ${res.status}, remaining: ${remaining}`);
    return [];
  }
  const remaining = res.headers.get('x-ratelimit-remaining');
  const data = await res.json();
  console.log(`  [${remaining} left] "${query}" → ${data.results?.length || 0} results`);
  return data.results || [];
}

async function fixDestination(destId: string, city: string, queries: string[]) {
  console.log(`\n🔧 ${city} (${destId})`);

  // Delete old images
  await supabase.from('destination_images').delete().eq('destination_id', destId);
  console.log(`  Cleared old images`);

  // Search with multiple queries
  const allImages: any[] = [];
  const seenIds = new Set<string>();

  for (const q of queries) {
    const results = await searchUnsplash(q);
    for (const img of results) {
      if (!seenIds.has(img.id)) {
        seenIds.add(img.id);
        allImages.push(img);
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }

  if (allImages.length === 0) {
    console.log(`  ✗ No images found!`);
    return;
  }

  // Insert new images
  const rows = allImages.slice(0, 10).map((img, i) => ({
    destination_id: destId,
    unsplash_id: img.id,
    url_raw: img.urls?.raw || '',
    url_regular: img.urls?.regular || '',
    url_small: img.urls?.small || '',
    blur_hash: img.blur_hash || '',
    photographer: img.user?.name || 'Unsplash',
    photographer_url: img.user?.links?.html || '',
    is_primary: i === 0,
    quality_score: 85,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('destination_images').insert(rows);
  if (error) {
    console.log(`  ⚠ Insert error: ${error.message}`);
  }

  // Update primary on destinations table
  const primaryUrl = allImages[0].urls?.regular;
  await supabase.from('destinations').update({ image_url: primaryUrl }).eq('id', destId);

  console.log(`  ✓ ${rows.length} images added`);
}

async function main() {
  // Destinations with bad/wrong/missing photos
  const fixes: [string, string, string[]][] = [
    ['106', 'Asheville NC', [
      'Asheville North Carolina Blue Ridge Parkway mountains',
      'Biltmore Estate mansion Asheville',
      'Asheville North Carolina downtown arts district',
    ]],
    ['104', 'Aspen CO', [
      'Aspen Colorado Maroon Bells autumn reflection',
      'Aspen Colorado ski resort winter snow mountain',
      'Aspen Colorado town main street',
    ]],
    ['159', 'Clearwater FL', [
      'Clearwater Beach Florida white sand Gulf Mexico',
      'Clearwater Beach Florida pier sunset',
      'Clearwater Florida beach aerial view',
    ]],
    ['v4-30', 'Brisbane Australia', [
      'Brisbane Australia city skyline river',
      'Brisbane South Bank Australia',
      'Story Bridge Brisbane night',
    ]],
    ['52', 'Denver CO', [
      'Denver Colorado Rocky Mountains skyline',
      'Denver Colorado Union Station downtown',
      'Red Rocks Amphitheatre Denver Colorado',
    ]],
    ['157', 'Destin FL', [
      'Destin Florida emerald coast white sand beach',
      'Destin Florida harbor boardwalk',
      'Destin Florida Henderson Beach turquoise water',
    ]],
    ['155', 'Door County WI', [
      'Door County Wisconsin lighthouse peninsula',
      'Door County Wisconsin autumn cherry blossoms',
      'Door County Wisconsin waterfront village',
    ]],
    ['158', 'Naples FL', [
      'Naples Florida beach sunset Gulf Mexico',
      'Naples Florida pier',
      'Naples Florida Third Street South downtown',
    ]],
    // Also fix the 5 that were rate-limited earlier
    ['v2-81', 'Hamburg', [
      'Hamburg Germany Speicherstadt warehouse district',
      'Hamburg Elbphilharmonie concert hall',
    ]],
    ['v2-85', 'Bruges', [
      'Bruges Belgium medieval canals',
      'Bruges Belgium Markt square belfry',
    ]],
    ['v2-88', 'Catania', [
      'Catania Sicily Italy Piazza Duomo',
      'Mount Etna Sicily volcano',
    ]],
    ['v2-93', 'Cappadocia', [
      'Cappadocia Turkey hot air balloons sunrise',
      'Cappadocia fairy chimneys cave houses',
    ]],
    ['v4-29', 'Lilongwe (Lake Malawi)', [
      'Lake Malawi Africa crystal clear water',
      'Malawi Africa landscape nature',
    ]],
  ];

  for (const [id, city, queries] of fixes) {
    await fixDestination(id, city, queries);
  }

  console.log('\n✅ All fixes complete!');
}

main().catch(console.error);
