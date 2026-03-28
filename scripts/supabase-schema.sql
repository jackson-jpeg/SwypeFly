-- ============================================
-- SoGoJet Database Schema — Supabase Migration
-- ============================================

-- 1. Destinations (master catalog)
CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  iata_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  continent TEXT,
  tagline TEXT,
  description TEXT,
  image_url TEXT,
  image_urls TEXT[] DEFAULT '{}',
  flight_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  hotel_price_per_night DOUBLE PRECISION,
  currency TEXT DEFAULT 'USD',
  vibe_tags TEXT[] DEFAULT '{}',
  rating DOUBLE PRECISION,
  review_count INTEGER,
  best_months TEXT[] DEFAULT '{}',
  average_temp INTEGER,
  flight_duration TEXT,
  available_flight_days TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  beach_score DOUBLE PRECISION DEFAULT 0,
  city_score DOUBLE PRECISION DEFAULT 0,
  adventure_score DOUBLE PRECISION DEFAULT 0,
  culture_score DOUBLE PRECISION DEFAULT 0,
  nightlife_score DOUBLE PRECISION DEFAULT 0,
  nature_score DOUBLE PRECISION DEFAULT 0,
  food_score DOUBLE PRECISION DEFAULT 0,
  popularity_score DOUBLE PRECISION DEFAULT 0,
  itinerary_json TEXT,
  restaurants_json TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dest_active ON destinations(is_active);
CREATE INDEX IF NOT EXISTS idx_dest_iata ON destinations(iata_code);

