/**
 * Shared constants for the SoGoJet backend.
 * Import these instead of redefining magic numbers in individual API files.
 */

/** Price is considered stale after this many ms (15 minutes). */
export const STALE_PRICE_MS = 15 * 60 * 1000;

/** If a Duffel offer expires within this window, treat as stale and re-fetch (5 min). */
export const OFFER_EXPIRY_SAFETY_MS = 5 * 60 * 1000;

/** Max concurrent Duffel API searches. */
export const DUFFEL_CONCURRENCY = 15;

/** Destinations per cron refresh batch. */
export const REFRESH_BATCH_SIZE = 200;

// ─── Live-prices-parity search tuning ───────────────────────────────────────

/** How many months ahead to consider when hunting for the cheapest roundtrip. */
export const SEARCH_WINDOW_MONTHS = 6;

/** Reject offers whose worst layover exceeds this (hours). */
export const MAX_LAYOVER_HOURS = 8;

/**
 * Reject offers where time_at_destination < MIN_DEST_TIME_RATIO × total_flight_time.
 * Prevents e.g. 20h total flight time with 2h actual visit.
 */
export const MIN_DEST_TIME_RATIO = 4;

/**
 * Trip-length buckets (nights to try) keyed by one-way flight-duration range (hours).
 * Order within each array matters — earlier entries are tried first during the
 * cost-controlled narrow search (we only keep the top 2 most-likely).
 */
export const TRIP_LENGTH_BUCKETS: Array<{ maxFlightHours: number; nights: number[] }> = [
  { maxFlightHours: 2, nights: [3, 4, 2, 5] }, // long weekend bias
  { maxFlightHours: 5, nights: [5, 4, 3, 6, 7] },
  { maxFlightHours: 9, nights: [7, 8, 5, 10] },
  { maxFlightHours: Infinity, nights: [10, 12, 7, 14] },
];

/** Departure months (offsets from now) sampled per route for the narrow search. */
export const SEARCH_MONTH_OFFSETS = [1, 3, 5];

/** Trip-length candidates tried per route after classification (top-K of the bucket). */
export const TRIP_LENGTHS_PER_ROUTE = 2;

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
