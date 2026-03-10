// Consolidated alerts API — dispatches on ?action=create|check|list|delete
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Query, ID } from 'node-appwrite';
import { serverDatabases, DATABASE_ID, COLLECTIONS } from '../services/appwriteServer';
import { priceAlertBodySchema, priceAlertDeleteSchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { verifyClerkToken } from '../utils/clerkAuth';
import { cors } from './_cors.js';

// ─── Price history helpers ──────────────────────────────────────────────────

interface PriceSnapshot {
  price: number;
  source: string;
  airline: string;
  timestamp: string;
}

/**
 * Fetch recent price history snapshots from ai_cache for a route.
 * Returns snapshots from the last `days` days.
 */
async function getPriceHistory(
  destinationIata: string,
  days = 7,
): Promise<PriceSnapshot[]> {
  const snapshots: PriceSnapshot[] = [];
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Query ai_cache for price_history entries matching this destination
    // The key format is `${origin}-${destination_iata}`, so we match the suffix
    const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.aiCache, [
      Query.equal('type', 'price_history'),
      Query.greaterThan('created_at', cutoff),
      Query.limit(500),
    ]);

    for (const doc of result.documents) {
      const key = doc.key as string;
      // Match any origin for this destination (key ends with -IATA)
      if (key.endsWith(`-${destinationIata}`)) {
        try {
          const parsed = JSON.parse(doc.content as string) as PriceSnapshot;
          snapshots.push(parsed);
        } catch {
          // Skip malformed entries
        }
      }
    }
  } catch {
    // ai_cache query failed — return empty
  }

  return snapshots;
}

/**
 * Calculate rolling average from price snapshots.
 */
function calculateRollingAverage(snapshots: PriceSnapshot[]): number | null {
  if (snapshots.length === 0) return null;
  const sum = snapshots.reduce((acc, s) => acc + s.price, 0);
  return Math.round(sum / snapshots.length);
}

