import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { feedQuerySchema, budgetDiscoveryQuerySchema, detectOriginQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { generateAviasalesLink } from '../utils/affiliateLinks';
import { verifyClerkToken } from '../utils/clerkAuth';
import { fetchByPriceRange, detectOriginAirport } from '../services/travelpayouts';
import { searchFlights } from '../services/duffel';
import { cors } from './_cors.js';
import { bulkGetRouteStats } from '../utils/priceStats';
import { nearbyAirports } from '../data/airports';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';

const PAGE_SIZE = 10;

// On-demand pricing may need up to ~30s for 10 destinations (5 concurrent × 2-3s each)
export const maxDuration = 60;

// ─── On-demand Duffel pricing for feed destinations ─────────────────
// When a destination on the current page has no cached Duffel price,
// search Duffel live, cache the result, and return the real fare.
// This ensures every card in the feed shows a real bookable price.

/**
 * Generate multiple date windows for smarter price discovery.
 * Instead of searching only 2 weeks out on a Wednesday, we search:
 * - 2-3 weeks out (midweek) — typical sweet spot for deals
 * - 4-6 weeks out (midweek) — advance purchase discount window
 * - 6-8 weeks out (weekend) — flexibility window
 * Trip lengths: 5-7 days (not too short, not too long)
 */
function getFeedSearchDates(): { departureDate: string; returnDate: string } {
  const now = new Date();

  // Pick one of 3 windows randomly for diversity across requests
  const windows = [
    { minDays: 14, maxDays: 21, tripDays: 7 },  // 2-3 weeks, 1 week trip
    { minDays: 28, maxDays: 42, tripDays: 5 },  // 4-6 weeks, 5 day trip
    { minDays: 42, maxDays: 56, tripDays: 6 },  // 6-8 weeks, 6 day trip
  ];
  const window = windows[Math.floor(Math.random() * windows.length)];

  const daysOut = window.minDays + Math.floor(Math.random() * (window.maxDays - window.minDays));
  const departure = new Date(now.getTime() + daysOut * 86400000);

  // Prefer midweek departures (Tue-Thu) — cheapest days to fly
  const day = departure.getDay();
  if (day === 0) departure.setDate(departure.getDate() + 2); // Sun → Tue
  else if (day === 1) departure.setDate(departure.getDate() + 1); // Mon → Tue
  else if (day === 5) departure.setDate(departure.getDate() - 1); // Fri → Thu
  else if (day === 6) departure.setDate(departure.getDate() + 3); // Sat → Tue

  const returnDate = new Date(departure.getTime() + window.tripDays * 86400000);
  return {
    departureDate: departure.toISOString().split('T')[0],
    returnDate: returnDate.toISOString().split('T')[0],
  };
}

// In-memory cache for on-demand prices (avoids re-searching within the same lambda)
interface OnDemandPrice {
  price: number;
  airline: string;
  duration: string;
  fetchedAt: string;
  departureDate: string;
  returnDate: string;
}

const onDemandPriceCache = new Map<string, OnDemandPrice | null>();

async function fetchLivePriceForDest(
  origin: string,
  destIata: string,
): Promise<OnDemandPrice | null> {
  const cacheKey = `${origin}-${destIata}`;
  if (onDemandPriceCache.has(cacheKey)) return onDemandPriceCache.get(cacheKey) ?? null;

  try {
    const { departureDate, returnDate } = getFeedSearchDates();
    const result = await searchFlights({
      origin,
      destination: destIata,
      departureDate,
      returnDate,
      passengers: [{ type: 'adult' }],
      cabinClass: 'economy',
    });

    const offers = (result as any).offers as any[] | undefined;
    if (!offers || offers.length === 0) {
      onDemandPriceCache.set(cacheKey, null);
      return null;
    }

    offers.sort((a: any, b: any) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
    const cheapest = offers[0];
    const price = Math.round(parseFloat(cheapest.total_amount));
    const firstSeg = cheapest.slices?.[0]?.segments?.[0];
    const airline = firstSeg?.operating_carrier?.name || firstSeg?.operating_carrier?.iata_code || '';

    // Calculate total duration from segments
    let duration = '';
    const outSlice = cheapest.slices?.[0];
    if (outSlice?.duration) {
      const match = outSlice.duration.match(/PT(\d+)H(\d+)?M?/);
      if (match) duration = `${match[1]}h ${match[2] || '0'}m`;
    }

    const fetchedAt = new Date().toISOString();
    const priceData: OnDemandPrice = { price, airline, duration, fetchedAt, departureDate, returnDate };
    onDemandPriceCache.set(cacheKey, priceData);

    // Write to cached_prices in the background so future requests are instant
    supabase
      .from(TABLES.cachedPrices)
      .upsert(
        {
          origin,
          destination_iata: destIata,
          price,
          currency: 'USD',
          airline,
          duration,
          source: 'duffel',
          fetched_at: fetchedAt,
          departure_date: departureDate,
          return_date: returnDate,
          trip_duration_days: 7,
        },
        { onConflict: 'origin,destination_iata' },
      )
      .then(
        () => {},
        (err: unknown) => { console.warn('[feed] price cache write failed:', err instanceof Error ? err.message : err); },
      );

    return priceData;
  } catch (err) {
    console.warn(`[feed] On-demand Duffel search failed for ${origin}->${destIata}:`, err instanceof Error ? err.message : err);
    onDemandPriceCache.set(cacheKey, null);
    return null;
  }
}

const ON_DEMAND_CONCURRENCY = 15;

async function fillMissingPrices(
  page: ReturnType<typeof toFrontend>[],
  origin: string,
): Promise<ReturnType<typeof toFrontend>[]> {
  const missing = page.filter((d) => !d.flightPrice || d.flightPrice <= 0);
  if (missing.length === 0) return page;

  // Search missing destinations in parallel, capped at ON_DEMAND_CONCURRENCY
  const chunks: typeof missing[] = [];
  for (let i = 0; i < missing.length; i += ON_DEMAND_CONCURRENCY) {
    chunks.push(missing.slice(i, i + ON_DEMAND_CONCURRENCY));
  }

  const priceResults = new Map<string, OnDemandPrice>();
  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (d) => {
        const result = await fetchLivePriceForDest(origin, d.iataCode);
        if (result) priceResults.set(d.iataCode, result);
      }),
    );
    // Brief pause between chunks to respect Duffel rate limits (100ms instead of 500ms — concurrent cap already handles load)
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Merge live prices into the page
  return page.map((d) => {
    if (d.flightPrice && d.flightPrice > 0) return d;
    const live = priceResults.get(d.iataCode);
    if (!live) return d; // Duffel had no results for this route
    return {
      ...d,
      flightPrice: live.price,
      livePrice: live.price,
      priceSource: 'duffel' as const,
      priceFetchedAt: live.fetchedAt,
      airline: live.airline || d.airline,
      flightDuration: live.duration || d.flightDuration,
      departureDate: live.departureDate,
      returnDate: live.returnDate,
      tripDurationDays: 7,
    };
  });
}

// ─── Seeded PRNG (consistent within a day, fresh next day) ──────────

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
}

// ─── Region / Vibe helpers ──────────────────────────────────────────

// ─── Sub-region mapping for feed diversity ──────────────────────────
// 16 sub-regions prevent showing 4 European cities in a row or
// 3 Southeast Asian destinations back-to-back.

