/**
 * Supabase server SDK — used in Vercel serverless functions.
 * Drop-in replacement for appwriteServer.ts.
 * Uses service_role key for full database access (bypasses RLS).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\\n/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(/\\n/g, '').trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[FATAL] Supabase credentials not configured — database operations will fail');
}

// Use a dummy URL in test/CI environments where env vars aren't set
const effectiveUrl = supabaseUrl || 'https://placeholder.supabase.co';
const effectiveKey = supabaseServiceKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: { persistSession: false },
});

export const TABLES = {
  destinations: 'destinations',
  savedTrips: 'saved_trips',
  userPreferences: 'user_preferences',
  swipeHistory: 'swipe_history',
  cachedPrices: 'cached_prices',
  cachedHotelPrices: 'cached_hotel_prices',
  destinationImages: 'destination_images',
  aiCache: 'ai_cache',
  priceAlerts: 'price_alerts',
  subscribers: 'subscribers',
  bookings: 'bookings',
  bookingPassengers: 'booking_passengers',
  priceCalendar: 'price_calendar',
  priceHistoryStats: 'price_history_stats',
} as const;
