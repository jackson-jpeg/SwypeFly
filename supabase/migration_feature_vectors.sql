-- ============================================================
-- SwypeFly — Feature Vectors Migration
-- Run this in the Supabase SQL Editor
-- Adds feature vector columns to destinations, preference
-- vectors to user_preferences, and tracking columns to swipe_history.
-- All use IF NOT EXISTS / DEFAULT so existing data is preserved.
-- ============================================================

-- ─── 2A: Destinations feature vectors ──────────────────────────────

ALTER TABLE destinations ADD COLUMN IF NOT EXISTS continent TEXT;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS beach_score NUMERIC DEFAULT 0;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS city_score NUMERIC DEFAULT 0;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS adventure_score NUMERIC DEFAULT 0;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS culture_score NUMERIC DEFAULT 0;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS nightlife_score NUMERIC DEFAULT 0;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS nature_score NUMERIC DEFAULT 0;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS food_score NUMERIC DEFAULT 0;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS budget_level INTEGER DEFAULT 2;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS popularity_score NUMERIC DEFAULT 0;

-- ─── 2B: User preference vectors ──────────────────────────────────

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS travel_style TEXT DEFAULT 'explorer';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS pref_beach NUMERIC DEFAULT 0.5;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS pref_city NUMERIC DEFAULT 0.5;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS pref_adventure NUMERIC DEFAULT 0.5;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS pref_culture NUMERIC DEFAULT 0.5;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS pref_nightlife NUMERIC DEFAULT 0.5;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS pref_nature NUMERIC DEFAULT 0.5;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS pref_food NUMERIC DEFAULT 0.5;

-- Note: departure_code and budget_level already exist in schema.sql.
-- budget_level in user_preferences is TEXT ('budget','comfortable','luxury'),
-- so we add a numeric version for scoring:
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS budget_numeric INTEGER DEFAULT 2;

-- ─── 2C: Swipe history enhancements ──────────────────────────────

ALTER TABLE swipe_history ADD COLUMN IF NOT EXISTS time_spent_ms INTEGER;
ALTER TABLE swipe_history ADD COLUMN IF NOT EXISTS price_shown NUMERIC;

-- ─── Service role policies for swipe_history (needed for api/swipe.ts) ─

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'swipe_history' AND policyname = 'Service role can manage swipe history') THEN
    CREATE POLICY "Service role can manage swipe history"
      ON swipe_history FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Service role policy for user_preferences (needed for preference learning)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Service role can manage user preferences') THEN
    CREATE POLICY "Service role can manage user preferences"
      ON user_preferences FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;