const COUNTRY_REGION: Record<string, string> = {
  // Europe — split into 3 sub-regions by proximity + vibe
  france: 'eu-west', spain: 'eu-west', portugal: 'eu-west', uk: 'eu-west', ireland: 'eu-west', belgium: 'eu-west', netherlands: 'eu-west',
  italy: 'eu-med', greece: 'eu-med', croatia: 'eu-med', turkey: 'eu-med', malta: 'eu-med', montenegro: 'eu-med', albania: 'eu-med', cyprus: 'eu-med',
  iceland: 'eu-north', norway: 'eu-north', sweden: 'eu-north', denmark: 'eu-north', finland: 'eu-north', switzerland: 'eu-north', austria: 'eu-north', germany: 'eu-north', 'czech republic': 'eu-north', poland: 'eu-north', hungary: 'eu-north',
  // Asia — split into 4 sub-regions
  thailand: 'asia-se', vietnam: 'asia-se', cambodia: 'asia-se', myanmar: 'asia-se', laos: 'asia-se', singapore: 'asia-se', malaysia: 'asia-se',
  indonesia: 'asia-island', philippines: 'asia-island', maldives: 'asia-island', 'sri lanka': 'asia-island', fiji: 'asia-island',
  japan: 'asia-east', 'south korea': 'asia-east', taiwan: 'asia-east', china: 'asia-east', 'hong kong': 'asia-east',
  india: 'asia-south', nepal: 'asia-south', bangladesh: 'asia-south',
  // Latin America — split into 3 sub-regions
  mexico: 'latam-mex', belize: 'latam-mex', guatemala: 'latam-mex', 'costa rica': 'latam-central', panama: 'latam-central', honduras: 'latam-central', nicaragua: 'latam-central', 'el salvador': 'latam-central',
  colombia: 'latam-south', peru: 'latam-south', ecuador: 'latam-south', bolivia: 'latam-south',
  brazil: 'latam-brazil', argentina: 'latam-brazil', chile: 'latam-brazil', uruguay: 'latam-brazil',
  // Caribbean
  jamaica: 'caribbean', 'dominican republic': 'caribbean', bahamas: 'caribbean', cuba: 'caribbean', 'puerto rico': 'caribbean', 'trinidad and tobago': 'caribbean', barbados: 'caribbean', aruba: 'caribbean', 'st lucia': 'caribbean',
  // Africa & Middle East — split into 2
  morocco: 'africa', 'south africa': 'africa', kenya: 'africa', tanzania: 'africa', egypt: 'africa', ghana: 'africa', ethiopia: 'africa',
  uae: 'middle-east', israel: 'middle-east', jordan: 'middle-east', qatar: 'middle-east', oman: 'middle-east', 'saudi arabia': 'middle-east',
  // Oceania
  australia: 'oceania', 'new zealand': 'oceania',
  // North America
  usa: 'domestic', canada: 'americas',
};

function getRegion(d: ScoredDest): string {
  const country = ((d.country as string) || '').toLowerCase();
  if (COUNTRY_REGION[country]) return COUNTRY_REGION[country];

  // Fallback to continent
  if (d.continent) {
    const c = (d.continent as string).toLowerCase();
    if (c.includes('caribbean')) return 'caribbean';
    if (c.includes('south america') || c.includes('central america')) return 'latam-south';
    if (c.includes('europe')) return 'eu-west';
    if (c.includes('asia')) return 'asia-se';
    if (c.includes('africa') || c.includes('middle east')) return 'africa';
    if (c.includes('north america')) return country === 'usa' ? 'domestic' : 'americas';
    if (c.includes('oceania')) return 'oceania';
  }
  return 'other';
}

// ─── Vibe bucketing — multi-tag matching for better diversity ─────────
// Uses ALL tags (not just primary) to compute the best-fit bucket.
// 10 buckets provide much finer diversity than the original 6.

const VIBE_BUCKET_TAGS: Record<string, string[]> = {
  'beach-tropical': ['beach', 'tropical'],
  'beach-luxury': ['luxury', 'romantic', 'beach'],
  'mountain-adventure': ['mountain', 'adventure', 'winter', 'hiking'],
  'nature-relaxation': ['nature', 'wellness', 'relaxation'],
  'city-nightlife': ['city', 'nightlife', 'urban'],
  'city-culture': ['culture', 'historic', 'foodie', 'art'],
  'island-escape': ['island', 'tropical', 'diving', 'snorkeling'],
  'budget-backpacker': ['budget', 'backpacker', 'adventure'],
  'luxury-romantic': ['luxury', 'romantic', 'spa', 'honeymoon'],
  'off-beaten-path': ['offbeat', 'unique', 'hidden', 'authentic'],
};

function getVibeBucket(tags: string[]): string {
  if (!tags || tags.length === 0) return 'other';
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));

  let bestBucket = 'other';
  let bestScore = 0;
  for (const [bucket, keywords] of Object.entries(VIBE_BUCKET_TAGS)) {
    const matches = keywords.filter((k) => tagSet.has(k)).length;
    // Weight by match ratio + bonus for total matches
    const score = matches / keywords.length + matches * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestBucket = bucket;
    }
  }
  return bestBucket;
}

// ─── Types ──────────────────────────────────────────────────────────

interface ScoredDest {
  id: string;
  iata_code: string;
  city: string;
  country: string;
  continent?: string;
  tagline: string;
  description: string;
  image_url: string;
  image_urls: string[];
  flight_price: number;
  hotel_price_per_night: number;
  currency: string;
  vibe_tags: string[];
  rating: number;
  review_count: number;
  best_months: string[];
  average_temp: number;
  flight_duration: string;
  beach_score?: number;
  city_score?: number;
  adventure_score?: number;
  culture_score?: number;
  nightlife_score?: number;
  nature_score?: number;
  food_score?: number;
  popularity_score?: number;
  live_price?: number | null;
  live_airline?: string;
  live_duration?: string;
  price_source?: string;
  price_fetched_at?: string;
  departure_date?: string;
  return_date?: string;
  trip_duration_days?: number;
  previous_price?: number;
  price_direction?: string;
  offer_json?: string;
  offer_expires_at?: string;
  flight_number?: string;
  tp_found_at?: string;
  cheapest_date?: string;
  cheapest_return_date?: string;
  live_hotel_price?: number | null;
  hotel_price_source?: string;
  available_flight_days?: string[];
  latitude?: number;
  longitude?: number;
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number }[];
  hotels_data?: any[];
  // Deal quality fields (from cached_prices / price_calendar)
  deal_score?: number;
  deal_tier?: string;
  quality_score?: number;
  price_percentile?: number;
  is_nonstop?: boolean;
  total_stops?: number;
  max_layover_minutes?: number;
  total_travel_minutes?: number;
  // Computed from route stats
  usual_price?: number | null;
  savings_amount?: number | null;
  savings_percent?: number | null;
  // Price trend for sparkline
  price_history?: number[];
  // Nearby airport fallback
  nearby_origin?: string;        // e.g. "MCO" — set when deal is from a nearby airport
  nearby_origin_label?: string;  // e.g. "Orlando (1h drive)"
}

// ─── Generic scoring (for anonymous users) ──────────────────────────

// ─── Quiz preference types ────────────────────────────────────────

interface QuizPrefs {
  travelStyle?: 'budget' | 'comfort' | 'luxury';
  budgetLevel?: 'low' | 'medium' | 'high';
  preferredSeason?: 'spring' | 'summer' | 'fall' | 'winter';
  preferredVibes?: string[]; // e.g. ['adventure', 'culture']
}

// Map season name → month names that fall in that season
const SEASON_MONTHS: Record<string, string[]> = {
  spring: ['march', 'april', 'may'],
  summer: ['june', 'july', 'august'],
  fall: ['september', 'october', 'november'],
  winter: ['december', 'january', 'february'],
};

// Map quiz vibe IDs → destination vibe_tags they should match
const QUIZ_VIBE_MAP: Record<string, string[]> = {
  adventure: ['adventure', 'nature', 'mountain', 'winter'],
  culture: ['culture', 'historic', 'foodie', 'city'],
  romance: ['romantic', 'beach', 'tropical', 'luxury'],
  relaxation: ['beach', 'tropical', 'nature'],
};

function computeQuizBonus(d: ScoredDest, prefs: QuizPrefs, minPrice: number, maxPrice: number): number {
  let bonus = 0;
  const effectivePrice = d.live_price ?? d.flight_price;
  const priceRange = maxPrice - minPrice || 1;
  const priceNorm = (effectivePrice - minPrice) / priceRange; // 0 = cheapest, 1 = most expensive

  // Travel style bonus (+0.15)
  if (prefs.travelStyle === 'budget') {
    // Boost cheap destinations (lower price → higher bonus)
    bonus += (1 - priceNorm) * 0.15;
  } else if (prefs.travelStyle === 'luxury') {
    // Boost high-rated, higher-priced destinations
    const ratingNorm = Math.min((d.rating || 0) / 5, 1);
    bonus += (ratingNorm * 0.5 + priceNorm * 0.5) * 0.15;
  }
  // 'comfort' gets no style bonus — middle ground

  // Budget level bonus (+0.12)
  if (prefs.budgetLevel) {
    const budgetThresholds: Record<string, [number, number]> = {
      low: [0, 0.33],
      medium: [0.2, 0.7],
      high: [0.5, 1.0],
    };
    const [lo, hi] = budgetThresholds[prefs.budgetLevel];
    if (priceNorm >= lo && priceNorm <= hi) {
      bonus += 0.12;
    }
  }

  // Preferred season bonus (+0.10)
  if (prefs.preferredSeason && d.best_months.length > 0) {
    const seasonMonths = SEASON_MONTHS[prefs.preferredSeason] || [];
    const bestMonthsLower = d.best_months.map((m) => m.toLowerCase());
    const hasSeasonMatch = seasonMonths.some((m) => bestMonthsLower.includes(m));
    if (hasSeasonMatch) {
      bonus += 0.10;
    }
  }

  // Preferred vibes bonus (uncapped — scales with match quality)
  if (prefs.preferredVibes && prefs.preferredVibes.length > 0) {
    const destTags = new Set(d.vibe_tags.map((t) => t.toLowerCase()));
    let vibeMatches = 0;
    let totalExpanded = 0;
    for (const pref of prefs.preferredVibes) {
      const matchTags = QUIZ_VIBE_MAP[pref] || [pref];
      totalExpanded += matchTags.length;
      vibeMatches += matchTags.filter((t) => destTags.has(t)).length;
    }
    if (vibeMatches > 0 && totalExpanded > 0) {
      // Scale by match ratio: 100% match = +0.40, 50% = +0.20, 25% = +0.10
      const matchRatio = vibeMatches / totalExpanded;
      bonus += matchRatio * 0.40;
    }
  }

  return bonus;
}

