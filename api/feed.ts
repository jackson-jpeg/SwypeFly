import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { feedQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const PAGE_SIZE = 10;

// ─── Seeded PRNG (consistent within a day, fresh next day) ──────────

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
}

// ─── Freshness score helper ─────────────────────────────────────────

function freshnessScore(priceFetchedAt?: string): number {
  if (!priceFetchedAt) return 0;
  const hoursOld = (Date.now() - new Date(priceFetchedAt).getTime()) / (1000 * 60 * 60);
  return Math.max(0, 1 - hoursOld / 168); // decays to 0 over 7 days
}

// ─── Region / Vibe helpers ──────────────────────────────────────────

function getRegion(d: ScoredDest): string {
  // Prefer continent column if populated
  if (d.continent) {
    const c = d.continent.toLowerCase();
    if (c.includes('caribbean')) return 'caribbean';
    if (c.includes('south america') || c.includes('central america')) return 'latam';
    if (c.includes('europe')) return 'europe';
    if (c.includes('asia')) return 'asia';
    if (c.includes('africa') || c.includes('middle east')) return 'africa-me';
    if (c.includes('north america')) {
      return d.country.toLowerCase() === 'usa' ? 'domestic' : 'americas';
    }
    if (c.includes('oceania')) return 'oceania';
    return 'other';
  }

  // Fallback: country-based mapping (for destinations without continent set)
  const country = d.country.toLowerCase();
  if (['indonesia', 'japan', 'thailand', 'singapore', 'south korea', 'vietnam', 'maldives'].includes(country)) return 'asia';
  if (['greece', 'croatia', 'italy', 'portugal', 'iceland', 'switzerland', 'spain', 'france'].includes(country)) return 'europe';
  if (['morocco', 'south africa', 'uae'].includes(country)) return 'africa-me';
  if (['peru', 'argentina', 'brazil', 'colombia', 'costa rica'].includes(country)) return 'latam';
  if (['jamaica', 'dominican republic', 'bahamas', 'cuba', 'puerto rico'].includes(country)) return 'caribbean';
  if (country === 'usa') return 'domestic';
  if (['new zealand', 'australia'].includes(country)) return 'oceania';
  if (['canada', 'mexico'].includes(country)) return 'americas';
  return 'other';
}

function getVibeBucket(tags: string[]): string {
  const primary = tags[0];
  if (['beach', 'tropical'].includes(primary)) return 'beach';
  if (['mountain', 'nature', 'adventure', 'winter'].includes(primary)) return 'outdoor';
  if (['city', 'nightlife'].includes(primary)) return 'urban';
  if (['culture', 'historic', 'foodie'].includes(primary)) return 'cultural';
  if (['romantic', 'luxury'].includes(primary)) return 'premium';
  return 'other';
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
  // Feature vectors
  beach_score?: number;
  city_score?: number;
  adventure_score?: number;
  culture_score?: number;
  nightlife_score?: number;
  nature_score?: number;
  food_score?: number;
  budget_level?: number;
  popularity_score?: number;
  // Merged from cached_prices
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
  // Merged from cached_hotel_prices
  live_hotel_price?: number | null;
  hotel_price_source?: string;
  // New content fields
  available_flight_days?: string[];
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number }[];
  // Unsplash image data
  unsplash_image_url?: string;
  unsplash_blur_hash?: string;
  unsplash_photographer?: string;
  unsplash_photographer_url?: string;
  unsplash_images?: Array<{ url_regular: string; blur_hash: string; photographer: string; photographer_url: string }>;
}

interface UserPrefs {
  budget_numeric: number;
  pref_beach: number;
  pref_city: number;
  pref_adventure: number;
  pref_culture: number;
  pref_nightlife: number;
  pref_nature: number;
  pref_food: number;
}

// ─── Generic scoring (for anonymous users) ──────────────────────────