// ─── Create alert ────────────────────────────────────────────────────────────

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`alerts-create:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  const authResult = await verifyClerkToken(req.headers.authorization);
  if (!authResult) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = authResult.userId;

  const v = validateRequest(priceAlertBodySchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { destination_id, target_price, email } = v.data;

  try {
    const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.priceAlerts, [
      Query.equal('user_id', userId),
      Query.equal('destination_id', destination_id),
      Query.equal('is_active', true),
    ]);

    if (existing.total > 0) {
      const doc = existing.documents[0];
      const updated = await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.priceAlerts, doc.$id, {
        target_price,
      });
      return res.json({ alert: updated, updated: true });
    }

    const alert = await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.priceAlerts, ID.unique(), {
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
  try {
    const { sendPriceAlertEmail } = await import('../utils/email.js');
    await sendPriceAlertEmail(email, destName, currentPrice, targetPrice);
  } catch (importErr) {
    console.warn(`[alerts] Email utility not available, skipping send for ${destName}:`, importErr);
  }
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
        // Look up destination to get IATA code (alert.destination_id is an Appwrite doc ID)
        let dest;
        try {
          dest = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.destinations, alert.destination_id as string);
        } catch {
          // Destination not found — skip this alert
          continue;
        }

        const iataCode = dest.iata_code as string;

        const priceResults = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
          Query.equal('destination_iata', iataCode),
          Query.orderAsc('price'),
          Query.limit(1),
        ]);

        let currentPrice: number | null = null;
        let priceSource = 'estimate';
        if (priceResults.documents.length > 0) {
          currentPrice = priceResults.documents[0].price as number;
          priceSource = (priceResults.documents[0].source as string) || 'cached';
        } else {
          currentPrice = (dest.flight_price as number) || null;
        }

        // Check trigger conditions:
        // 1. Current price <= user's target price
        // 2. Current price is >15% below the 7-day rolling average
        const belowTarget = currentPrice != null && currentPrice <= alert.target_price;

        let rollingAvg: number | null = null;
        let dropFromAvgPercent = 0;
        let belowRollingAvg = false;

        if (currentPrice != null) {
          const snapshots = await getPriceHistory(iataCode, 7);
          rollingAvg = calculateRollingAverage(snapshots);
          if (rollingAvg != null && rollingAvg > 0) {
            dropFromAvgPercent = Math.round(((rollingAvg - currentPrice) / rollingAvg) * 100);
            belowRollingAvg = dropFromAvgPercent > 15;
          }
        }

        if (belowTarget || belowRollingAvg) {
          const dropPercent = alert.target_price > 0
            ? Math.round(((alert.target_price as number) - (currentPrice as number)) / (alert.target_price as number) * 100)
            : 0;
          await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.priceAlerts, alert.$id, {
            is_active: false,
            triggered_at: new Date().toISOString(),
            triggered_price: currentPrice,
            price_source: priceSource,
            drop_percent: dropPercent,
            rolling_avg: rollingAvg ?? 0,
            drop_from_avg_percent: dropFromAvgPercent,
            trigger_reason: belowTarget ? 'target_price' : 'rolling_avg_drop',
          });
          triggered++;

          if (alert.email) {
            try {
              await sendAlertEmail(
                alert.email as string,
                alert.destination_id as string,
                currentPrice as number,
                alert.target_price as number,
              );
            } catch (emailErr) {
              console.error(`[alerts/check] Email send failed for ${alert.$id}:`, emailErr);
            }
          }
        }
      } catch (err) {
        logApiError(`api/alerts/check/${alert.$id}`, err);
      }
    }

    res.json({ checked, triggered, total: alerts.total });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to check alerts';
    res.status(500).json({ error: message });
  }
}

// ─── List alerts ────────────────────────────────────────────────────────────

async function handleList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const authResult = await verifyClerkToken(req.headers.authorization);
  if (!authResult) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = authResult.userId;

  try {
    const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.priceAlerts, [
      Query.equal('user_id', userId),
      Query.orderDesc('created_at'),
      Query.limit(50),
    ]);

    const alerts = result.documents.map((doc) => ({
      id: doc.$id,
      destinationId: doc.destination_id,
      targetPrice: doc.target_price,
      isActive: doc.is_active,
      createdAt: doc.created_at,
      triggeredAt: doc.triggered_at || null,
      triggeredPrice: doc.triggered_price || null,
    }));

    res.json({ alerts, total: result.total });
  } catch (err: unknown) {
    logApiError('api/alerts/list', err);
    const message = err instanceof Error ? err.message : 'Failed to list alerts';
    res.status(500).json({ error: message });
  }
}

// ─── Delete alert ─────────────────────────────────────────────────────────────

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE' && req.method !== 'POST')
    return res.status(405).json({ error: 'DELETE or POST only' });

  const authResult = await verifyClerkToken(req.headers.authorization);
  if (!authResult) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = authResult.userId;

  const v = validateRequest(priceAlertDeleteSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { alertId } = v.data;

  try {
    // Fetch the alert first to verify ownership
    const doc = await serverDatabases.getDocument(DATABASE_ID, COLLECTIONS.priceAlerts, alertId);
    if (doc.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this alert' });
    }

    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.priceAlerts, alertId);
    res.json({ deleted: true, alertId });
  } catch (err: unknown) {
    logApiError('api/alerts/delete', err);
    const message = err instanceof Error ? err.message : 'Failed to delete alert';
    res.status(500).json({ error: message });
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const action = String(req.query.action || '');

  switch (action) {
    case 'create':
      return handleCreate(req, res);
    case 'list':
      return handleList(req, res);
    case 'check':
      return handleCheck(req, res);
    case 'delete':
      return handleDelete(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid action parameter. Use ?action=create, ?action=list, ?action=check, or ?action=delete' });
  }
}