function scoreFeedGeneric(
  destinations: ScoredDest[],
  rand: () => number = Math.random,
  quizPrefs?: QuizPrefs,
): ScoredDest[] {
  if (destinations.length <= 1) return destinations;

  const remaining = [...destinations];
  const result: ScoredDest[] = [];

  const prices = remaining.map((d) => d.live_price ?? d.flight_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const hasQuizPrefs = quizPrefs && (
    quizPrefs.travelStyle || quizPrefs.budgetLevel ||
    quizPrefs.preferredSeason || (quizPrefs.preferredVibes && quizPrefs.preferredVibes.length > 0)
  );

  const recentRegions: string[] = [];
  const recentVibes: string[] = [];
  const WINDOW = 4;

  // ── Pre-compute scoring signals per destination ──────────────────────
  // (Must happen before seed selection so the seed uses discovery/trend data)

  const signalMap = new Map<string, {
    discovery: number;     // Price anomaly + hidden gem bonus
    trend: number;         // Dropping price = exciting
    seasonality: number;   // In-season destinations rank higher
    valueDensity: number;  // Price per day (lower = better value)
    convenience: number;   // Flight duration + stops (shorter/nonstop = better)
    weekendGetaway: number; // Short cheap domestic = spontaneous trip potential
  }>();

  const currentMonth = new Date().getMonth();
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const currentMonthName = monthNames[currentMonth];
  const adjacentMonths = [monthNames[(currentMonth + 11) % 12], monthNames[(currentMonth + 1) % 12]];

  for (const d of remaining) {
    const price = d.live_price ?? d.flight_price;
    let discovery = 0;
    let trend = 0;
    let convenience = 0;
    let weekendGetaway = 0;
    let seasonality = 0;
    let valueDensity = 0;

    // Discovery: route-aware price anomaly detection
    const usual = d.usual_price as number | undefined;
    const destRegion = getRegion(d);
    const isDomestic = destRegion === 'domestic';
    if (price > 0 && usual && usual > 0) {
      const pctBelow = (usual - price) / usual;
      // Domestic routes have smaller swings — lower threshold
      const threshold = isDomestic ? 0.08 : 0.15;
      if (pctBelow > threshold) discovery += Math.min(0.50, pctBelow * 1.3);
    }

    // Discovery: hidden gem bonus — relative to region avg, not hard dollar cap
    const pop = (d.popularity_score as number) ?? 0.5;
    const regionAvg = isDomestic ? 250 : 500;
    const isAffordableForRegion = price > 0 && price < regionAvg * 1.2;
    if (pop < 0.3 && isAffordableForRegion) discovery += 0.15;
    if (pop < 0.15 && price > 0 && price < regionAvg) discovery += 0.12; // ultra-rare gem

    // Discovery: novelty bonus — recently found prices are more exciting
    const foundAt = d.tp_found_at as string | undefined;
    if (foundAt) {
      const ageHours = (Date.now() - new Date(foundAt).getTime()) / (1000 * 60 * 60);
      if (ageHours < 6) discovery += 0.08;  // Found in last 6 hours
      else if (ageHours < 24) discovery += 0.04; // Found in last day
    }

    // Trend: use price_history to detect dropping prices
    const history = d.price_history as number[] | undefined;
    if (history && history.length >= 3) {
      const recent = history.slice(-3);
      const older = history.slice(0, Math.max(1, history.length - 3));
      const recentAvg = recent.reduce((s, p) => s + p, 0) / recent.length;
      const olderAvg = older.reduce((s, p) => s + p, 0) / older.length;
      if (olderAvg > 0) {
        const dropPct = (olderAvg - recentAvg) / olderAvg;
        if (dropPct > 0.05) trend = Math.min(0.20, dropPct); // Price dropping = exciting
        else if (dropPct < -0.10) trend = -0.10; // Price rising = less interesting
      }
    }

    // Seasonality: boost destinations in their best travel months
    const bestMonths = (d.best_months as string[] | undefined) ?? [];
    if (bestMonths.length > 0) {
      const lower = bestMonths.map((m: string) => m.toLowerCase());
      if (lower.includes(currentMonthName)) seasonality = 0.15;
      else if (lower.some((m: string) => adjacentMonths.includes(m))) seasonality = 0.08;
    }

    // Value density: price per day of trip (lower = better bang for buck)
    const tripDays = (d.trip_duration_days as number) ?? 5;
    if (price > 0 && tripDays > 0) {
      const ppd = price / tripDays;
      // Scale: $30/day = excellent (1.0), $100/day = decent (0.5), $200/day = meh (0)
      valueDensity = Math.max(0, Math.min(0.15, (1 - ppd / 200) * 0.15));
    }

    // Convenience: shorter flights with fewer stops are less painful
    const duration = d.live_duration as string | undefined;
    const isNonstop = d.is_nonstop as boolean | undefined;
    const totalStops = d.total_stops as number | undefined;
    if (isNonstop) {
      convenience = 0.12; // Nonstop is a strong positive signal
    } else if (totalStops === 1) {
      convenience = 0.04; // 1 stop is acceptable
    } else if (totalStops != null && totalStops >= 2) {
      convenience = -0.05; // 2+ stops is a negative
    }
    // Short flight duration bonus (under 5h = easy day trip feel)
    if (duration) {
      const hours = parseInt(duration, 10);
      if (!isNaN(hours) && hours <= 5) convenience += 0.05;
    }

    // Weekend getaway detection: short, cheap, domestic = spontaneous trip
    if (destRegion === 'domestic' || destRegion === 'caribbean' || destRegion === 'latam-mex') {
      if (price > 0 && price < 250 && tripDays >= 2 && tripDays <= 4) {
        weekendGetaway = 0.15; // Strong boost for spontaneous weekend trips
      } else if (price > 0 && price < 350 && tripDays >= 2 && tripDays <= 5) {
        weekendGetaway = 0.08; // Moderate boost for affordable short trips
      }
    }

    signalMap.set(d.id, { discovery, trend, seasonality, valueDensity, convenience, weekendGetaway });
  }

  // Seed with the most compelling "wow" deal — uses all pre-computed signals
  remaining.sort((a, b) => {
    const sa = signalMap.get(a.id);
    const sb = signalMap.get(b.id);
    const pa = a.live_price ?? a.flight_price;
    const pb = b.live_price ?? b.flight_price;
    // Seed score: discovery + affordability + quality (not just cheapest popular)
    const seedA = (sa?.discovery ?? 0) + (pa > 0 ? 1 - pa / (maxPrice || 1) : 0) * 0.3
      + (sa?.trend ?? 0) + (sa?.seasonality ?? 0) + (sa?.convenience ?? 0)
      + (sa?.weekendGetaway ?? 0) + ((a.deal_score ?? 0) / 100) * 0.2;
    const seedB = (sb?.discovery ?? 0) + (pb > 0 ? 1 - pb / (maxPrice || 1) : 0) * 0.3
      + (sb?.trend ?? 0) + (sb?.seasonality ?? 0) + (sb?.convenience ?? 0)
      + (sb?.weekendGetaway ?? 0) + ((b.deal_score ?? 0) / 100) * 0.2;
    return seedB - seedA;
  });

  const seed = remaining.shift()!;
  result.push(seed);
  recentRegions.push(getRegion(seed));
  recentVibes.push(getVibeBucket(seed.vibe_tags));

  const recentCountries: string[] = [];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = remaining[i];
      const effectivePrice = d.live_price ?? d.flight_price;
      const region = getRegion(d);
      const vibe = getVibeBucket(d.vibe_tags);
      const country = (d.country as string) || '';
      const signals = signalMap.get(d.id);

      const priceScore = 1 - (effectivePrice - minPrice) / priceRange;

      // Region diversity: penalize seeing same region repeatedly
      let regionPenalty = 0;
      for (let j = 0; j < recentRegions.length; j++) {
        if (recentRegions[j] === region) regionPenalty += 1 - j / WINDOW;
      }

      // Country diversity: penalize same country back-to-back
      let countryPenalty = 0;
      for (let j = 0; j < Math.min(recentCountries.length, 3); j++) {
        if (recentCountries[j] === country) countryPenalty += 0.3 * (1 - j / 3);
      }

      let vibePenalty = 0;
      for (let j = 0; j < recentVibes.length; j++) {
        if (recentVibes[j] === vibe) vibePenalty += 1 - j / WINDOW;
      }
      const jitter = rand() * 0.12;

      // Penalty for very expensive flights (>$600)
      const expensivePenalty = effectivePrice > 600 ? (effectivePrice - 600) / 1500 : 0;

      // Deal quality bonus from deal engine
      const qualityBonus = d.deal_score != null ? (d.deal_score / 100) * 0.12 : 0;

      // Quiz personalization bonus (additive, optional)
      const quizBonus = hasQuizPrefs ? computeQuizBonus(d, quizPrefs!, minPrice, maxPrice) : 0;

      const score =
        priceScore * 0.22                          // Cheap is good, but not everything
        + (signals?.discovery ?? 0)                // Price anomalies + hidden gems (up to 0.55!)
        + (signals?.trend ?? 0)                    // Dropping prices are exciting
        + (signals?.seasonality ?? 0)              // Right time to visit
        + (signals?.valueDensity ?? 0)             // Bang for your buck
        + (signals?.convenience ?? 0)              // Nonstop/short flights
        + (signals?.weekendGetaway ?? 0)           // Spontaneous trip potential
        + qualityBonus                             // Comfortable flights
        - regionPenalty * 0.18                     // Don't show same region
        - countryPenalty                           // Don't show same country
        - vibePenalty * 0.08                       // Don't show same vibe
        - expensivePenalty                         // Penalize pricey flights
        + jitter                                   // Tie-breaking randomness
        + quizBonus;                               // User preferences

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // 15% exploration: pick signal-weighted random instead of top-scored
    // Biases toward high-discovery/high-trend items that scoring might miss
    let pickIdx = bestIdx;
    if (rand() < 0.15) {
      // Build exploration candidates weighted by discovery + trend signals
      const candidates = remaining.map((d, i) => {
        const s = signalMap.get(d.id);
        const p = d.live_price ?? d.flight_price;
        // Exploration weight: discovery matters most, plus affordability
        const w = (s?.discovery ?? 0) * 2 + (s?.trend ?? 0) + (s?.weekendGetaway ?? 0)
          + (p > 0 && p < 400 ? 0.2 : 0);
        return { i, w: Math.max(0.01, w) }; // minimum weight so everything has a chance
      });
      // Weighted random selection
      const totalW = candidates.reduce((s, c) => s + c.w, 0);
      let r = rand() * totalW;
      for (const c of candidates) {
        r -= c.w;
        if (r <= 0) { pickIdx = c.i; break; }
      }
    }

    const pick = remaining.splice(pickIdx, 1)[0];
    result.push(pick);
    recentRegions.unshift(getRegion(pick));
    recentVibes.unshift(getVibeBucket(pick.vibe_tags));
    recentCountries.unshift((pick.country as string) || '');
    if (recentRegions.length > WINDOW) recentRegions.pop();
    if (recentVibes.length > WINDOW) recentVibes.pop();
    if (recentCountries.length > 3) recentCountries.pop();
  }

  return result;
}

