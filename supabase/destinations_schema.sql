-- SoGoJet Phase 2: Add destinations table
-- Run this in the Supabase SQL Editor AFTER schema.sql
-- (cached_prices and saved_trips already exist in schema.sql)

-- ─── Destinations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS destinations (
  id            TEXT PRIMARY KEY,
  iata_code     TEXT NOT NULL,
  city          TEXT NOT NULL,
  country       TEXT NOT NULL,
  tagline       TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  image_url     TEXT NOT NULL DEFAULT '',
  image_urls    TEXT[] DEFAULT '{}',
  flight_price  NUMERIC NOT NULL DEFAULT 0,
  hotel_price_per_night NUMERIC NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  vibe_tags     TEXT[] DEFAULT '{}',
  rating        NUMERIC NOT NULL DEFAULT 0,
  review_count  INTEGER NOT NULL DEFAULT 0,
  best_months   TEXT[] DEFAULT '{}',
  average_temp  NUMERIC NOT NULL DEFAULT 0,
  flight_duration TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_active ON destinations (is_active);
CREATE INDEX IF NOT EXISTS idx_destinations_iata ON destinations (iata_code);

-- RLS: public read, service_role write
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destinations' AND policyname = 'Destinations are publicly readable') THEN
    CREATE POLICY "Destinations are publicly readable"
      ON destinations FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destinations' AND policyname = 'Service role can manage destinations') THEN
    CREATE POLICY "Service role can manage destinations"
      ON destinations FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Add service_role write policy to saved_trips if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_trips' AND policyname = 'Service role can manage all saved trips') THEN
    CREATE POLICY "Service role can manage all saved trips"
      ON saved_trips FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;
