// User data API — dispatches on ?action=list|save|unsave|get-prefs|save-prefs
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { verifyClerkToken } from '../utils/clerkAuth';
import { logApiError } from '../utils/apiLogger';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { savedActionSchema, savedBodySchema, savePrefsBodySchema, validateRequest } from '../utils/validation';
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

async function handleSavePrefs(
  userId: string,
  updates: { departure_city?: string; departure_code?: string; onboarding_completed?: boolean },
  res: VercelResponse,
) {
  // Filter out undefined keys so we only send defined values to DB
  const cleanUpdates: Record<string, unknown> = {};
  if (updates.departure_city !== undefined) cleanUpdates.departure_city = updates.departure_city;
  if (updates.departure_code !== undefined) cleanUpdates.departure_code = updates.departure_code;
  if (updates.onboarding_completed !== undefined) cleanUpdates.onboarding_completed = updates.onboarding_completed;

  const { data: existing, error: findError } = await supabase
    .from(TABLES.userPreferences)
    .select('*')
    .eq('user_id', userId)
    .limit(1);
  if (findError) throw findError;

  if ((existing ?? []).length > 0) {
    const { error } = await supabase
      .from(TABLES.userPreferences)
      .update(cleanUpdates)
      .eq('id', existing![0].id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(TABLES.userPreferences).insert({
      user_id: userId,
      ...cleanUpdates,
    });
    if (error) throw error;
  }
  return res.json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  // Rate limit: 30 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`saved:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests', { retryAfter });
  }

  // Validate action query param
  const actionValidation = validateRequest(savedActionSchema, req.query);
  if (!actionValidation.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Use ?action=list|save|unsave|get-prefs|save-prefs');
  }
  const { action } = actionValidation.data;

  const authResult = await verifyClerkToken(req.headers.authorization);
  if (!authResult) return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');

  try {
    switch (action) {
      case 'list':
        return await handleList(authResult.userId, res);
      case 'save': {
        const bodyV = validateRequest(savedBodySchema, req.body);
        if (!bodyV.success) return sendError(res, 400, 'VALIDATION_ERROR', bodyV.error);
        return await handleSave(authResult.userId, bodyV.data.destination_id, res);
      }
      case 'unsave': {
        const bodyV = validateRequest(savedBodySchema, req.body);
        if (!bodyV.success) return sendError(res, 400, 'VALIDATION_ERROR', bodyV.error);
        return await handleUnsave(authResult.userId, bodyV.data.destination_id, res);
      }
      case 'get-prefs':
        return await handleGetPrefs(authResult.userId, res);
      case 'save-prefs': {
        const prefsV = validateRequest(savePrefsBodySchema, req.body);
        if (!prefsV.success) return sendError(res, 400, 'VALIDATION_ERROR', prefsV.error);
        return await handleSavePrefs(authResult.userId, prefsV.data, res);
      }
      default:
        return sendError(res, 400, 'VALIDATION_ERROR', 'Use ?action=list|save|unsave|get-prefs|save-prefs');
    }
  } catch (err) {
    logApiError('api/saved', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to process saved trips');
  }
}
