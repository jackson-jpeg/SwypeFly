// Consolidated alerts API — dispatches on ?action=create|check
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Account, Databases, Query, ID } from 'node-appwrite';
import { serverDatabases, DATABASE_ID, COLLECTIONS } from '../services/appwriteServer';
import { priceAlertBodySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
// Lazy-imported in handleCheck to avoid Resend SDK init at module level
// import { sendPriceAlertEmail } from '../utils/email';

// ─── Create alert ────────────────────────────────────────────────────────────

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`alerts-create:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jwt = authHeader.replace('Bearer ', '');

  let userId: string;
  try {
    const userClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
      .setProject(process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '')
      .setJWT(jwt);
    const userAccount = new Account(userClient);
    const user = await userAccount.get();
    userId = user.$id;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const v = validateRequest(priceAlertBodySchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { destination_id, target_price, email } = v.data;

  try {
    const adminClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
      .setProject(process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '')
      .setKey(process.env.APPWRITE_API_KEY ?? '');
    const db = new Databases(adminClient);

    const existing = await db.listDocuments(DATABASE_ID, COLLECTIONS.priceAlerts, [
      Query.equal('user_id', userId),
      Query.equal('destination_id', destination_id),
      Query.equal('is_active', true),
    ]);

    if (existing.total > 0) {
      const doc = existing.documents[0];
      const updated = await db.updateDocument(DATABASE_ID, COLLECTIONS.priceAlerts, doc.$id, {
        target_price,
      });
      return res.json({ alert: updated, updated: true });
    }

    const alert = await db.createDocument(DATABASE_ID, COLLECTIONS.priceAlerts, ID.unique(), {
      user_id: userId,
      email: email || null,
      destination_id,
      target_price,
      is_active: true,
      created_at: new Date().toISOString(),
      triggered_at: null,
    });

    res.json({ alert, created: true });
  } catch (err: unknown) {
    logApiError('api/alerts/create', err);
    const message = err instanceof Error ? err.message : 'Failed to create alert';
    res.status(500).json({ error: message });
  }
}

// ─── Check alerts (cron) ─────────────────────────────────────────────────────

async function sendAlertEmail(
  email: string,
  destinationId: string,
  currentPrice: number,
  targetPrice: number,
): Promise<void> {
  let destName = destinationId;
  try {
    const dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, destinationId);
    destName = `${dest.city}, ${dest.country}`;
  } catch {
    // Use ID as fallback
  }
  const { sendPriceAlertEmail } = await import('../utils/email');
  await sendPriceAlertEmail(email, destName, currentPrice, targetPrice);
}

async function handleCheck(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(503).json({ error: 'CRON_SECRET not configured' });
  const secret = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (secret !== cronSecret) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const alerts = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.priceAlerts, [
      Query.equal('is_active', true),
      Query.limit(100),
    ]);

    let triggered = 0;
    let checked = 0;

    for (const alert of alerts.documents) {
      checked++;
      try {
        const priceResults = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
          Query.equal('destination_iata', alert.destination_id),
          Query.orderAsc('price'),
          Query.limit(1),
        ]);

        let currentPrice: number | null = null;
        if (priceResults.documents.length > 0) {
          currentPrice = priceResults.documents[0].price as number;
        } else {
          try {
            const dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, alert.destination_id);
            currentPrice = (dest.flight_price as number) || null;
          } catch {
            // Destination not found
          }
        }

        if (currentPrice && currentPrice <= alert.target_price) {
          await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.priceAlerts, alert.$id, {
            is_active: false,
            triggered_at: new Date().toISOString(),
            triggered_price: currentPrice,
          });
          triggered++;

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

// ─── Router ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '');

  switch (action) {
    case 'create':
      return handleCreate(req, res);
    case 'check':
      return handleCheck(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid action parameter. Use ?action=create or ?action=check' });
  }
}
