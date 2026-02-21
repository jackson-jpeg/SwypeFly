import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';
import { ID } from 'node-appwrite';
import { fetchHotelRates } from '../../services/liteapi';
import { hotelPricesQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret) {
    const provided = authHeader?.replace('Bearer ', '') || '';
    if (provided !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const v = validateRequest(hotelPricesQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const destParam = v.data.destination || '';

  try {
    // Get destinations to refresh
    let destinations: Array<{ iata_code: string; city: string }>;
    if (destParam) {
      const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [
        Query.equal('iata_code', destParam),
        Query.equal('is_active', true),
        Query.limit(1),
      ]);
      if (result.documents.length === 0) {
        return res.status(404).json({ error: 'Destination not found' });
      }
      destinations = result.documents.map((d) => ({
        iata_code: d.iata_code as string,
        city: d.city as string,
      }));
    } else {
      const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [
        Query.equal('is_active', true),
        Query.limit(500),
      ]);
      destinations = result.documents.map((d) => ({
        iata_code: d.iata_code as string,
        city: d.city as string,
      }));
    }

    // Dates: check-in 30 days from now, 3-night stay
    const checkin = new Date(Date.now() + 30 * 86400000);
    const checkout = new Date(Date.now() + 33 * 86400000);
    const checkinStr = checkin.toISOString().split('T')[0];
    const checkoutStr = checkout.toISOString().split('T')[0];

    const results: Array<{ destination: string; price: number | null }> = [];

    // Get existing hotel price docs for upsert
    const existingMap = new Map<string, string>();
    try {
      const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedHotelPrices, [
        Query.limit(500),
      ]);
      for (const doc of existing.documents) {
        existingMap.set(doc.destination_iata as string, doc.$id);
      }
    } catch {
      // Collection may be empty
    }

    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < destinations.length; i += 5) {
      const batch = destinations.slice(i, i + 5);
      const promises = batch.map((d) => fetchHotelRates(d.iata_code, checkinStr, checkoutStr));
      const batchResults = await Promise.all(promises);

      for (let j = 0; j < batch.length; j++) {
        const dest = batch[j];
        const rate = batchResults[j];
        results.push({ destination: dest.iata_code, price: rate?.minPrice ?? null });

        if (rate) {
          const data = {
            destination_iata: dest.iata_code,
            price_per_night: rate.minPrice,
            currency: rate.currency,
            hotel_count: rate.hotelCount,
            source: 'liteapi',
            fetched_at: new Date().toISOString(),
          };

          try {
            const existingId = existingMap.get(dest.iata_code);
            if (existingId) {
              await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.cachedHotelPrices, existingId, data);
            } else {
              await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.cachedHotelPrices, ID.unique(), data);
            }
          } catch (err) {
            console.error(`[refresh-hotels] Upsert error for ${dest.iata_code}:`, err);
          }
        }
      }

      if (i + 5 < destinations.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const fetched = results.filter((r) => r.price !== null).length;
    console.log(`[refresh-hotels] Fetched ${fetched}/${destinations.length} hotel prices`);

    return res.status(200).json({
      fetched,
      total: destinations.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logApiError('api/prices/refresh-hotels', err);
    return res.status(500).json({ error: 'Hotel price refresh failed', detail: message });
  }
}
