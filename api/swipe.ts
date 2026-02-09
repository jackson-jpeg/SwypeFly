import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

// ─── Learning rates per swipe action ────────────────────────────────

const LEARNING_RATES: Record<string, number> = {
  saved: 0.2,
  viewed: 0.1,
  skipped: -0.05,
};

const FEATURE_KEYS = [
  'beach_score', 'city_score', 'adventure_score',
  'culture_score', 'nightlife_score', 'nature_score', 'food_score',
] as const;

const PREF_KEYS = [
  'pref_beach', 'pref_city', 'pref_adventure',
  'pref_culture', 'pref_nightlife', 'pref_nature', 'pref_food',
] as const;

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { destination_id, action, time_spent_ms, price_shown } = req.body as {
      destination_id: string;
      action: string;
      time_spent_ms?: number;
      price_shown?: number;
    };

    if (!destination_id || !action) {
      return res.status(400).json({ error: 'Missing destination_id or action' });
    }

    if (!['viewed', 'skipped', 'saved'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // 1. Insert swipe history
    const { error: insertErr } = await supabase
      .from('swipe_history')
      .insert({
        user_id: user.id,
        destination_id,
        action,
        time_spent_ms: time_spent_ms ?? null,
        price_shown: price_shown ?? null,
      });

    if (insertErr) {
      console.error('[swipe] Insert error:', insertErr.message);
    }

    // 2. Update user preference vectors (only for meaningful actions)
    const lr = LEARNING_RATES[action];
    if (lr !== undefined && lr !== 0) {
      // Fetch destination feature vector
      const { data: dest } = await supabase
        .from('destinations')
        .select(FEATURE_KEYS.join(', '))
        .eq('id', destination_id)
        .single();

      if (dest) {
        // Fetch current user prefs
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select(PREF_KEYS.join(', '))
          .eq('user_id', user.id)
          .single();

        if (prefs) {
          const updates: Record<string, number> = {};
          const destRec = dest as unknown as Record<string, number>;
          const prefRec = prefs as unknown as Record<string, number>;

          for (let i = 0; i < FEATURE_KEYS.length; i++) {
            const destFeature = destRec[FEATURE_KEYS[i]] ?? 0;
            const oldPref = prefRec[PREF_KEYS[i]] ?? 0.5;
            // new_pref = old_pref + lr * (dest_feature - old_pref), clamped to [0, 1]
            const newPref = Math.max(0, Math.min(1, oldPref + lr * (destFeature - oldPref)));
            updates[PREF_KEYS[i]] = Math.round(newPref * 1000) / 1000; // 3 decimal places
          }

          const { error: updateErr } = await supabase
            .from('user_preferences')
            .update(updates)
            .eq('user_id', user.id);

          if (updateErr) {
            console.error('[swipe] Pref update error:', updateErr.message);
          }
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/swipe]', err);
    return res.status(500).json({ error: 'Failed to record swipe' });
  }
}
