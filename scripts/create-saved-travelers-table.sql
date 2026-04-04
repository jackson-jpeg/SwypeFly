-- Create saved_travelers table for storing reusable traveler profiles.
-- Run this in Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS saved_travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  born_on TEXT,
  gender TEXT,
  title TEXT,
  email TEXT,
  phone_number TEXT,
  passport_number_encrypted TEXT,
  passport_expiry TEXT,
  nationality TEXT DEFAULT 'US',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_travelers_user ON saved_travelers(user_id);

-- Generate an encryption key for passport data:
-- Run locally: openssl rand -hex 32
-- Then set TRAVELER_ENCRYPTION_KEY in Vercel environment variables.
