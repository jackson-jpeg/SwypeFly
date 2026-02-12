import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { searchDestinationImages } from '../../services/unsplash';
import { logApiError } from '../../utils/apiLogger';

export const maxDuration = 60;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DEFAULT_BATCH_SIZE = 8;   // destinations per run
const IMAGES_PER_DEST = 5;
const TIME_BUDGET_MS = 45_000;  // stay under 60s Vercel limit

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret) {
    const provided = authHeader?.replace('Bearer ', '') || '';
    if (provided !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // Find destinations with oldest/missing images
    const { data: destinations, error: dbErr } = await supabase
      .from('destinations')
      .select('id, city, country, unsplash_query')
      .eq('is_active', true);

    if (dbErr || !destinations) {
      return res.status(500).json({ error: 'Failed to fetch destinations' });
    }

    // Get the latest fetch time per destination from destination_images
    const { data: imageMeta } = await supabase
      .from('destination_images')
      .select('destination_id, fetched_at')
      .order('fetched_at', { ascending: false });

    const lastFetched = new Map<string, string>();
    if (imageMeta) {
      for (const row of imageMeta) {
        if (!lastFetched.has(row.destination_id)) {
          lastFetched.set(row.destination_id, row.fetched_at);
        }
      }
    }

    // Sort: never-fetched first, then oldest
    const sorted = [...destinations].sort((a, b) => {
      const tsA = lastFetched.get(a.id);
      const tsB = lastFetched.get(b.id);
      if (!tsA && !tsB) return 0;
      if (!tsA) return -1;
      if (!tsB) return 1;
      return new Date(tsA).getTime() - new Date(tsB).getTime();
    });

    // force=true processes all destinations (useful for initial seed / re-fetch)
    const forceAll = req.query.force === 'true';
    const batchSize = forceAll ? sorted.length : DEFAULT_BATCH_SIZE;
    const batch = sorted.slice(0, batchSize);
    const startTime = Date.now();
    const results: { id: string; city: string; images: number }[] = [];

    for (const dest of batch) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(`[images/refresh] Time budget exceeded after ${results.length} destinations`);
        break;
      }

      const query = dest.unsplash_query || `${dest.city} ${dest.country} travel`;
      const images = await searchDestinationImages(query, IMAGES_PER_DEST);

      if (images.length === 0) {
        results.push({ id: dest.id, city: dest.city, images: 0 });
        continue;
      }

      // Delete old images for this destination before inserting fresh ones
      await supabase
        .from('destination_images')
        .delete()
        .eq('destination_id', dest.id);

      const rows = images.map((img, idx) => ({
        destination_id: dest.id,
        unsplash_id: img.unsplashId,
        url_raw: img.urlRaw,
        url_regular: img.urlRegular,
        url_small: img.urlSmall,
        blur_hash: img.blurHash,
        photographer: img.photographer,
        photographer_url: img.photographerUrl,
        is_primary: idx === 0,
        fetched_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabase
        .from('destination_images')
        .upsert(rows, { onConflict: 'destination_id,unsplash_id' });

      if (upsertErr) {
        console.error(`[images/refresh] Upsert error for ${dest.city}:`, upsertErr.message);
      }

      results.push({ id: dest.id, city: dest.city, images: images.length });
    }

    return res.status(200).json({
      refreshed: results,
      totalProcessed: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logApiError('api/images/refresh', err);
    return res.status(500).json({ error: 'Image refresh failed' });
  }
}
