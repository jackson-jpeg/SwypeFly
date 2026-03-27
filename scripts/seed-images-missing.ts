/**
 * Fetches Unsplash images for destinations that don't have any yet.
 * Usage: UNSPLASH_ACCESS_KEY=xxx npx tsx scripts/seed-images-missing.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\\n/g, '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(/\\n/g, '').trim();
const UNSPLASH_KEY = (process.env.UNSPLASH_ACCESS_KEY ?? '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!UNSPLASH_KEY) {
  console.error('Missing UNSPLASH_ACCESS_KEY');
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
    console.warn(`  Unsplash API error ${res.status}, remaining: ${remaining}`);
    return [];
  }
  const data = await res.json();
  return (data.results || []).map((img: any) => ({
    url: img.urls?.regular || img.urls?.full,
    thumb: img.urls?.thumb,
    credit: img.user?.name || 'Unsplash',
    unsplash_id: img.id,
  }));
}

async function main() {
  // Get all destinations
  const { data: allDests } = await supabase
    .from('destinations')
    .select('id, iata_code, city, country, image_url')
    .eq('is_active', true);

  if (!allDests) {
    console.error('Failed to fetch destinations');
    return;
  }

  // Get all destination IDs that already have images
  const { data: existingImages } = await supabase
    .from('destination_images')
    .select('destination_id');

  const idsWithImages = new Set((existingImages || []).map((r: any) => r.destination_id));

  // Find destinations missing images
  const missing = allDests.filter(
    (d: any) => !idsWithImages.has(d.id) && (!d.image_url || d.image_url === ''),
  );

  console.log(`Found ${missing.length} destinations without images (out of ${allDests.length} total)\n`);

  let success = 0;
  let failed = 0;

  for (const dest of missing) {
    const query = `${dest.city} ${dest.country} travel`;
    const images = await searchUnsplash(query);

    if (images.length === 0) {
      // Try simpler query
      const images2 = await searchUnsplash(`${dest.city} landmark`);
      if (images2.length === 0) {
        console.log(`  ✗ ${dest.city} (${dest.iata_code}) — no images found`);
        failed++;
        continue;
      }
      images.push(...images2);
    }

    // Set primary image on the destination
    const primaryUrl = images[0].url;
    await supabase.from('destinations').update({ image_url: primaryUrl }).eq('id', dest.id);

    // Insert all images into destination_images
    const imageRows = images.slice(0, 10).map((img: any, i: number) => ({
      destination_id: dest.id,
      image_url: img.url,
      thumbnail_url: img.thumb,
      credit: img.credit,
      unsplash_id: img.unsplash_id,
      is_primary: i === 0,
    }));

    const { error } = await supabase.from('destination_images').insert(imageRows);
    if (error) {
      console.log(`  ⚠ ${dest.city} (${dest.iata_code}) — images saved but insert error: ${error.message}`);
    } else {
      console.log(`  ✓ ${dest.city} (${dest.iata_code}) — ${images.length} images`);
    }
    success++;

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
