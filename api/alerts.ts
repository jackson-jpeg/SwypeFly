// Consolidated alerts API — dispatches on ?action=create|check|list|delete
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
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
    const { data: rows, error } = await supabase
      .from(TABLES.aiCache)
      .select('*')
      .eq('type', 'price_history')
      .gt('created_at', cutoff)
      .limit(500);

    if (error) throw error;
    const result = rows ?? [];

    for (const doc of result) {
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
    const { data: existingRows, error: listErr } = await supabase
      .from(TABLES.priceAlerts)
      .select('*')
      .eq('user_id', userId)
      .eq('destination_id', destination_id)
      .eq('is_active', true)
      .limit(1);
    if (listErr) throw listErr;

    if (existingRows && existingRows.length > 0) {
      const doc = existingRows[0];
      const { data: updated, error: updateErr } = await supabase
        .from(TABLES.priceAlerts)
        .update({ target_price })
        .eq('id', doc.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      return res.json({ alert: updated, updated: true });
    }

    const { data: alert, error: insertErr } = await supabase
      .from(TABLES.priceAlerts)
      .insert({
        user_id: userId,
        email: email || null,
        destination_id,
        target_price,
        is_active: true,
        created_at: new Date().toISOString(),
        triggered_at: null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

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
    const { data: dest } = await supabase
      .from(TABLES.destinations)
      .select('city, country')
      .eq('id', destinationId)
      .single();
    if (dest) destName = `${dest.city}, ${dest.country}`;
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
    // Paginate through all active alerts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allAlerts: any[] = [];
    let offset = 0;
    const BATCH = 100;
    while (true) {
      const { data: batch, error: batchErr } = await supabase
        .from(TABLES.priceAlerts)
        .select('*')
        .eq('is_active', true)
        .limit(BATCH)
        .range(offset, offset + BATCH - 1);
      if (batchErr) throw batchErr;
      allAlerts = allAlerts.concat(batch ?? []);
      if (!batch || batch.length < BATCH) break;
      offset += BATCH;
    }

    let triggered = 0;
    let checked = 0;

    for (const alert of allAlerts) {
      checked++;
      try {
        // Look up destination to get IATA code
        const { data: dest, error: destErr } = await supabase
          .from(TABLES.destinations)
          .select('iata_code, flight_price')
          .eq('id', alert.destination_id as string)
          .single();
        if (destErr || !dest) continue;

        const iataCode = dest.iata_code as string;

        const { data: priceRows, error: priceErr } = await supabase
          .from(TABLES.cachedPrices)
          .select('price, source')
          .eq('destination_iata', iataCode)
          .order('price', { ascending: true })
          .limit(1);
        const priceResults = { documents: priceRows ?? [] };
        if (priceErr) throw priceErr;

        let currentPrice: number | null = null;
        let priceSource = 'estimate';
        if (priceResults.documents.length > 0) {
          currentPrice = priceResults.documents[0].price as number;
          priceSource = (priceResults.documents[0].source as string) || 'cached';
        } else {
          currentPrice = (dest.flight_price as number) ?? null;
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
          const { error: triggerErr } = await supabase
            .from(TABLES.priceAlerts)
            .update({
              is_active: false,
              triggered_at: new Date().toISOString(),
              triggered_price: currentPrice,
              price_source: priceSource,
              drop_percent: dropPercent,
              rolling_avg: rollingAvg ?? 0,
              drop_from_avg_percent: dropFromAvgPercent,
              trigger_reason: belowTarget ? 'target_price' : 'rolling_avg_drop',
            })
            .eq('id', alert.id);
          if (triggerErr) throw triggerErr;
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
              console.error(`[alerts/check] Email send failed for ${alert.id}:`, emailErr);
            }
          }
        }
      } catch (err) {
        logApiError(`api/alerts/check/${alert.id}`, err);
      }
    }

    res.json({ checked, triggered, total: allAlerts.length });
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
    const { data: rows, error: listErr, count } = await supabase
      .from(TABLES.priceAlerts)
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (listErr) throw listErr;

    const alerts = (rows ?? []).map((doc) => ({
      id: doc.id,
      destinationId: doc.destination_id,
      targetPrice: doc.target_price,
      isActive: doc.is_active,
      createdAt: doc.created_at,
      triggeredAt: doc.triggered_at || null,
      triggeredPrice: doc.triggered_price || null,
    }));

    res.json({ alerts, total: count ?? alerts.length });
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
    const { data: doc, error: fetchErr } = await supabase
      .from(TABLES.priceAlerts)
      .select('user_id')
      .eq('id', alertId)
      .single();
    if (fetchErr || !doc) return res.status(404).json({ error: 'Alert not found' });
    if (doc.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this alert' });
    }

    const { error: deleteErr } = await supabase
      .from(TABLES.priceAlerts)
      .delete()
      .eq('id', alertId);
    if (deleteErr) throw deleteErr;
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