// ─── Variable reward pacing ─────────────────────────────────────────
// Re-interleave scored results so the feed feels engaging:
// - A "jackpot" (highest deal_score available) appears every 3rd-5th card
// - Between jackpots, show good-but-not-amazing destinations
// - Never 3+ amazing deals in a row (diminishes wow factor)
// - Never 3+ mediocre deals in a row (causes app exit)

function paceRewards(items: ScoredDest[], rand: () => number): ScoredDest[] {
  if (items.length <= 5) return items; // Too few to pace

  // Split into tiers
  const amazing: ScoredDest[] = [];
  const good: ScoredDest[] = [];
  const rest: ScoredDest[] = [];

  for (const item of items) {
    const score = item.deal_score ?? 0;
    if (score >= 70) amazing.push(item);
    else if (score >= 40) good.push(item);
    else rest.push(item);
  }

  // If we don't have enough tier variety, skip pacing
  if (amazing.length < 2 || good.length < 2) return items;

  const result: ScoredDest[] = [];
  let sinceLastJackpot = 0;
  const nextJackpotGap = () => 3 + Math.floor(rand() * 3); // 3-5 cards between jackpots
  let gap = nextJackpotGap();

  // Track consecutive tier runs
  let consecutiveAmazing = 0;
  let consecutiveFair = 0;

  const pickFrom = (pool: ScoredDest[]): ScoredDest | null => {
    if (pool.length === 0) return null;
    return pool.shift()!;
  };

  const totalItems = items.length;
  while (result.length < totalItems) {
    let pick: ScoredDest | null = null;

    if (sinceLastJackpot >= gap && amazing.length > 0) {
      // Time for a jackpot
      pick = pickFrom(amazing);
      sinceLastJackpot = 0;
      gap = nextJackpotGap();
    } else if (consecutiveAmazing >= 2 && good.length > 0) {
      // Break up amazing streaks
      pick = pickFrom(good);
    } else if (consecutiveFair >= 2 && (amazing.length > 0 || good.length > 0)) {
      // Break up mediocre streaks
      pick = pickFrom(amazing.length > 0 ? amazing : good);
    } else if (good.length > 0) {
      // Default: pull from good tier
      pick = pickFrom(good);
    } else if (rest.length > 0) {
      pick = pickFrom(rest);
    } else if (amazing.length > 0) {
      pick = pickFrom(amazing);
    }

    if (!pick) break;

    // Track consecutive runs
    const pickScore = pick.deal_score ?? 0;
    if (pickScore >= 70) {
      consecutiveAmazing++;
      consecutiveFair = 0;
    } else if (pickScore < 40) {
      consecutiveFair++;
      consecutiveAmazing = 0;
    } else {
      consecutiveAmazing = 0;
      consecutiveFair = 0;
    }

    result.push(pick);
    sinceLastJackpot++;
  }

  return result;
}

// ─── Post-score soft shuffle ────────────────────────────────────────

