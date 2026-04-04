// User data API — dispatches on ?action=list|save|unsave|get-prefs|save-prefs
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { verifyClerkToken } from '../utils/clerkAuth';
import { logApiError } from '../utils/apiLogger';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { cors } from './_cors.js';
import { sendError } from '../utils/apiResponse';

async function handleList(userId: string, res: VercelResponse) {
  const { data, error } = await supabase
    .from(TABLES.savedTrips)
    .select('*')
    .eq('user_id', userId)
    .limit(100);
  if (error) throw error;
  const ids = (data ?? []).map((d) => d['destination_id'] as string);
  return res.json({ savedIds: ids });
}

async function handleSave(userId: string, destinationId: string, res: VercelResponse) {
  // Deduplication: check if already saved
  const { data: existing, error: existingError } = await supabase
    .from(TABLES.savedTrips)
    .select('*')
    .eq('user_id', userId)
    .eq('destination_id', destinationId)
    .limit(1);
  if (existingError) throw existingError;
  if ((existing ?? []).length > 0) return res.json({ ok: true });

  const { error } = await supabase.from(TABLES.savedTrips).insert({
    user_id: userId,
    destination_id: destinationId,
    saved_at: new Date().toISOString(),
  });
  if (error) throw error;
  return res.json({ ok: true });
}

async function handleUnsave(userId: string, destinationId: string, res: VercelResponse) {
  const { data: result, error: findError } = await supabase
    .from(TABLES.savedTrips)
    .select('*')
    .eq('user_id', userId)
    .eq('destination_id', destinationId)
    .limit(1);
  if (findError) throw findError;
  if (result?.[0]) {
    const { error } = await supabase
      .from(TABLES.savedTrips)
      .delete()
      .eq('id', result[0].id);
    if (error) throw error;
  }
  return res.json({ ok: true });
}

// ─── User preferences ────────────────────────────────────────────────

async function handleGetPrefs(userId: string, res: VercelResponse) {
  const { data, error } = await supabase
    .from(TABLES.userPreferences)
    .select('*')
    .eq('user_id', userId)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    return res.json({ preferences: null });
  }
  const doc = data[0];
  return res.json({
    preferences: {
      departure_city: doc.departure_city,
      departure_code: doc.departure_code,
      onboarding_completed: doc.onboarding_completed,
    },
  });
}

async function handleSavePrefs(userId: string, body: Record<string, unknown>, res: VercelResponse) {
  const updates: Record<string, unknown> = {};
  if (typeof body.departure_city === 'string') updates.departure_city = body.departure_city;
  if (typeof body.departure_code === 'string') updates.departure_code = body.departure_code;
  if (typeof body.onboarding_completed === 'boolean') updates.onboarding_completed = body.onboarding_completed;

  if (Object.keys(updates).length === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');
  }

  const { data: existing, error: findError } = await supabase
    .from(TABLES.userPreferences)
    .select('*')
    .eq('user_id', userId)
    .limit(1);
  if (findError) throw findError;

  if ((existing ?? []).length > 0) {
    const { error } = await supabase
      .from(TABLES.userPreferences)
      .update(updates)
      .eq('id', existing![0].id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(TABLES.userPreferences).insert({
      user_id: userId,
      ...updates,
    });
    if (error) throw error;
  }
  return res.json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  // Rate limit: 30 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`saved:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests', { retryAfter });
  }

  const authResult = await verifyClerkToken(req.headers.authorization);
  if (!authResult) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');

  const action = String(req.query.action || '');

  try {
    switch (action) {
      case 'list':
        return handleList(authResult.userId, res);
      case 'save': {
        const destId = String(req.body?.destination_id || '');
        if (!destId) return sendError(res, 400, 'VALIDATION_ERROR', 'Missing destination_id');
        return handleSave(authResult.userId, destId, res);
      }
      case 'unsave': {
        const destId = String(req.body?.destination_id || '');
        if (!destId) return sendError(res, 400, 'VALIDATION_ERROR', 'Missing destination_id');
        return handleUnsave(authResult.userId, destId, res);
      }
      case 'get-prefs':
        return handleGetPrefs(authResult.userId, res);
      case 'save-prefs':
        return handleSavePrefs(authResult.userId, req.body || {}, res);
      default:
        return sendError(res, 400, 'VALIDATION_ERROR', 'Use ?action=list|save|unsave|get-prefs|save-prefs');
    }
  } catch (err) {
    logApiError('api/saved', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to process saved trips');
  }
}
