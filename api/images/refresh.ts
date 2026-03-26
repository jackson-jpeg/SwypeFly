import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../../services/supabaseServer';
import { searchDestinationImages } from '../../services/unsplash';
import type { UnsplashImage } from '../../services/unsplash';
import { logApiError } from '../../utils/apiLogger';
import { cors } from '../_cors.js';

export const maxDuration = 60;

const DEFAULT_BATCH_SIZE = 8; // destinations per run
const IMAGES_PER_DEST = 5;
const UNSPLASH_FETCH_COUNT = 15; // fetch more than we need so we can filter
const TIME_BUDGET_MS = 45_000; // stay under 60s Vercel limit

/**
 * Score an image by quality. Returns -1 to reject.
 *
 * Since the Unsplash API already filters for landscape orientation,
 * all Unsplash images get a base score of 60 (landscape + decent resolution assumed).
 * Google Places images (detected by lh3.googleusercontent.com URL) get a default score of 50.
 */
export function scoreImage(
  img: UnsplashImage,
  options?: { isGooglePlaces?: boolean },
): number {
  // Google Places images are already curated — give a default score
  if (options?.isGooglePlaces) {
    return 50;
  }

  // Unsplash images: base score of 60 (landscape orientation guaranteed by API query)
  let score = 60;

  // Blur hash bonus: +10 points
  if (img.blurHash) {
    score += 10;
  }

  // Variety: random factor up to 10 points
  score += Math.random() * 10;

  return score;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' });
  }
  const authHeader = req.headers.authorization;
  const provided = authHeader?.replace('Bearer ', '') || '';
  if (provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Find destinations with oldest/missing images
    const { data: destData, error: destError } = await supabase
      .from(TABLES.destinations)
      .select('id, city, country, unsplash_query')
      .eq('is_active', true)
      .limit(500);
    if (destError) throw destError;

    const destinations = (destData ?? []).map((d) => ({
      id: d.id,
      city: d.city as string,
      country: d.country as string,
      unsplash_query: (d.unsplash_query as string) || '',
    }));

    // Get the latest fetch time per destination from destination_images
    let imageMetaDocs: Array<Record<string, unknown>> = [];
    try {
      const { data, error } = await supabase
        .from(TABLES.destinationImages)
        .select('destination_id, fetched_at')
        .order('fetched_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      imageMetaDocs = data ?? [];
    } catch {
      // Collection may be empty
    }

    const lastFetched = new Map<string, string>();
    for (const row of imageMetaDocs) {
      const destId = row.destination_id as string;
      if (!lastFetched.has(destId)) {
        lastFetched.set(destId, row.fetched_at as string);
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
    const results: { id: string; city: string; images: number; rejected: number }[] = [];

    for (const dest of batch) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(
          `[images/refresh] Time budget exceeded after ${results.length} destinations`,
        );
        break;
      }

      const query = dest.unsplash_query || `${dest.city} ${dest.country} travel`;
      const images = await searchDestinationImages(query, UNSPLASH_FETCH_COUNT);

      if (images.length === 0) {
        results.push({ id: dest.id, city: dest.city, images: 0, rejected: 0 });
        continue;
      }

      // Score and filter images
      const scored = images
        .map((img) => ({ img, score: scoreImage(img) }))
        .filter((item) => item.score >= 0);

      // Sort by score descending, keep top IMAGES_PER_DEST
      scored.sort((a, b) => b.score - a.score);
      const topImages = scored.slice(0, IMAGES_PER_DEST);
      const rejected = images.length - scored.length;

      if (topImages.length === 0) {
        results.push({ id: dest.id, city: dest.city, images: 0, rejected });
        continue;
      }

      // Delete old images for this destination before inserting fresh ones
      try {
        const { error } = await supabase
          .from(TABLES.destinationImages)
          .delete()
          .eq('destination_id', dest.id);
        if (error) throw error;
      } catch {
        // May not exist yet
      }

      // Find the highest score to mark as primary
      const highestScore = topImages[0].score;

      const newImages = topImages.map(({ img, score }, idx) => ({
        destination_id: dest.id,
        unsplash_id: img.unsplashId,
        url_raw: img.urlRaw || '',
        url_regular: img.urlRegular || '',
        url_small: img.urlSmall || '',
        blur_hash: img.blurHash || '',
        photographer: img.photographer || '',
        photographer_url: img.photographerUrl || '',
        is_primary: score === highestScore && idx === 0,
        quality_score: Math.round(score * 100) / 100,
        fetched_at: new Date().toISOString(),
      }));

      try {
        const { error } = await supabase.from(TABLES.destinationImages).insert(newImages);
        if (error) throw error;
      } catch (err) {
        console.error(`[images/refresh] Insert error for ${dest.city}:`, err);
      }

      results.push({
        id: dest.id,
        city: dest.city,
        images: topImages.length,
        rejected,
      });
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
