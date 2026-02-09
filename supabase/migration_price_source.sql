-- Add source column to cached_prices to track where each price came from
ALTER TABLE cached_prices ADD COLUMN IF NOT EXISTS source text DEFAULT 'estimate';

-- Create cached_hotel_prices table for LiteAPI hotel pricing
CREATE TABLE IF NOT EXISTS cached_hotel_prices (
  destination_iata text PRIMARY KEY,
  price_per_night integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  hotel_count integer DEFAULT 0,
  source text DEFAULT 'estimate',
  fetched_at timestamptz DEFAULT now()
);
