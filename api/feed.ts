import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { feedQuerySchema, budgetDiscoveryQuerySchema, detectOriginQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { generateAviasalesLink } from '../utils/affiliateLinks';
import { verifyClerkToken } from '../utils/clerkAuth';
import { fetchByPriceRange, detectOriginAirport } from '../services/travelpayouts';
import { cors } from './_cors.js';

const PAGE_SIZE = 10;

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

function getRegion(d: ScoredDest): string {
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

  const country = d.country.toLowerCase();
  if (
    ['indonesia', 'japan', 'thailand', 'singapore', 'south korea', 'vietnam', 'maldives'].includes(
      country,
    )
  )
    return 'asia';
  if (
    [
      'greece',
      'croatia',
      'italy',
      'portugal',
      'iceland',
      'switzerland',
      'spain',
      'france',
    ].includes(country)
  )
    return 'europe';
  if (['morocco', 'south africa', 'uae'].includes(country)) return 'africa-me';
  if (['peru', 'argentina', 'brazil', 'colombia', 'costa rica'].includes(country)) return 'latam';
  if (
    ['jamaica', 'dominican republic', 'bahamas', 'cuba', 'puerto rico'].includes(country)
  )
    return 'caribbean';
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
  live_hotel_price?: number | null;
  hotel_price_source?: string;
  available_flight_days?: string[];
  latitude?: number;
  longitude?: number;
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number }[];
  hotels_data?: any[];
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

  // Preferred vibes bonus (+0.20)
  if (prefs.preferredVibes && prefs.preferredVibes.length > 0) {
    const destTags = d.vibe_tags.map((t) => t.toLowerCase());
    let vibeMatches = 0;
    for (const pref of prefs.preferredVibes) {
      // Expand quiz vibe to destination tags
      const matchTags = QUIZ_VIBE_MAP[pref] || [pref];
      if (matchTags.some((t) => destTags.includes(t))) {
        vibeMatches++;
      }
    }
    if (vibeMatches > 0) {
      // Scale: 1 match = +0.12, 2+ matches = up to +0.20
      bonus += Math.min(vibeMatches * 0.10, 0.20);
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

  remaining.sort((a, b) => {
    const pa = a.live_price ?? a.flight_price;
    const pb = b.live_price ?? b.flight_price;
    return (pb / 1000) - (pa / 1000);
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
      const jitter = rand() * 0.35;

      // Quiz personalization bonus (additive, optional)
      const quizBonus = hasQuizPrefs ? computeQuizBonus(d, quizPrefs!, minPrice, maxPrice) : 0;

      const score =
        priceScore * 0.30 - regionPenalty * 0.30 - vibePenalty * 0.15 + jitter + quizBonus;

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
    const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.userPreferences, [
      Query.equal('user_id', userId),
      Query.limit(1),
    ]);
    if (result.documents.length === 0) {
      prefCache.set(userId, { data: null, ts: Date.now() });
      return null;
    }
    const doc = result.documents[0];
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
  let bestSeedIdx = 0;
  let bestSeedSim = -Infinity;
  for (let i = 0; i < remaining.length; i++) {
    const sim = cosineSimilarity(userVec, getDestFeatureVector(remaining[i]));
    if (sim > bestSeedSim) {
      bestSeedSim = sim;
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

      const jitter = rand() * 0.15;

      // Quiz bonus (additive, optional)
      const quizBonus = hasQuizPrefs ? computeQuizBonus(d, quizPrefs!, minPrice, maxPrice) : 0;

      const score =
        prefScore * 0.35 + priceScore * 0.20 - regionPenalty * 0.20 - vibePenalty * 0.10 + jitter + quizBonus;

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

  // Fetch destinations from Appwrite
  const destResult = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [
    Query.equal('is_active', true),
    Query.limit(500),
  ]);

  // Fetch cached prices, hotel prices, and refreshed images in parallel
  const [priceResult, hotelPriceResult, imageResult] = await Promise.all([
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
      Query.equal('origin', origin), Query.orderAsc('price'), Query.limit(500),
    ]).catch(() => ({ documents: [] })),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedHotelPrices, [
      Query.limit(500),
    ]).catch(() => ({ documents: [] })),
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinationImages, [
      Query.limit(2500),
    ]).catch(() => ({ documents: [] })),
  ]);

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
    }
  >();
  for (const p of prices) {
    // Keep the cheapest price per destination (results are ordered by price ASC)
    if (priceMap.has(p.destination_iata as string)) continue;
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
    });
  }

  // Build hotel price + hotels lookup by IATA code
  const hotelPriceMap = new Map<string, { price: number; source: string; hotels?: any[] }>();
  for (const hp of hotelPriceResult.documents) {
    let hotels: any[] | undefined;
    try {
      hotels = hp.hotels_json ? JSON.parse(hp.hotels_json as string) : undefined;
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
    const lp = priceMap.get(d.iata_code as string);

    // Parse JSON fields stored as strings in Appwrite
    let itinerary: ScoredDest['itinerary'];
    let restaurants: ScoredDest['restaurants'];
    try {
      itinerary = d.itinerary_json ? JSON.parse(d.itinerary_json as string) : undefined;
    } catch {
      itinerary = undefined;
    }
    try {
      restaurants = d.restaurants_json ? JSON.parse(d.restaurants_json as string) : undefined;
    } catch {
      restaurants = undefined;
    }

    return {
      id: d.$id,
      iata_code: d.iata_code as string,
      city: d.city as string,
      country: d.country as string,
      continent: (d.continent as string) || undefined,
      tagline: (d.tagline as string) || '',
      description: (d.description as string) || '',
      // Prefer Google Places photos on the destination doc (city-specific)
      // over destination_images collection (generic Unsplash)
      image_url: (d.image_url as string) || imageMap.get(d.$id)?.url || '',
      image_urls: (d.image_urls as string[])?.length ? (d.image_urls as string[]) : imageMap.get(d.$id)?.urls || [],
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
      offer_json: lp?.offer_json,
      offer_expires_at: lp?.offer_expires_at,
      flight_number: lp?.flight_number,
      tp_found_at: lp?.tp_found_at,
      live_hotel_price: hotelPriceMap.get(d.iata_code as string)?.price ?? null,
      hotel_price_source: hotelPriceMap.get(d.iata_code as string)?.source ?? undefined,
      hotels_data: hotelPriceMap.get(d.iata_code as string)?.hotels ?? undefined,
      itinerary,
      restaurants,
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
    // Prefer Google Places photos (city-specific) over Unsplash (often generic)
    imageUrl: d.image_urls?.[0] || d.image_url,
    imageUrls: d.image_urls,
    flightPrice: d.live_price ?? d.flight_price,
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
    priceFetchedAt: d.price_fetched_at || undefined,
    liveHotelPrice: d.live_hotel_price ?? null,
    hotelPriceSource: d.live_hotel_price != null
      ? (d.hotel_price_source as 'duffel' | 'liteapi' | 'estimate')
      : 'estimate',
    hotels: d.hotels_data ?? undefined,
    available_flight_days: d.available_flight_days || undefined,
    latitude: d.latitude ?? undefined,
    longitude: d.longitude ?? undefined,
    itinerary: d.itinerary || undefined,
    restaurants: d.restaurants || undefined,
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
    offerJson: d.offer_json || undefined,
    offerExpiresAt: d.offer_expires_at || undefined,
    tpFoundAt: d.tp_found_at || undefined,
    airlineLogoUrl: d.live_airline
      ? `https://pics.avs.io/200/80/${d.live_airline}.png`
      : undefined,
    affiliateUrl:
      d.price_source === 'travelpayouts' && origin
        ? generateAviasalesLink(origin, d.iata_code, d.departure_date, d.return_date)
        : undefined,
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
      scored = [...destinations].sort((a, b) => {
        const pa = a.live_price ?? a.flight_price;
        const pb = b.live_price ?? b.flight_price;
        return pa - pb;
      });
    } else if (sortPreset === 'trending') {
      scored = [...destinations].sort(
        (a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0),
      );
    } else if (userPrefs) {
      scored = scorePersonalized(destinations, userPrefs, rand, quizPrefs);
      scored = softShuffle(scored, rand, 5);
    } else {
      scored = scoreFeedGeneric(destinations, rand, quizPrefs);
      scored = softShuffle(scored, rand, 5);
    }

    const page = scored.slice(cursor, cursor + PAGE_SIZE).map((d) => toFrontend(d, origin));
    const nextCursor = cursor + PAGE_SIZE < scored.length ? String(cursor + PAGE_SIZE) : null;

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