function scoreFeedGeneric(destinations: ScoredDest[], rand: () => number = Math.random): ScoredDest[] {
  if (destinations.length <= 1) return destinations;

  const remaining = [...destinations];
  const result: ScoredDest[] = [];

  const prices = remaining.map((d) => d.live_price ?? d.flight_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const recentRegions: string[] = [];
  const recentVibes: string[] = [];
  const WINDOW = 4;

  remaining.sort((a, b) => {
    const pa = a.live_price ?? a.flight_price;
    const pb = b.live_price ?? b.flight_price;
    return (b.rating / (pb / 1000)) - (a.rating / (pa / 1000));
  });

  const seed = remaining.shift()!;
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

      const priceScore = 1 - (effectivePrice - minPrice) / priceRange;
      let regionPenalty = 0;
      for (let j = 0; j < recentRegions.length; j++) {
        if (recentRegions[j] === region) regionPenalty += 1 - j / WINDOW;
      }
      let vibePenalty = 0;
      for (let j = 0; j < recentVibes.length; j++) {
        if (recentVibes[j] === vibe) vibePenalty += 1 - j / WINDOW;
      }
      const ratingScore = (d.rating - 4.0) / 1.0;

      const jitter = rand() * 0.15;
      const score = priceScore * 0.25 + ratingScore * 0.2 - regionPenalty * 0.3 - vibePenalty * 0.15 + jitter;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const pick = remaining.splice(bestIdx, 1)[0];
    result.push(pick);
    recentRegions.unshift(getRegion(pick));
    recentVibes.unshift(getVibeBucket(pick.vibe_tags));
    if (recentRegions.length > WINDOW) recentRegions.pop();
    if (recentVibes.length > WINDOW) recentVibes.pop();
  }

  return result;
}

// ─── Personalized scoring ───────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function cosineSimilarity(userVec: number[], destVec: number[]): number {
  let dot = 0, magU = 0, magD = 0;
  for (let i = 0; i < userVec.length; i++) {
    dot += userVec[i] * destVec[i];
    magU += userVec[i] * userVec[i];
    magD += destVec[i] * destVec[i];
  }
  const denom = Math.sqrt(magU) * Math.sqrt(magD);
  return denom === 0 ? 0 : dot / denom;
}

function priceFitScore(price: number, budgetLevel: number): number {
  // budgetLevel: 1=budget, 2=comfortable, 3=luxury
  if (budgetLevel <= 1) {
    // Budget: cheaper = higher score
    if (price <= 400) return 1.0;
    if (price <= 700) return 0.7;
    if (price <= 1000) return 0.4;
    return 0.2;
  }
  if (budgetLevel === 2) {
    // Mid-range: peak around $800-$1200
    if (price >= 600 && price <= 1200) return 1.0;
    if (price >= 400 && price < 600) return 0.7;
    if (price > 1200 && price <= 1600) return 0.6;
    if (price < 400) return 0.5;
    return 0.3;
  }
  // Luxury: higher price = higher score
  if (price >= 1200) return 1.0;
  if (price >= 800) return 0.7;
  if (price >= 500) return 0.4;
  return 0.2;
}

function seasonalityScore(bestMonths: string[]): number {
  const currentMonth = MONTH_NAMES[new Date().getMonth()];
  return bestMonths.includes(currentMonth) ? 1.0 : 0.3;
}

function scorePersonalizedFeed(destinations: ScoredDest[], prefs: UserPrefs, rand: () => number = Math.random): ScoredDest[] {
  if (destinations.length <= 1) return destinations;

  const userVec = [
    prefs.pref_beach, prefs.pref_city, prefs.pref_adventure,
    prefs.pref_culture, prefs.pref_nightlife, prefs.pref_nature, prefs.pref_food,
  ];

  // Score each destination
  const scored = destinations.map((d) => {
    const effectivePrice = d.live_price ?? d.flight_price;

    const destVec = [
      d.beach_score ?? 0, d.city_score ?? 0, d.adventure_score ?? 0,
      d.culture_score ?? 0, d.nightlife_score ?? 0, d.nature_score ?? 0, d.food_score ?? 0,
    ];

    // Price Fit (35%)
    const priceFit = priceFitScore(effectivePrice, prefs.budget_numeric);
    // Preference Match (25%)
    const prefMatch = cosineSimilarity(userVec, destVec);
    // Seasonality (15%)
    const seasonal = seasonalityScore(d.best_months || []);
    // Popularity (5%)
    const popularity = Math.min((d.popularity_score ?? 0) / 100, 1);
    // Freshness (5%)
    const freshness = freshnessScore(d.price_fetched_at);
    // Exploration Bonus (15%) — full range for more variance
    const exploration = rand(); // 0.0 to 1.0

    const rawScore =
      priceFit * 0.35 +
      prefMatch * 0.25 +
      seasonal * 0.15 +
      popularity * 0.05 +
      freshness * 0.05 +
      exploration * 0.15;

    return { dest: d, rawScore };
  });

  // Sort by raw score descending
  scored.sort((a, b) => b.rawScore - a.rawScore);

  // Apply diversity penalty via greedy reranking
  const remaining = scored.map((s) => s.dest);
  return applyDiversityRerank(remaining);
}

