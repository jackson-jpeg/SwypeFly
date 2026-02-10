-- Phase 1: Images, flight dates, and price history

-- ─── 1a. New destination_images table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS destination_images (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  destination_id TEXT NOT NULL,
  unsplash_id TEXT NOT NULL,
  url_raw TEXT NOT NULL,
  url_regular TEXT NOT NULL,    -- 1080w
  url_small TEXT NOT NULL,      -- 400w
  blur_hash TEXT,
  photographer TEXT,
  photographer_url TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(destination_id, unsplash_id)
);

CREATE INDEX IF NOT EXISTS idx_destination_images_dest
  ON destination_images (destination_id, is_primary);

ALTER TABLE destination_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read destination_images" ON destination_images
  FOR SELECT USING (true);

CREATE POLICY "Service role write destination_images" ON destination_images
  FOR ALL USING (auth.role() = 'service_role');


-- ─── 1b. Add columns to cached_prices ───────────────────────────────────
ALTER TABLE cached_prices
  ADD COLUMN IF NOT EXISTS departure_date DATE,
  ADD COLUMN IF NOT EXISTS return_date DATE,
  ADD COLUMN IF NOT EXISTS trip_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS previous_price NUMERIC,
  ADD COLUMN IF NOT EXISTS price_direction TEXT DEFAULT 'stable';
  -- price_direction: 'up' | 'down' | 'stable'


-- ─── 1c. Add unsplash_query to destinations ─────────────────────────────
ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS unsplash_query TEXT;
