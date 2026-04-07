import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { priceAlertBodySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { verifyClerkToken } from '../utils/clerkAuth';
import { cors } from './_cors.js';
import { sendError, sendSuccess } from '../utils/apiResponse';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  // Rate limit: 20 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`price-alert:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests', { retryAfter });
  }

  // Auth optional — guests must provide email
  const authResult = await verifyClerkToken(req.headers.authorization);
  const userId = authResult?.userId ?? null;

  const v = validateRequest(priceAlertBodySchema, req.body);
  if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);
  const { destination_id, target_price, email } = v.data;

  if (!userId && !email) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Email required for guest price alerts');
  }

  try {
    // Check for existing active alert on this destination
    const existQuery = supabase
      .from(TABLES.priceAlerts)
      .select('*')
      .eq('destination_id', destination_id)
      .eq('is_active', true)
      .limit(1);
    if (userId) existQuery.eq('user_id', userId);
    else if (email) existQuery.eq('email', email);
    const { data: existing, error: listErr } = await existQuery;
    if (listErr) throw listErr;

    // Update existing alert if one exists
    if (existing && existing.length > 0) {
      const { data: updated, error: updateErr } = await supabase
        .from(TABLES.priceAlerts)
        .update({ target_price })
        .eq('id', existing[0].id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      return sendSuccess(res, { alert: updated, updated: true }, 200);
    }

    // Create new alert
    const { data: alert, error: insertErr } = await supabase
      .from(TABLES.priceAlerts)
      .insert({
        user_id: userId || 'guest',
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

    return sendSuccess(res, { alert, created: true }, 201);
  } catch (err) {
    logApiError('api/price-alert', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to create price alert');
  }
}