function softShuffle<T>(items: T[], rand: () => number, windowSize = 10): T[] {
  const result = [...items];
  for (let i = 0; i < result.length; i++) {
    const minJ = Math.max(0, i - windowSize);
    const maxJ = Math.min(result.length - 1, i + windowSize);
    const j = minJ + Math.floor(rand() * (maxJ - minJ + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── User preference vectors (personalized scoring) ─────────────────

interface UserPrefs {
  beach: number;
  city: number;
  adventure: number;
  culture: number;
  nightlife: number;
  nature: number;
  food: number;
}

const prefCache = new Map<string, { data: UserPrefs | null; ts: number }>();
const PREF_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchUserPrefs(userId: string): Promise<UserPrefs | null> {
  const cached = prefCache.get(userId);
  if (cached && Date.now() - cached.ts < PREF_CACHE_TTL) return cached.data;

  try {
    const { data, error } = await supabase
      .from(TABLES.userPreferences)
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
      prefCache.set(userId, { data: null, ts: Date.now() });
      return null;
    }
    const doc = data[0];
    const prefs: UserPrefs = {
      beach: (doc.pref_beach as number) ?? 0.5,
      city: (doc.pref_city as number) ?? 0.5,
      adventure: (doc.pref_adventure as number) ?? 0.5,
      culture: (doc.pref_culture as number) ?? 0.5,
      nightlife: (doc.pref_nightlife as number) ?? 0.5,
      nature: (doc.pref_nature as number) ?? 0.5,
      food: (doc.pref_food as number) ?? 0.5,
    };
    prefCache.set(userId, { data: prefs, ts: Date.now() });
    return prefs;
  } catch (err) {
    logApiError('api/feed/fetchUserPrefs', err);
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

function getDestFeatureVector(d: ScoredDest): number[] {
  return [
    d.beach_score ?? 0,
    d.city_score ?? 0,
    d.adventure_score ?? 0,
    d.culture_score ?? 0,
    d.nightlife_score ?? 0,
    d.nature_score ?? 0,
    d.food_score ?? 0,
  ];
}

function getUserPrefVector(prefs: UserPrefs): number[] {
  return [prefs.beach, prefs.city, prefs.adventure, prefs.culture, prefs.nightlife, prefs.nature, prefs.food];
}

function scorePersonalized(
  destinations: ScoredDest[],
  prefs: UserPrefs,
  rand: () => number = Math.random,
  quizPrefs?: QuizPrefs,
): ScoredDest[] {
  if (destinations.length <= 1) return destinations;

  const remaining = [...destinations];
  const result: ScoredDest[] = [];

  const prices = remaining.map((d) => d.live_price ?? d.flight_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const hasQuizPrefs = quizPrefs && (
    quizPrefs.travelStyle || quizPrefs.budgetLevel ||
    quizPrefs.preferredSeason || (quizPrefs.preferredVibes && quizPrefs.preferredVibes.length > 0)
  );

  const userVec = getUserPrefVector(prefs);
  const recentRegions: string[] = [];
  const recentVibes: string[] = [];
  const WINDOW = 4;

  // Seed with the destination that best matches user preferences
  // Seed with best combo of preference match + discovery value
  let bestSeedIdx = 0;
  let bestSeedScore = -Infinity;
  for (let i = 0; i < remaining.length; i++) {
    const d = remaining[i];
    const sim = cosineSimilarity(userVec, getDestFeatureVector(d));
    const usual = d.usual_price as number | undefined;
    const price = d.live_price ?? d.flight_price;
    let discoveryBonus = 0;
    if (price > 0 && usual && usual > 0) {
      const pctBelow = (usual - price) / usual;
      if (pctBelow > 0.15) discoveryBonus = Math.min(0.30, pctBelow);
    }
    const seedScore = sim * 0.6 + discoveryBonus + ((d.deal_score ?? 0) / 100) * 0.15;
    if (seedScore > bestSeedScore) {
      bestSeedScore = seedScore;
      bestSeedIdx = i;
    }
  }
  const seed = remaining.splice(bestSeedIdx, 1)[0];
  result.push(seed);
  recentRegions.push(getRegion(seed));
  recentVibes.push(getVibeBucket(seed.vibe_tags));

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = remaining[i];
      const effectivePrice = d.live_price ?? d.flight_price;
      const region = getRegion(d);
      const vibe = getVibeBucket(d.vibe_tags);

      // Preference similarity (0-1)
      const prefScore = cosineSimilarity(userVec, getDestFeatureVector(d));

      // Price score (0-1, lower price = higher score)
      const priceScore = 1 - (effectivePrice - minPrice) / priceRange;

      // Diversity penalties
      let regionPenalty = 0;
      for (let j = 0; j < recentRegions.length; j++) {
        if (recentRegions[j] === region) regionPenalty += 1 - j / WINDOW;
      }
      let vibePenalty = 0;
      for (let j = 0; j < recentVibes.length; j++) {
        if (recentVibes[j] === vibe) vibePenalty += 1 - j / WINDOW;
      }

      const jitter = rand() * 0.10;

      // Discovery: price anomaly bonus (even personalized users love a steal)
      let discoveryBonus = 0;
      const usual = d.usual_price as number | undefined;
      if (effectivePrice > 0 && usual && usual > 0) {
        const pctBelow = (usual - effectivePrice) / usual;
        if (pctBelow > 0.15) discoveryBonus = Math.min(0.30, pctBelow);
      }

      // Trend: dropping prices are more exciting
      let trendBonus = 0;
      const history = d.price_history as number[] | undefined;
      if (history && history.length >= 3) {
        const recent = history.slice(-3);
        const older = history.slice(0, Math.max(1, history.length - 3));
        const recentAvg = recent.reduce((s, p) => s + p, 0) / recent.length;
        const olderAvg = older.reduce((s, p) => s + p, 0) / older.length;
        if (olderAvg > 0) {
          const dropPct = (olderAvg - recentAvg) / olderAvg;
          if (dropPct > 0.05) trendBonus = Math.min(0.12, dropPct);
        }
      }

      // Quiz bonus (additive, optional)
      const quizBonus = hasQuizPrefs ? computeQuizBonus(d, quizPrefs!, minPrice, maxPrice) : 0;

      // Convenience bonus for personalized users (they value comfort more)
      let convenienceBonus = 0;
      const isNonstop = d.is_nonstop as boolean | undefined;
      const totalStops = d.total_stops as number | undefined;
      if (isNonstop) convenienceBonus = 0.10;
      else if (totalStops === 1) convenienceBonus = 0.03;
      else if (totalStops != null && totalStops >= 2) convenienceBonus = -0.05;

      const score =
        prefScore * 0.25
        + priceScore * 0.12
        + discoveryBonus
        + trendBonus
        + convenienceBonus
        - regionPenalty * 0.18
        - vibePenalty * 0.08
        + jitter
        + quizBonus;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // 10% exploration: pick a random item instead of the highest-scoring one
    const pickIdx = rand() < 0.1 ? Math.floor(rand() * remaining.length) : bestIdx;
    const pick = remaining.splice(pickIdx, 1)[0];
    result.push(pick);
    recentRegions.unshift(getRegion(pick));
    recentVibes.unshift(getVibeBucket(pick.vibe_tags));
    if (recentRegions.length > WINDOW) recentRegions.pop();
    if (recentVibes.length > WINDOW) recentVibes.pop();
  }

  return result;
}

// ─── In-memory cache (per origin, 10-min TTL) ───────────────────────
// NOTE: This is a best-effort cache that clears on Vercel cold starts.
// Provides fast responses for warm instances but does not persist.
// For shared caching across instances, consider Upstash Redis.

const destCache = new Map<string, { data: ScoredDest[]; ts: number }>();
const CACHE_TTL = 60 * 1000; // 1 min — keep prices fresh

async function getDestinationsWithPrices(origin: string): Promise<ScoredDest[]> {
  const cached = destCache.get(origin);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  // Fetch destinations from Supabase
  const { data: destData, error: destError } = await supabase
    .from(TABLES.destinations)
    .select('*')
    .eq('is_active', true)
    .limit(500);
  if (destError) throw destError;
  const destResult = { documents: destData ?? [] };

  // Fetch calendar prices, cached prices, hotel prices, images, and route stats in parallel
  const [calendarResult, priceResult, hotelPriceResult, imageResult, routeStatsMap] = await Promise.all([
    supabase
      .from(TABLES.priceCalendar)
      .select('*')
      .eq('origin', origin)
      .limit(2000)
      .then(({ data, error }) => {
        if (error) {
          console.error('[feed] price_calendar query FAILED:', error.message);
          return { documents: [] };
        }
        return { documents: data ?? [] };
      }),
    supabase
      .from(TABLES.cachedPrices)
      .select('*')
      .eq('origin', origin)
      .order('price', { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (error) return { documents: [] };
        return { documents: data ?? [] };
      }),
    supabase
      .from(TABLES.cachedHotelPrices)
      .select('*')
      .limit(500)
      .then(({ data, error }) => {
        if (error) return { documents: [] };
        return { documents: data ?? [] };
      }),
    // Fetch all images in a single query (limit 3000 covers all destinations)
    supabase
      .from(TABLES.destinationImages)
      .select('*')
      .limit(3000)
      .then(({ data, error }) => {
        if (error) return { documents: [] };
        return { documents: data ?? [] };
      }),
    bulkGetRouteStats(origin),
  ]);

  // Build calendar price lookup (Travelpayouts daily prices — cheapest per destination)
  const calendarPriceMap = new Map<string, {
    price: number;
    date: string;
    return_date: string;
    trip_days: number;
    airline: string;
    source: string;
    deal_score?: number;
    deal_tier?: string;
    quality_score?: number;
    price_percentile?: number;
    is_nonstop?: boolean;
    total_stops?: number;
    max_layover_minutes?: number;
    total_travel_minutes?: number;
  }>();
  const today = new Date().toISOString().split('T')[0];
  // Sort by deal_score desc (best deals first), fallback to price asc
  const calendarDocs = calendarResult.documents
    .filter((p) => (p.date as string) >= today)
    .sort((a, b) => {
      const scoreA = (a.deal_score as number) ?? 0;
      const scoreB = (b.deal_score as number) ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
      return (a.price as number) - (b.price as number);
    });
  for (const p of calendarDocs) {
    const dest = p.destination_iata as string;
    if (calendarPriceMap.has(dest)) continue; // first = best deal score
    calendarPriceMap.set(dest, {
      price: p.price as number,
      date: (p.date as string) || '',
      return_date: (p.return_date as string) || '',
      trip_days: (p.trip_days as number) ?? 7,
      airline: (p.airline as string) || '',
      source: (p.source as string) || 'travelpayouts',
      deal_score: (p.deal_score as number) ?? undefined,
      deal_tier: (p.deal_tier as string) ?? undefined,
      quality_score: (p.quality_score as number) ?? undefined,
      price_percentile: (p.price_percentile as number) ?? undefined,
      is_nonstop: (p.is_nonstop as boolean) ?? undefined,
      total_stops: (p.total_stops as number) ?? undefined,
      max_layover_minutes: (p.max_layover_minutes as number) ?? undefined,
      total_travel_minutes: (p.total_travel_minutes as number) ?? undefined,
    });
  }

  // Build price history per destination (sorted by date — for sparkline trends)
  const priceHistoryMap = new Map<string, number[]>();
  const calendarByDest = new Map<string, Array<{ date: string; price: number }>>();
  for (const p of calendarDocs) {
    const dest = p.destination_iata as string;
    if (!calendarByDest.has(dest)) calendarByDest.set(dest, []);
    calendarByDest.get(dest)!.push({ date: p.date as string, price: p.price as number });
  }
  for (const [dest, entries] of calendarByDest) {
    // Sort by date ascending, take up to 14 price points
    const sorted = entries.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 14);
    if (sorted.length >= 3) {
      priceHistoryMap.set(dest, sorted.map((e) => e.price));
    }
  }

  const prices = priceResult.documents;

  const priceMap = new Map<
    string,
    {
      price: number;
      airline: string;
      duration: string;
      source: string;
      fetched_at: string;
      departure_date?: string;
      return_date?: string;
      trip_duration_days?: number;
      previous_price?: number;
      price_direction?: string;
      offer_json?: string;
      offer_expires_at?: string;
      flight_number?: string;
      tp_found_at?: string;
      deal_score?: number;
      deal_tier?: string;
      quality_score?: number;
      price_percentile?: number;
      is_nonstop?: boolean;
      total_stops?: number;
      max_layover_minutes?: number;
      total_travel_minutes?: number;
    }
  >();
  for (const p of prices) {
    // Keep the cheapest price per destination (results are ordered by price ASC)
    if (priceMap.has(p.destination_iata as string)) continue;
    // Skip cached prices with past departure dates — they're stale and misleading
    const depDate = p.departure_date as string;
    if (depDate && depDate < today) continue;
    priceMap.set(p.destination_iata as string, {
      price: p.price as number,
      airline: (p.airline as string) || '',
      duration: (p.duration as string) || '',
      source: (p.source as string) || 'estimate',
      fetched_at: (p.fetched_at as string) || '',
      departure_date: (p.departure_date as string) || undefined,
      return_date: (p.return_date as string) || undefined,
      trip_duration_days: (p.trip_duration_days as number) ?? undefined,
      previous_price: (p.previous_price as number) ?? undefined,
      price_direction: (p.price_direction as string) || 'stable',
      offer_json: (p.offer_json as string) || undefined,
      offer_expires_at: (p.offer_expires_at as string) || undefined,
      flight_number: (p.flight_number as string) || undefined,
      tp_found_at: (p.tp_found_at as string) || undefined,
      deal_score: (p.deal_score as number) ?? undefined,
      deal_tier: (p.deal_tier as string) ?? undefined,
      quality_score: (p.quality_score as number) ?? undefined,
      price_percentile: (p.price_percentile as number) ?? undefined,
      is_nonstop: (p.is_nonstop as boolean) ?? undefined,
      total_stops: (p.total_stops as number) ?? undefined,
      max_layover_minutes: (p.max_layover_minutes as number) ?? undefined,
      total_travel_minutes: (p.total_travel_minutes as number) ?? undefined,
    });
  }

  // Build hotel price + hotels lookup by IATA code
  const hotelPriceMap = new Map<string, { price: number; source: string; hotels?: any[] }>();
  for (const hp of hotelPriceResult.documents) {
    let hotels: any[] | undefined;
    try {
      hotels = hp.hotels_json
        ? (typeof hp.hotels_json === 'string' ? JSON.parse(hp.hotels_json) : hp.hotels_json)
        : undefined;
    } catch {
      hotels = undefined;
    }
    hotelPriceMap.set(hp.destination_iata as string, {
      price: hp.price_per_night as number,
      source: (hp.source as string) || 'estimate',
      hotels,
    });
  }

  // Build image lookup by destination ID (all images, primary first)
  const imageMap = new Map<string, { url: string; urls: string[]; blurHash?: string }>();
  // Group images by destination_id
  const imageGroups = new Map<string, (typeof imageResult.documents)[number][]>();
  for (const img of imageResult.documents) {
    const destId = img.destination_id as string;
    if (!imageGroups.has(destId)) imageGroups.set(destId, []);
    imageGroups.get(destId)!.push(img);
  }
  // Sort each group: is_primary first, then by fetched_at desc
  for (const [destId, imgs] of imageGroups) {
    imgs.sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      const aTime = (a.fetched_at as string) || '';
      const bTime = (b.fetched_at as string) || '';
      return bTime.localeCompare(aTime);
    });
    const urls = imgs.map(
      (img) => (img.url_regular as string) || (img.url_small as string) || '',
    ).filter(Boolean);
    imageMap.set(destId, {
      url: urls[0] || '',
      urls,
      blurHash: (imgs[0].blur_hash as string) || undefined,
    });
  }

  const merged: ScoredDest[] = destResult.documents.map((d) => {
    const cp = calendarPriceMap.get(d.iata_code as string);
    const lp = priceMap.get(d.iata_code as string);

    // Parse JSON fields — Supabase JSONB columns return objects directly; text columns return strings
    let itinerary: ScoredDest['itinerary'];
    let restaurants: ScoredDest['restaurants'];
    try {
      if (d.itinerary_json) {
        itinerary = typeof d.itinerary_json === 'string' ? JSON.parse(d.itinerary_json) : d.itinerary_json;
      }
    } catch {
      itinerary = undefined;
    }
    try {
      if (d.restaurants_json) {
        restaurants = typeof d.restaurants_json === 'string' ? JSON.parse(d.restaurants_json) : d.restaurants_json;
      }
    } catch {
      restaurants = undefined;
    }

    // Deal quality: prefer calendar (TP) deal data, fall back to cached_prices (Duffel)
    const dealScore = cp?.deal_score ?? lp?.deal_score;
    const dealTier = cp?.deal_tier ?? lp?.deal_tier;
    const qualityScore = cp?.quality_score ?? lp?.quality_score;
    const pricePercentile = cp?.price_percentile ?? lp?.price_percentile;
    const isNonstop = cp?.is_nonstop ?? lp?.is_nonstop;
    const totalStops = cp?.total_stops ?? lp?.total_stops;
    const maxLayoverMin = cp?.max_layover_minutes ?? lp?.max_layover_minutes;
    const totalTravelMin = cp?.total_travel_minutes ?? lp?.total_travel_minutes;

    // Compute savings from route stats
    const iata = d.iata_code as string;
    const routeKey = `${origin}-${iata}`;
    const routeStats = routeStatsMap.get(routeKey);
    const effectivePrice = cp?.price ?? lp?.price ?? null;
    let usualPrice: number | null = null;
    let savingsAmount: number | null = null;
    let savingsPercent: number | null = null;
    if (routeStats && effectivePrice != null && routeStats.sampleCount >= 3) {
      usualPrice = routeStats.medianPrice;
      if (effectivePrice < usualPrice) {
        savingsAmount = usualPrice - effectivePrice;
        savingsPercent = Math.round((savingsAmount / usualPrice) * 100);
      }
    }

    return {
      id: d.id,
      iata_code: d.iata_code as string,
      city: d.city as string,
      country: d.country as string,
      continent: (d.continent as string) || undefined,
      tagline: (d.tagline as string) || '',
      description: (d.description as string) || '',
      // Only use Unsplash images (destination_images collection).
      // Google Places URLs expire and we're paying for Unsplash — use it exclusively.
      image_url: imageMap.get(d.id)?.url || (d.image_url as string) || '',
      image_urls: imageMap.get(d.id)?.urls?.length ? imageMap.get(d.id)!.urls : [],
      flight_price: d.flight_price as number,
      hotel_price_per_night: (d.hotel_price_per_night as number) || 0,
      currency: (d.currency as string) || 'USD',
      vibe_tags: (d.vibe_tags as string[]) || [],
      rating: (d.rating as number) || 0,
      review_count: (d.review_count as number) || 0,
      best_months: (d.best_months as string[]) || [],
      average_temp: (d.average_temp as number) || 0,
      flight_duration: (d.flight_duration as string) || '',
      available_flight_days: (d.available_flight_days as string[]) || undefined,
      latitude: (d.latitude as number) ?? undefined,
      longitude: (d.longitude as number) ?? undefined,
      beach_score: (d.beach_score as number) || 0,
      city_score: (d.city_score as number) || 0,
      adventure_score: (d.adventure_score as number) || 0,
      culture_score: (d.culture_score as number) || 0,
      nightlife_score: (d.nightlife_score as number) || 0,
      nature_score: (d.nature_score as number) || 0,
      food_score: (d.food_score as number) || 0,
      popularity_score: (d.popularity_score as number) || 0,
      // Only show fresh Duffel prices — these are real live fares that match booking.
      // Filter out stale prices (>48h old) and non-Duffel sources (Amadeus, Travelpayouts).
      live_price: (() => {
        if (!lp?.price) return null;
        // Only trust Duffel prices
        if (lp.source !== 'duffel') return null;
        // Skip prices older than 48 hours
        if (lp.fetched_at) {
          const age = Date.now() - new Date(lp.fetched_at).getTime();
          if (age > 48 * 60 * 60 * 1000) return null;
        }
        return lp.price;
      })(),
      live_airline: lp?.source === 'duffel' ? (lp?.airline ?? '') : '',
      live_duration: lp?.source === 'duffel' ? (lp?.duration ?? '') : '',
      price_source: lp?.source === 'duffel' ? lp.source : undefined,
      price_fetched_at: lp?.source === 'duffel' ? (lp?.fetched_at ?? undefined) : undefined,
      // Prefer Duffel dates (match the price shown) over calendar dates
      departure_date: lp?.departure_date ?? cp?.date,
      return_date: lp?.return_date ?? cp?.return_date,
      trip_duration_days: lp?.trip_duration_days ?? cp?.trip_days,
      cheapest_date: lp?.departure_date ?? cp?.date ?? undefined,
      cheapest_return_date: lp?.return_date ?? cp?.return_date ?? undefined,
      previous_price: lp?.previous_price,
      price_direction: lp?.price_direction,
      offer_json: lp?.offer_json,
      offer_expires_at: lp?.offer_expires_at,
      flight_number: lp?.flight_number,
      tp_found_at: lp?.tp_found_at,
      live_hotel_price: hotelPriceMap.get(d.iata_code as string)?.price ?? null,
      hotel_price_source: hotelPriceMap.get(d.iata_code as string)?.source ?? undefined,
      hotels_data: hotelPriceMap.get(d.iata_code as string)?.hotels ?? undefined,
      itinerary,
      restaurants,
      // Deal quality fields
      deal_score: dealScore,
      deal_tier: dealTier,
      quality_score: qualityScore,
      price_percentile: pricePercentile,
      is_nonstop: isNonstop,
      total_stops: totalStops,
      max_layover_minutes: maxLayoverMin,
      total_travel_minutes: totalTravelMin,
      usual_price: usualPrice,
      savings_amount: savingsAmount,
      savings_percent: savingsPercent,
      price_history: priceHistoryMap.get(d.iata_code as string),
    };
  });

  destCache.set(origin, { data: merged, ts: Date.now() });
  return merged;
}

// ─── Transform DB row → frontend Destination shape ───────────────────

function toFrontend(d: ScoredDest, origin?: string) {
  return {
    id: d.id,
    iataCode: d.iata_code,
    city: d.city,
    country: d.country,
    tagline: d.tagline,
    description: d.description,
    // image_url already prioritizes Unsplash over Google Places (set in merge above)
    imageUrl: d.image_url || d.image_urls?.[0],
    // imageUrls omitted from feed — single URL is sufficient for card rendering
    // Only send prices we can trust:
    // - live_price (from Duffel cached_prices or Travelpayouts calendar) = good
    // - flight_price (from destinations table, possibly months old) = unreliable, omit
    flightPrice: d.live_price ?? null,
    hotelPricePerNight: d.live_hotel_price ?? d.hotel_price_per_night,
    currency: d.currency,
    vibeTags: d.vibe_tags,
    bestMonths: d.best_months,
    averageTemp: d.average_temp,
    flightDuration: d.live_duration || d.flight_duration,
    livePrice: d.live_price,
    priceSource: d.live_price != null
      ? (d.price_source as 'travelpayouts' | 'amadeus' | 'duffel' | 'estimate')
      : 'estimate',
    priceFetchedAt: d.price_fetched_at || d.tp_found_at || undefined,
    liveHotelPrice: d.live_hotel_price ?? null,
    hotelPriceSource: d.live_hotel_price != null
      ? (d.hotel_price_source as 'duffel' | 'liteapi' | 'estimate')
      : 'estimate',
    // Heavy fields omitted from feed — fetched on-demand via /api/destination
    // hotels, available_flight_days, latitude, longitude, itinerary, restaurants
    departureDate: d.departure_date || undefined,
    returnDate: d.return_date || undefined,
    tripDurationDays: d.trip_duration_days ?? undefined,
    airline: d.live_airline || undefined,
    priceDirection: (d.price_direction as 'up' | 'down' | 'stable') || undefined,
    previousPrice: d.previous_price ?? undefined,
    priceDropPercent:
      d.previous_price && d.live_price != null && d.previous_price > 0
        ? Math.round(((d.previous_price - d.live_price) / d.previous_price) * 100)
        : undefined,
    // offerJson omitted from feed — large JSON blob only needed during booking
    offerExpiresAt: d.offer_expires_at || undefined,
    airlineLogoUrl: d.live_airline
      ? `https://pics.avs.io/200/80/${d.live_airline}.png`
      : undefined,
    // cheapestDate/cheapestReturnDate removed — they came from Travelpayouts
    // calendar and caused date mismatch with Duffel prices. The iOS app falls
    // back to departureDate/returnDate which match the actual price shown.
    cheapestDate: undefined,
    cheapestReturnDate: undefined,
    affiliateUrl:
      d.price_source === 'travelpayouts' && origin
        ? generateAviasalesLink(origin, d.iata_code, d.departure_date, d.return_date)
        : undefined,
    // Deal quality fields
    dealScore: d.deal_score ?? undefined,
    dealTier: (d.deal_tier as 'amazing' | 'great' | 'good' | 'fair') ?? undefined,
    qualityScore: d.quality_score ?? undefined,
    pricePercentile: d.price_percentile ?? undefined,
    isNonstop: d.is_nonstop ?? undefined,
    totalStops: d.total_stops != null && d.total_stops >= 0 ? d.total_stops : undefined,
    maxLayoverMinutes: d.max_layover_minutes != null && d.max_layover_minutes >= 0 ? d.max_layover_minutes : undefined,
    usualPrice: d.usual_price ?? undefined,
    savingsAmount: d.savings_amount ?? undefined,
    savingsPercent: d.savings_percent ?? undefined,
    priceHistory: d.price_history?.slice(-7) ?? undefined,
    nearbyOrigin: d.nearby_origin ?? undefined,
    nearbyOriginLabel: d.nearby_origin_label ?? undefined,
  };
}

// ─── Budget discovery handler ────────────────────────────────────────

async function handleBudgetDiscovery(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(budgetDiscoveryQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { origin, minPrice, maxPrice } = v.data;

  try {
    const results = await fetchByPriceRange(origin, minPrice ?? 1, maxPrice);

    // Enrich with destination metadata from our DB
    const allDests = await getDestinationsWithPrices(origin);
    const destMap = new Map(allDests.map((d) => [d.iata_code, d]));

    const enriched = results
      .map((r) => {
        const dest = destMap.get(r.destination);
        if (!dest) return null;
        return {
          ...toFrontend(dest, origin),
          // Override price with the budget search result
          flightPrice: r.price,
          livePrice: r.price,
          priceSource: 'travelpayouts' as const,
          departureDate: r.departureDate,
          returnDate: r.returnDate,
          airline: r.airline,
          affiliateUrl: generateAviasalesLink(origin, r.destination, r.departureDate, r.returnDate),
        };
      })
      .filter(Boolean);

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({
      destinations: enriched,
      budget: { min: minPrice ?? 1, max: maxPrice },
      totalResults: results.length,
      matchedDestinations: enriched.length,
    });
  } catch (err) {
    logApiError('api/feed?action=budget', err);
    return res.status(500).json({ error: 'Failed to load budget deals' });
  }
}

// ─── Detect origin airport handler ────────────────────────────────────

const originCache = new Map<string, { data: { iata: string; name: string; country: string }; ts: number }>();
const ORIGIN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function handleDetectOrigin(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(detectOriginQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });

  const fallback = { iata: 'TPA', name: 'Tampa', country: 'US' };

  try {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const ipRaw = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : typeof realIp === 'string'
        ? realIp.trim()
        : null;

    if (!ipRaw) {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
      return res.status(200).json({ origin: fallback });
    }

    // Check cache
    const cached = originCache.get(ipRaw);
    if (cached && Date.now() - cached.ts < ORIGIN_CACHE_TTL) {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
      return res.status(200).json({ origin: cached.data });
    }

    const result = await detectOriginAirport(ipRaw);
    if (result) {
      originCache.set(ipRaw, { data: result, ts: Date.now() });
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
      return res.status(200).json({ origin: result });
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
    return res.status(200).json({ origin: fallback });
  } catch (err) {
    logApiError('api/feed?action=detect-origin', err);
    return res.status(200).json({ origin: fallback });
  }
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 20 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`feed:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) });
  }

  // Route by action param
  if (req.query.action === 'budget') {
    return handleBudgetDiscovery(req, res);
  }
  if (req.query.action === 'detect-origin') {
    return handleDetectOrigin(req, res);
  }

  try {
    const v = validateRequest(feedQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { origin, cursor: parsedCursor, sessionId, excludeIds, vibeFilter, sortPreset, regionFilter, maxPrice, minPrice, search, durationFilter, travelStyle, budgetLevel, preferredSeason, preferredVibes: preferredVibesRaw } = v.data;
    const cursor = parsedCursor ?? 0;

    // Build quiz prefs from query params (all optional)
    const quizPrefs: QuizPrefs = {};
    if (travelStyle) quizPrefs.travelStyle = travelStyle;
    if (budgetLevel) quizPrefs.budgetLevel = budgetLevel;
    if (preferredSeason) quizPrefs.preferredSeason = preferredSeason;
    if (preferredVibesRaw) {
      quizPrefs.preferredVibes = preferredVibesRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    }

    const allDestinations = await getDestinationsWithPrices(origin);

    // Session-based PRNG
    const seed = sessionId
      ? `${origin}:${sessionId}`
      : `${origin}:${Date.now()}-${Math.random()}`;
    const rand = seededRandom(seed);

    // Apply filters before scoring.
    // Scoring must run on the filtered candidate set so the seeded PRNG produces
    // a deterministic order. Cursor-based pagination then slices consistently.
    let destinations = [...allDestinations];

    // Filter out low-quality deals (deal_score < 30 = rejected tier)
    // Only apply when deal scores exist (graceful for old data without scores)
    destinations = destinations.filter((d) => {
      if (d.deal_score == null) return true; // No score yet — keep it
      return d.deal_score >= 30;
    });

    if (regionFilter && regionFilter !== 'all') {
      const regionSet = new Set(regionFilter.split(',').map((r) => r.trim()));
      destinations = destinations.filter((d) => regionSet.has(getRegion(d)));
    }

    if (vibeFilter) {
      const vibes = vibeFilter.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
      destinations = destinations.filter((d) =>
        d.vibe_tags.some((t) => vibes.includes(t.toLowerCase())),
      );
    }

    if (maxPrice != null) {
      destinations = destinations.filter((d) => (d.live_price ?? d.flight_price) <= maxPrice);
    }

    if (minPrice != null) {
      destinations = destinations.filter((d) => {
        const price = d.live_price ?? d.flight_price;
        return price != null && price >= minPrice;
      });
    }

    if (search) {
      const searchLower = search.toLowerCase();
      destinations = destinations.filter((d) => {
        const city = ((d.city as string) || '').toLowerCase();
        const country = ((d.country as string) || '').toLowerCase();
        const tags = ((d.vibe_tags as string[]) || []).join(' ').toLowerCase();
        return city.includes(searchLower) || country.includes(searchLower) || tags.includes(searchLower);
      });
    }

    if (durationFilter && durationFilter !== 'any') {
      destinations = destinations.filter((d) => {
        const days = d.trip_duration_days;
        if (days == null) return false; // exclude destinations without duration data
        switch (durationFilter) {
          case 'weekend': return days >= 1 && days <= 3;
          case 'week': return days >= 4 && days <= 8;
          case 'extended': return days >= 9;
          default: return true;
        }
      });
    }

    if (excludeIds) {
      const excludeSet = new Set(excludeIds.split(',').map((s) => s.trim()).filter(Boolean));
      destinations = destinations.filter((d) => !excludeSet.has(d.id));
    }

    // countOnly mode — return just the count for filter preview
    if (v.data.countOnly === 'true') {
      return res.status(200).json({ count: destinations.length });
    }

    // Nearby airport fallback — when origin has < 5 quality deals, supplement
    const MIN_DEALS_THRESHOLD = 5;
    const dealsWithPrice = destinations.filter((d) => d.live_price != null && d.live_price > 0);
    if (dealsWithPrice.length < MIN_DEALS_THRESHOLD && !search) {
      const nearby = nearbyAirports[origin];
      if (nearby && nearby.length > 0) {
        const existingIatas = new Set(destinations.map((d) => d.iata_code));
        for (const alt of nearby.slice(0, 2)) { // Check up to 2 nearby airports
          try {
            const altDests = await getDestinationsWithPrices(alt.code);
            const altDeals = altDests
              .filter((d) => {
                if (existingIatas.has(d.iata_code)) return false; // Skip duplicates
                if ((d.live_price ?? d.flight_price) <= 0) return false;
                if (d.deal_score != null && d.deal_score < 30) return false;
                return true;
              })
              .slice(0, 5) // At most 5 from each nearby airport
              .map((d) => ({
                ...d,
                nearby_origin: alt.code,
                nearby_origin_label: `Also from ${alt.label}`,
              }));
            destinations.push(...altDeals);
          } catch {
            // Non-fatal — skip this nearby airport
          }
        }
      }
    }

    // Try to extract user ID for personalized scoring (non-blocking)
    let userPrefs: UserPrefs | null = null;
    try {
      const authResult = await verifyClerkToken(req.headers.authorization as string | undefined);
      if (authResult) {
        userPrefs = await fetchUserPrefs(authResult.userId);
      }
    } catch {
      // Auth failure is non-fatal — fall back to generic scoring
    }

    let scored: ScoredDest[];

    if (sortPreset === 'cheapest') {
      scored = [...destinations]
        .filter((d) => (d.live_price ?? d.flight_price) > 0)
        .sort((a, b) => {
          const pa = a.live_price ?? a.flight_price;
          const pb = b.live_price ?? b.flight_price;
          return pa - pb;
        });
    } else if (sortPreset === 'best-deals') {
      // Sort by deal_score descending — surfaces the best deals first
      scored = [...destinations].sort(
        (a, b) => (b.deal_score ?? 0) - (a.deal_score ?? 0),
      );
    } else if (sortPreset === 'trending') {
      scored = [...destinations].sort(
        (a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0),
      );
    } else if (userPrefs) {
      scored = scorePersonalized(destinations, userPrefs, rand, quizPrefs);
      scored = paceRewards(scored, rand);
      scored = softShuffle(scored, rand, 5);
    } else {
      scored = scoreFeedGeneric(destinations, rand, quizPrefs);
      scored = paceRewards(scored, rand);
      scored = softShuffle(scored, rand, 5);
    }

    let page = scored.slice(cursor, cursor + PAGE_SIZE).map((d) => toFrontend(d, origin));
    const nextCursor = cursor + PAGE_SIZE < scored.length ? String(cursor + PAGE_SIZE) : null;

    // Separate destinations with and without prices
    const withPrice = page.filter((d) => d.flightPrice && d.flightPrice > 0);
    const withoutPrice = page.filter((d) => !d.flightPrice || d.flightPrice <= 0);

    // If we have enough priced destinations, skip on-demand Duffel (saves 10-15s)
    // Otherwise, fill missing prices for a better user experience
    if (withPrice.length >= 5) {
      page = withPrice;
    } else {
      // Not enough cached prices — do on-demand Duffel pricing
      page = await fillMissingPrices(page, origin);
      page = page.filter((d) => d.flightPrice && d.flightPrice > 0);
    }

    // Fire-and-forget: backfill prices for uncached destinations in background
    // (they'll be cached for next request)
    if (withoutPrice.length > 0) {
      fillMissingPrices(withoutPrice, origin).catch(() => {});
    }

    const cacheTime = sessionId ? 0 : 60;
    res.setHeader(
      'Cache-Control',
      cacheTime > 0
        ? `s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
        : 'no-store',
    );
    return res.status(200).json({ destinations: page, nextCursor });
  } catch (err) {
    logApiError('api/feed', err);
    return res.status(500).json({ error: 'Failed to load feed' });
  }
}
