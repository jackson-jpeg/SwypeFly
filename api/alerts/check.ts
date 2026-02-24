// Cron endpoint: checks all active price alerts against current destination prices
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '') || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all active alerts
    const alerts = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.priceAlerts, [
      Query.equal('is_active', true),
      Query.limit(100),
    ]);

    let triggered = 0;
    let checked = 0;

    for (const alert of alerts.documents) {
      checked++;
      try {
        const dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, alert.destination_id);
        const currentPrice = dest.live_price ?? dest.flight_price;

        if (currentPrice && currentPrice <= alert.target_price) {
          // Price hit target — mark as triggered
          await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.priceAlerts, alert.$id, {
            is_active: false,
            triggered_at: new Date().toISOString(),
            triggered_price: currentPrice,
          });
          triggered++;
          // TODO: send email notification to alert.email
        }
      } catch {
        // Skip individual alert errors
      }
    }

    res.json({ checked, triggered, total: alerts.total });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to check alerts';
    res.status(500).json({ error: message });
  }
}