function applyDiversityRerank(sorted: ScoredDest[]): ScoredDest[] {
  if (sorted.length <= 1) return sorted;

  const remaining = [...sorted];
  const result: ScoredDest[] = [];
  const recentRegions: string[] = [];
  const recentVibes: string[] = [];
  const WINDOW = 4;

  // Seed with best scored pick
  const seed = remaining.shift()!;
  result.push(seed);
  recentRegions.push(getRegion(seed));
  recentVibes.push(getVibeBucket(seed.vibe_tags));

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    // Look at top candidates (weighted by position bonus)
    const lookAhead = Math.min(remaining.length, 10);
    for (let i = 0; i < lookAhead; i++) {
      const d = remaining[i];
      const region = getRegion(d);
      const vibe = getVibeBucket(d.vibe_tags);

      // Position bonus: earlier in the pre-sorted list = better
      const positionBonus = 1 - i / lookAhead;

      let regionPenalty = 0;
      for (let j = 0; j < recentRegions.length; j++) {
        if (recentRegions[j] === region) regionPenalty += 1 - j / WINDOW;
      }
      let vibePenalty = 0;
      for (let j = 0; j < recentVibes.length; j++) {
        if (recentVibes[j] === vibe) vibePenalty += 1 - j / WINDOW;
      }

      const score = positionBonus * 0.5 - regionPenalty * 0.35 - vibePenalty * 0.15;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const pick = remaining.splice(bestIdx, 1)[0];
    result.push(pick);
    recentRegions.unshift(getRegion(pick));
    recentVibes.unshift(getVibeBucket(pick.vibe_tags));
    if (recentRegions.length > WINDOW) recentRegions.pop();
    if (recentVibes.length > WINDOW) recentVibes.pop();
  }

  return result;
}

// ─── Feed composition mixing ────────────────────────────────────────

function composeFeed(
  personalized: ScoredDest[],
  allDestinations: ScoredDest[],
  rand: () => number = Math.random,
): ScoredDest[] {
  // For each batch of 15: 10 personalized, 3 popular, 2 random
  const result: ScoredDest[] = [];
  const usedIds = new Set<string>();

  // Sort all by popularity for the trending pool
  const byPopularity = [...allDestinations].sort(
    (a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0),
  );

  let pIdx = 0; // personalized index
  let tIdx = 0; // trending index

  while (pIdx < personalized.length || result.length < allDestinations.length) {
    // 10 personalized picks
    let added = 0;
    while (added < 10 && pIdx < personalized.length) {
      const d = personalized[pIdx++];
      if (!usedIds.has(d.id)) {
        result.push(d);
        usedIds.add(d.id);
        added++;
      }
    }

    // 3 popular/trending picks
    added = 0;
    while (added < 3 && tIdx < byPopularity.length) {
      const d = byPopularity[tIdx++];
      if (!usedIds.has(d.id)) {
        result.push(d);
        usedIds.add(d.id);
        added++;
      }
    }

    // 2 random exploration picks
    added = 0;
    let attempts = 0;
    while (added < 2 && attempts < 20) {
      const randIdx = Math.floor(rand() * allDestinations.length);
      const d = allDestinations[randIdx];
      if (!usedIds.has(d.id)) {
        result.push(d);
        usedIds.add(d.id);
        added++;
      }
      attempts++;
    }

    // Safety: break if we've used all destinations
    if (usedIds.size >= allDestinations.length) break;
  }

  return result;
}

// ─── Post-score soft shuffle ────────────────────────────────────────

