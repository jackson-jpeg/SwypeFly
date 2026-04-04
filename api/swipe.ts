import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { swipeBodySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { verifyClerkToken } from '../utils/clerkAuth';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { cors } from './_cors.js';
import { sendError } from '../utils/apiResponse';

// ─── Learning rates per swipe action ────────────────────────────────

const LEARNING_RATES: Record<string, number> = {
  saved: 0.2,
  viewed: 0.1,
  skipped: -0.05,
};

const FEATURE_KEYS = [
  'beach_score',
  'city_score',
  'adventure_score',
  'culture_score',
  'nightlife_score',
  'nature_score',
  'food_score',
] as const;

const PREF_KEYS = [
  'pref_beach',
  'pref_city',
  'pref_adventure',
  'pref_culture',
  'pref_nightlife',
  'pref_nature',
  'pref_food',
] as const;

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  // Rate limit: 30 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`swipe:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests', { retryAfter });
  }

  // Auth is optional — guests can swipe, we just skip preference learning
  const authResult = await verifyClerkToken(req.headers.authorization);
  const userId = authResult?.userId ?? null;

  try {

    const v = validateRequest(swipeBodySchema, req.body);
    if (!v.success) return sendError(res, 400, 'VALIDATION_ERROR', v.error);
    const { destination_id, action, time_spent_ms, price_shown } = v.data;

    // 1. Insert swipe history (only for auth'd users)
    if (userId) {
      try {
        const { error } = await supabase.from(TABLES.swipeHistory).insert({
          user_id: userId,
          destination_id,
          action,
          time_spent_ms: time_spent_ms ?? 0,
          price_shown: price_shown ?? 0,
        });
        if (error) throw error;
      } catch (err) {
        logApiError('api/swipe/history', err);
      }
    }

    // 2. Update user preference vectors (only for auth'd users)
    const lr = LEARNING_RATES[action];
    if (userId && lr !== undefined && lr !== 0) {
      try {
        // Fetch destination feature vector
        const { data: dest, error: destError } = await supabase
          .from(TABLES.destinations)
          .select('*')
          .eq('id', destination_id)
          .single();
        if (destError) throw destError;

        // Fetch current user prefs
        const { data: prefsRows, error: prefsError } = await supabase
          .from(TABLES.userPreferences)
          .select('*')
          .eq('user_id', userId)
          .limit(1);
        if (prefsError) throw prefsError;

        if (dest) {
          let prefs = prefsRows?.[0] ?? null;

          if (!prefs) {
            // Create default preferences for new user
            const defaults: Record<string, unknown> = { user_id: userId };
            for (const key of PREF_KEYS) defaults[key] = 0.5;
            const { data: newPrefs, error: createError } = await supabase
              .from(TABLES.userPreferences)
              .insert(defaults)
              .select()
              .single();
            if (createError) throw createError;
            if (!newPrefs) throw new Error('Failed to create user preferences');
            prefs = newPrefs;
          }

          const updates: Record<string, number> = {};

          for (let i = 0; i < FEATURE_KEYS.length; i++) {
            const destFeature = (dest[FEATURE_KEYS[i]] as number) ?? 0;
            const oldPref = (prefs[PREF_KEYS[i]] as number) ?? 0.5;
            const newPref = Math.max(0, Math.min(1, oldPref + lr * (destFeature - oldPref)));
            updates[PREF_KEYS[i]] = Math.round(newPref * 1000) / 1000;
          }

          const { error: updateError } = await supabase
            .from(TABLES.userPreferences)
            .update(updates)
            .eq('id', prefs.id);
          if (updateError) throw updateError;
        }
      } catch (err) {
        logApiError('api/swipe/pref-update', err);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    logApiError('api/swipe', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to record swipe');
  }
}
