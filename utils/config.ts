/**
 * Shared constants for the SoGoJet backend.
 * Import these instead of redefining magic numbers in individual API files.
 */

/** Price is considered stale after this many ms (30 minutes). */
export const STALE_PRICE_MS = 30 * 60 * 1000;

/** Max concurrent Duffel API searches. */
export const DUFFEL_CONCURRENCY = 15;

/** Destinations per cron refresh batch. */
export const REFRESH_BATCH_SIZE = 200;

/** Feed page size for pagination. */
export const FEED_PAGE_SIZE = 10;

/** Threshold for price direction changes (5%). */
export const PRICE_CHANGE_THRESHOLD = 0.05;

// ─── Hotel refresh constants ────────────────────────────────────────────────

/** Hotels searched per batch in cron refresh. */
export const HOTEL_BATCH_SIZE = 3;

/** Delay between hotel search batches (ms). */
export const HOTEL_BATCH_DELAY_MS = 1500;

/** Radius for hotel geo-search (km). */
export const HOTEL_SEARCH_RADIUS_KM = 10;

/** Default hotel stay length for pricing (nights). */
export const HOTEL_STAY_NIGHTS = 3;

/** Number of top hotel results to keep per destination. */
export const HOTEL_TOP_RESULTS = 5;

// ─── Image refresh constants ────────────────────────────────────────────────

/** Destinations per image-refresh run. */
export const IMAGE_BATCH_SIZE = 8;
