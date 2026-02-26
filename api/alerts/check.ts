// Cron endpoint: checks all active price alerts against current destination prices
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';
import { sendPriceAlertEmail } from '../../utils/email';

async function sendAlertEmail(
  email: string,
  destinationId: string,
  currentPrice: number,
  targetPrice: number,
): Promise<void> {
  // Try to get destination name for a nicer email
  let destName = destinationId;
  try {
    const dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, destinationId);
    destName = `${dest.city}, ${dest.country}`;
  } catch {
    // Use ID as fallback
  }
  await sendPriceAlertEmail(email, destName, currentPrice, targetPrice);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret — fail closed if not configured
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' });
  }
  const secret = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (secret !== cronSecret) {
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
        // Look up the cheapest cached price across all origins for this destination
        const priceResults = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
          Query.equal('destination_iata', alert.destination_id),
          Query.orderAsc('price'),
          Query.limit(1),
        ]);

        let currentPrice: number | null = null;
        if (priceResults.documents.length > 0) {
          currentPrice = priceResults.documents[0].price as number;
        } else {
          // Fallback to flight_price on destination document
          try {
            const dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, alert.destination_id);
            currentPrice = (dest.flight_price as number) || null;
          } catch {
            // Destination not found
          }
        }

        if (currentPrice && currentPrice <= alert.target_price) {
          // Price hit target — mark as triggered
          await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.priceAlerts, alert.$id, {
            is_active: false,
            triggered_at: new Date().toISOString(),
            triggered_price: currentPrice,
          });
          triggered++;

          // Send email notification if email is set
          if (alert.email) {
            try {
              await sendAlertEmail(
                alert.email as string,
                alert.destination_id as string,
                currentPrice,
                alert.target_price as number,
              );
            } catch (emailErr) {
              console.error(`[alerts/check] Email send failed for ${alert.$id}:`, emailErr);
            }
          }
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