-- 2. Saved Trips
CREATE TABLE IF NOT EXISTS saved_trips (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  saved_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_user_dest ON saved_trips(user_id, destination_id);

-- 3. User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE,
  traveler_type TEXT,
  budget_level TEXT,
  budget_numeric DOUBLE PRECISION DEFAULT 2,
  departure_city TEXT DEFAULT 'Tampa',
  departure_code TEXT DEFAULT 'TPA',
  currency TEXT DEFAULT 'USD',
  pref_beach DOUBLE PRECISION DEFAULT 0.5,
  pref_city DOUBLE PRECISION DEFAULT 0.5,
  pref_adventure DOUBLE PRECISION DEFAULT 0.5,
  pref_culture DOUBLE PRECISION DEFAULT 0.5,
  pref_nightlife DOUBLE PRECISION DEFAULT 0.5,
  pref_nature DOUBLE PRECISION DEFAULT 0.5,
  pref_food DOUBLE PRECISION DEFAULT 0.5,
  has_completed_onboarding BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pref_user ON user_preferences(user_id);

-- 4. Swipe History
CREATE TABLE IF NOT EXISTS swipe_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  action TEXT NOT NULL,
  time_spent_ms INTEGER,
  price_shown DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_swipe_user ON swipe_history(user_id);

-- 5. Cached Prices
CREATE TABLE IF NOT EXISTS cached_prices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  origin TEXT NOT NULL,
  destination_iata TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'USD',
  airline TEXT,
  airline_code TEXT,
  duration TEXT,
  source TEXT,
  departure_date TEXT,
  return_date TEXT,
  trip_duration_days INTEGER,
  previous_price DOUBLE PRECISION,
  price_direction TEXT,
  fetched_at TEXT,
  offer_json TEXT,
  offer_expires_at TEXT,
  flight_number TEXT,
  tp_found_at TEXT,
  deal_score DOUBLE PRECISION,
  deal_tier TEXT,
  quality_score DOUBLE PRECISION,
  price_percentile DOUBLE PRECISION,
  is_nonstop BOOLEAN,
  total_stops INTEGER,
  max_layover_minutes INTEGER,
  total_travel_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_origin ON cached_prices(origin);
CREATE INDEX IF NOT EXISTS idx_price_origin_dest ON cached_prices(origin, destination_iata);
CREATE INDEX IF NOT EXISTS idx_price_fetched ON cached_prices(fetched_at);
-- Compound index for feed queries that filter by origin + sort by departure_date
CREATE INDEX IF NOT EXISTS idx_price_origin_departure ON cached_prices(origin, departure_date);
-- Compound index for destinations with active filter + iata lookup
CREATE INDEX IF NOT EXISTS idx_dest_active_iata ON destinations(is_active, iata_code);

-- 6. Cached Hotel Prices
CREATE TABLE IF NOT EXISTS cached_hotel_prices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  destination_iata TEXT NOT NULL,
  price_per_night DOUBLE PRECISION,
  currency TEXT DEFAULT 'USD',
  hotel_count INTEGER,
  source TEXT,
  fetched_at TEXT,
  hotels_json TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hotel_dest ON cached_hotel_prices(destination_iata);

-- 7. Destination Images
CREATE TABLE IF NOT EXISTS destination_images (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  destination_id TEXT NOT NULL,
  unsplash_id TEXT,
  url_raw TEXT,
  url_regular TEXT,
  url_small TEXT,
  blur_hash TEXT,
  photographer TEXT,
  photographer_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  quality_score DOUBLE PRECISION DEFAULT 0,
  fetched_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_img_dest ON destination_images(destination_id);

-- 8. AI Cache
CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  content TEXT,
  created_at TEXT,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_type ON ai_cache(type);
CREATE INDEX IF NOT EXISTS idx_ai_key ON ai_cache(key);

-- 9. Price Alerts
CREATE TABLE IF NOT EXISTS price_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  email TEXT,
  destination_id TEXT NOT NULL,
  target_price DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT,
  triggered_at TEXT,
  triggered_price DOUBLE PRECISION,
  price_source TEXT,
  drop_percent DOUBLE PRECISION,
  rolling_avg DOUBLE PRECISION,
  drop_from_avg_percent DOUBLE PRECISION,
  trigger_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_alert_active ON price_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_dest ON price_alerts(destination_id);
CREATE INDEX IF NOT EXISTS idx_alert_user ON price_alerts(user_id);

-- 10. Subscribers
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  subscribed_at TEXT,
  source TEXT DEFAULT 'web',
  unsubscribed_at TEXT,
  resubscribed_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_sub_active ON subscribers(active);

-- 11. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  duffel_order_id TEXT,
  status TEXT DEFAULT 'pending',
  total_amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'USD',
  passenger_count INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  destination_city TEXT,
  destination_iata TEXT,
  origin_iata TEXT,
  departure_date TEXT,
  return_date TEXT,
  airline TEXT,
  booking_reference TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_booking_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_stripe ON bookings(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_booking_duffel ON bookings(duffel_order_id);
CREATE INDEX IF NOT EXISTS idx_booking_status ON bookings(status);

-- 12. Booking Passengers
CREATE TABLE IF NOT EXISTS booking_passengers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_id TEXT NOT NULL,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  born_on TEXT,
  gender TEXT,
  title TEXT,
  email TEXT NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passenger_booking ON booking_passengers(booking_id);

-- 13. Price Calendar
CREATE TABLE IF NOT EXISTS price_calendar (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  origin TEXT NOT NULL,
  destination_iata TEXT NOT NULL,
  date TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  return_date TEXT,
  trip_days INTEGER,
  airline TEXT,
  source TEXT,
  fetched_at TEXT,
  deal_score DOUBLE PRECISION,
  deal_tier TEXT,
  quality_score DOUBLE PRECISION,
  price_percentile DOUBLE PRECISION,
  is_nonstop BOOLEAN,
  total_stops INTEGER,
  max_layover_minutes INTEGER,
  total_travel_minutes INTEGER,
  destination_id TEXT,
  city TEXT,
  country TEXT,
  savings_percent DOUBLE PRECISION,
  usual_price DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cal_origin ON price_calendar(origin);
CREATE INDEX IF NOT EXISTS idx_cal_origin_dest ON price_calendar(origin, destination_iata);
CREATE INDEX IF NOT EXISTS idx_cal_origin_dest_date ON price_calendar(origin, destination_iata, date);
CREATE INDEX IF NOT EXISTS idx_cal_deal_score ON price_calendar(deal_score DESC);
CREATE INDEX IF NOT EXISTS idx_cal_origin_score ON price_calendar(origin, deal_score DESC);
CREATE INDEX IF NOT EXISTS idx_cal_fetched ON price_calendar(fetched_at);

-- 14. Price History Stats
CREATE TABLE IF NOT EXISTS price_history_stats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  origin TEXT,
  destination_iata TEXT,
  price_min DOUBLE PRECISION,
  price_max DOUBLE PRECISION,
  price_median DOUBLE PRECISION,
  price_p25 DOUBLE PRECISION,
  price_p75 DOUBLE PRECISION,
  sample_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stats_origin_dest ON price_history_stats(origin, destination_iata);

-- Disable RLS on all tables (server-side access via service_role key)
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipe_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_hotel_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE destination_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history_stats ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, but add policies for public read on destinations/prices
CREATE POLICY "Public read destinations" ON destinations FOR SELECT USING (true);
CREATE POLICY "Public read cached_prices" ON cached_prices FOR SELECT USING (true);
CREATE POLICY "Public read price_calendar" ON price_calendar FOR SELECT USING (true);
CREATE POLICY "Public read cached_hotel_prices" ON cached_hotel_prices FOR SELECT USING (true);
CREATE POLICY "Public read destination_images" ON destination_images FOR SELECT USING (true);