function softShuffle<T>(items: T[], rand: () => number, windowSize = 5): T[] {
  const result = [...items];
  for (let i = 0; i < result.length; i++) {
    const minJ = Math.max(0, i - windowSize);
    const maxJ = Math.min(result.length - 1, i + windowSize);
    const j = minJ + Math.floor(rand() * (maxJ - minJ + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── In-memory cache (per origin, 10-min TTL) ───────────────────────

const destCache = new Map<string, { data: ScoredDest[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

async function getDestinationsWithPrices(origin: string): Promise<ScoredDest[]> {
  const cached = destCache.get(origin);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const { data: destinations, error } = await supabase
    .from('destinations')
    .select('*')
    .eq('is_active', true);

  if (error || !destinations) throw new Error(error?.message || 'Failed to fetch destinations');

  const [{ data: prices }, { data: hotelPrices }, { data: images }] = await Promise.all([
    supabase.from('cached_prices').select('*').eq('origin', origin),
    supabase.from('cached_hotel_prices').select('*'),
    supabase.from('destination_images').select('*').order('is_primary', { ascending: false }),
  ]);

  const priceMap = new Map<string, {
    price: number; airline: string; duration: string; source: string; fetched_at: string;
    departure_date?: string; return_date?: string; trip_duration_days?: number;
    previous_price?: number; price_direction?: string;
  }>();
  if (prices) {
    for (const p of prices) {
      priceMap.set(p.destination_iata, {
        price: p.price,
        airline: p.airline || '',
        duration: p.duration || '',
        source: p.source || 'estimate',
        fetched_at: p.fetched_at || '',
        departure_date: p.departure_date || undefined,
        return_date: p.return_date || undefined,
        trip_duration_days: p.trip_duration_days ?? undefined,
        previous_price: p.previous_price ?? undefined,
        price_direction: p.price_direction || 'stable',
      });
    }
  }

  const hotelPriceMap = new Map<string, { price: number; source: string }>();
  if (hotelPrices) {
    for (const h of hotelPrices) {
      hotelPriceMap.set(h.destination_iata, {
        price: h.price_per_night,
        source: h.source || 'estimate',
      });
    }
  }

  // Build image map: all images grouped by destination_id
  const imageMap = new Map<string, Array<{ url_regular: string; blur_hash: string; photographer: string; photographer_url: string }>>();
  if (images) {
    for (const img of images) {
      const list = imageMap.get(img.destination_id) || [];
      list.push({
        url_regular: img.url_regular,
        blur_hash: img.blur_hash || '',
        photographer: img.photographer || '',
        photographer_url: img.photographer_url || '',
      });
      imageMap.set(img.destination_id, list);
    }
  }

  const merged: ScoredDest[] = destinations.map((d) => {
    const lp = priceMap.get(d.iata_code);
    const hp = hotelPriceMap.get(d.iata_code);
    const destImages = imageMap.get(d.id) || [];

    // Always use the primary (is_primary=true) image — it's the most relevant search result.
    // destImages is ordered by is_primary DESC, so index 0 is the primary.
    const primaryImage = destImages.length > 0 ? destImages[0] : undefined;

    return {
      ...d,
      live_price: lp?.price ?? null,
      live_airline: lp?.airline ?? '',
      live_duration: lp?.duration ?? '',
      price_source: lp?.source ?? undefined,
      price_fetched_at: lp?.fetched_at ?? undefined,
      departure_date: lp?.departure_date,
      return_date: lp?.return_date,
      trip_duration_days: lp?.trip_duration_days,
      previous_price: lp?.previous_price,
      price_direction: lp?.price_direction,
      live_hotel_price: hp?.price ?? null,
      hotel_price_source: hp?.source ?? undefined,
      unsplash_image_url: primaryImage?.url_regular,
      unsplash_blur_hash: primaryImage?.blur_hash,
      unsplash_photographer: primaryImage?.photographer,
      unsplash_photographer_url: primaryImage?.photographer_url,
      unsplash_images: destImages.length > 0 ? destImages : undefined,
    };
  });

  destCache.set(origin, { data: merged, ts: Date.now() });
  return merged;
}

// ─── Auth helper ────────────────────────────────────────────────────

async function getUserPrefsAndId(authHeader: string | undefined): Promise<{ prefs: UserPrefs; userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('budget_numeric, pref_beach, pref_city, pref_adventure, pref_culture, pref_nightlife, pref_nature, pref_food')
      .eq('user_id', user.id)
      .single();

    if (!prefs) return null;

    return {
      userId: user.id,
      prefs: {
        budget_numeric: prefs.budget_numeric ?? 2,
        pref_beach: prefs.pref_beach ?? 0.5,
        pref_city: prefs.pref_city ?? 0.5,
        pref_adventure: prefs.pref_adventure ?? 0.5,
        pref_culture: prefs.pref_culture ?? 0.5,
        pref_nightlife: prefs.pref_nightlife ?? 0.5,
        pref_nature: prefs.pref_nature ?? 0.5,
        pref_food: prefs.pref_food ?? 0.5,
      },
    };
  } catch {
    return null;
  }
}

// ─── Transform DB row → frontend Destination shape ───────────────────

function toFrontend(d: ScoredDest) {
  // Use Unsplash URL with Pexels fallback
  const imageUrl = d.unsplash_image_url || d.image_url;

  // Use Unsplash gallery images if available, fall back to Pexels seed data
  const galleryUrls = d.unsplash_images && d.unsplash_images.length > 0
    ? d.unsplash_images.map((img) => img.url_regular)
    : d.image_urls;

  return {
    id: d.id,
    iataCode: d.iata_code,
    city: d.city,
    country: d.country,
    tagline: d.tagline,
    description: d.description,
    imageUrl,
    imageUrls: galleryUrls,
    flightPrice: d.live_price ?? d.flight_price,
    hotelPricePerNight: d.live_hotel_price ?? d.hotel_price_per_night,
    currency: d.currency,
    vibeTags: d.vibe_tags,
    rating: d.rating,
    reviewCount: d.review_count,
    bestMonths: d.best_months,
    averageTemp: d.average_temp,
    flightDuration: d.live_duration || d.flight_duration,
    livePrice: d.live_price,
    priceSource: d.live_price != null ? (d.price_source as 'travelpayouts' | 'amadeus' | 'estimate') : 'estimate',
    priceFetchedAt: d.price_fetched_at || undefined,
    liveHotelPrice: d.live_hotel_price ?? null,
    hotelPriceSource: d.live_hotel_price != null ? (d.hotel_price_source as 'liteapi' | 'estimate') : 'estimate',
    available_flight_days: d.available_flight_days || undefined,
    itinerary: d.itinerary || undefined,
    restaurants: d.restaurants || undefined,
    departureDate: d.departure_date || undefined,
    returnDate: d.return_date || undefined,
    tripDurationDays: d.trip_duration_days ?? undefined,
    airline: d.live_airline || undefined,
    blurHash: d.unsplash_blur_hash || undefined,
    priceDirection: (d.price_direction as 'up' | 'down' | 'stable') || undefined,
    previousPrice: d.previous_price ?? undefined,
    photographerAttribution: d.unsplash_photographer
      ? { name: d.unsplash_photographer, url: d.unsplash_photographer_url || '' }
      : undefined,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const v = validateRequest(feedQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { origin, cursor: parsedCursor, sessionId, excludeIds, vibeFilter } = v.data;
    const cursor = parsedCursor ?? 0;

    const allDestinations = await getDestinationsWithPrices(origin);

    // Session-based PRNG: each session gets a unique feed order
    const seed = sessionId
      ? `${origin}:${sessionId}`
      : `${origin}:${Date.now()}-${Math.random()}`;
    const rand = seededRandom(seed);

    // Check for auth -> personalized vs generic scoring + get userId for seen-filtering
    const authResult = await getUserPrefsAndId(req.headers.authorization);

    // Build set of already-seen destination IDs
    const seenIds = new Set<string>();

    // Merge client-provided excludeIds
    if (excludeIds) {
      for (const id of excludeIds.split(',')) {
        const trimmed = id.trim();
        if (trimmed) seenIds.add(trimmed);
      }
    }

    // For authenticated users, also exclude from swipe_history
    if (authResult?.userId) {
      const { data: history } = await supabase
        .from('swipe_history')
        .select('destination_id')
        .eq('user_id', authResult.userId);
      if (history) {
        for (const row of history) {
          seenIds.add(row.destination_id);
        }
      }
    }

    // Filter out already-seen destinations + apply vibe filter
    let destinations = seenIds.size > 0
      ? allDestinations.filter((d) => !seenIds.has(d.id))
      : [...allDestinations];

    if (vibeFilter) {
      const vibe = vibeFilter.toLowerCase();
      destinations = destinations.filter((d) =>
        d.vibe_tags.some((t) => t.toLowerCase() === vibe),
      );
    }

    let scored: ScoredDest[];
    if (authResult?.prefs) {
      const personalized = scorePersonalizedFeed(destinations, authResult.prefs, rand);
      scored = composeFeed(personalized, destinations, rand);
    } else {
      scored = scoreFeedGeneric(destinations, rand);
    }

    // Soft shuffle: preserve approximate relevance but break exact determinism
    scored = softShuffle(scored, rand, 5);

    const page = scored.slice(cursor, cursor + PAGE_SIZE).map(toFrontend);
    const nextCursor = cursor + PAGE_SIZE < scored.length ? String(cursor + PAGE_SIZE) : null;

    // Shorter cache for personalized/session feeds — session-based feeds are unique per user
    const cacheTime = authResult || sessionId ? 0 : 300;
    res.setHeader('Cache-Control', cacheTime > 0
      ? `s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
      : 'no-store');
    return res.status(200).json({ destinations: page, nextCursor });
  } catch (err) {
    logApiError('api/feed', err);
    return res.status(500).json({ error: 'Failed to load feed' });
  }
}
