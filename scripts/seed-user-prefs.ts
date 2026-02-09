/**
 * Seed preference vectors for existing users based on their onboarding data.
 * Maps traveler_type -> preference vector and budget_level -> budget_numeric.
 *
 * Run: npx tsx scripts/seed-user-prefs.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] = rest.join('=').trim();
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ─── Traveler type -> preference vector mapping ─────────────────────

const TYPE_TO_PREFS: Record<string, Record<string, number>> = {
  beach: {
    pref_beach: 0.9, pref_nature: 0.6, pref_city: 0.3,
    pref_adventure: 0.4, pref_culture: 0.3, pref_nightlife: 0.4, pref_food: 0.5,
  },
  city: {
    pref_city: 0.9, pref_nightlife: 0.7, pref_food: 0.6,
    pref_culture: 0.5, pref_beach: 0.3, pref_adventure: 0.3, pref_nature: 0.2,
  },
  adventure: {
    pref_adventure: 0.9, pref_nature: 0.7, pref_beach: 0.4,
    pref_culture: 0.4, pref_city: 0.2, pref_nightlife: 0.2, pref_food: 0.4,
  },
  culture: {
    pref_culture: 0.9, pref_food: 0.7, pref_city: 0.5,
    pref_adventure: 0.4, pref_nature: 0.3, pref_beach: 0.3, pref_nightlife: 0.3,
  },
};

const BUDGET_TO_NUMERIC: Record<string, number> = {
  budget: 1,
  comfortable: 2,
  luxury: 3,
};

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const { data: users, error } = await supabase
    .from('user_preferences')
    .select('user_id, traveler_type, budget_level');

  if (error || !users) {
    console.error('Failed to fetch user preferences:', error?.message);
    process.exit(1);
  }

  console.log(`Processing ${users.length} user preference rows...`);

  let updated = 0;
  for (const user of users) {
    const prefs = user.traveler_type
      ? TYPE_TO_PREFS[user.traveler_type] || {}
      : {};

    const budgetNumeric = user.budget_level
      ? BUDGET_TO_NUMERIC[user.budget_level] || 2
      : 2;

    const travelStyle = user.traveler_type || 'explorer';

    const { error: updateErr } = await supabase
      .from('user_preferences')
      .update({
        ...prefs,
        budget_numeric: budgetNumeric,
        travel_style: travelStyle,
      })
      .eq('user_id', user.user_id);

    if (updateErr) {
      console.error(`Failed to update user ${user.user_id}:`, updateErr.message);
    } else {
      updated++;
    }
  }

  console.log(`Successfully updated ${updated}/${users.length} user preferences.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
