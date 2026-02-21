import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';
import { ID } from 'node-appwrite';
import { searchDestinationImages } from '../../services/unsplash';
import { logApiError } from '../../utils/apiLogger';

export const maxDuration = 60;

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
    const destResult = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [
      Query.equal('is_active', true),
      Query.limit(500),
    ]);

    const destinations = destResult.documents.map((d) => ({
      id: d.$id,
      city: d.city as string,
      country: d.country as string,
      unsplash_query: (d.unsplash_query as string) || '',
    }));

    // Get the latest fetch time per destination from destination_images
    let imageMetaDocs: Array<Record<string, unknown>> = [];
    try {
      const imgResult = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinationImages, [
        Query.orderDesc('fetched_at'),
        Query.limit(500),
      ]);
      imageMetaDocs = imgResult.documents;
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
      try {
        const oldImages = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinationImages, [
          Query.equal('destination_id', dest.id),
          Query.limit(100),
        ]);
        for (const doc of oldImages.documents) {
          await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.destinationImages, doc.$id);
        }
      } catch {
        // May not exist yet
      }

      for (let idx = 0; idx < images.length; idx++) {
        const img = images[idx];
        try {
          await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.destinationImages, ID.unique(), {
            destination_id: dest.id,
            unsplash_id: img.unsplashId,
            url_raw: img.urlRaw || '',
            url_regular: img.urlRegular || '',
            url_small: img.urlSmall || '',
            blur_hash: img.blurHash || '',
            photographer: img.photographer || '',
            photographer_url: img.photographerUrl || '',
            is_primary: idx === 0,
            fetched_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error(`[images/refresh] Insert error for ${dest.city}:`, err);
        }
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
