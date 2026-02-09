import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const PAGE_SIZE = 15;

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
  // Merged from cached_hotel_prices
  live_hotel_price?: number | null;
  hotel_price_source?: string;
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

function scoreFeedGeneric(destinations: ScoredDest[]): ScoredDest[] {
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

      const score = priceScore * 0.3 + ratingScore * 0.2 - regionPenalty * 0.35 - vibePenalty * 0.15;

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

function scorePersonalizedFeed(destinations: ScoredDest[], prefs: UserPrefs): ScoredDest[] {
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

    // Price Fit (40%)
    const priceFit = priceFitScore(effectivePrice, prefs.budget_numeric);
    // Preference Match (25%)
    const prefMatch = cosineSimilarity(userVec, destVec);
    // Seasonality (15%)
    const seasonal = seasonalityScore(d.best_months || []);
    // Popularity (10%)
    const popularity = Math.min((d.popularity_score ?? 0) / 100, 1);
    // Exploration Bonus (10%)
    const exploration = Math.random() * 0.5 + 0.5; // 0.5 to 1.0

    const rawScore =
      priceFit * 0.40 +
      prefMatch * 0.25 +
      seasonal * 0.15 +
      popularity * 0.10 +
      exploration * 0.10;

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
      const randIdx = Math.floor(Math.random() * allDestinations.length);
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

  const [{ data: prices }, { data: hotelPrices }] = await Promise.all([
    supabase.from('cached_prices').select('*').eq('origin', origin),
    supabase.from('cached_hotel_prices').select('*'),
  ]);

  const priceMap = new Map<string, { price: number; airline: string; duration: string; source: string; fetched_at: string }>();
  if (prices) {
    for (const p of prices) {
      priceMap.set(p.destination_iata, {
        price: p.price,
        airline: p.airline || '',
        duration: p.duration || '',
        source: p.source || 'estimate',
        fetched_at: p.fetched_at || '',
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

  const merged: ScoredDest[] = destinations.map((d) => {
    const lp = priceMap.get(d.iata_code);
    const hp = hotelPriceMap.get(d.iata_code);
    return {
      ...d,
      live_price: lp?.price ?? null,
      live_airline: lp?.airline ?? '',
      live_duration: lp?.duration ?? '',
      price_source: lp?.source ?? undefined,
      price_fetched_at: lp?.fetched_at ?? undefined,
      live_hotel_price: hp?.price ?? null,
      hotel_price_source: hp?.source ?? undefined,
    };
  });

  destCache.set(origin, { data: merged, ts: Date.now() });
  return merged;
}

// ─── Auth helper ────────────────────────────────────────────────────

async function getUserPrefs(authHeader: string | undefined): Promise<UserPrefs | null> {
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
      budget_numeric: prefs.budget_numeric ?? 2,
      pref_beach: prefs.pref_beach ?? 0.5,
      pref_city: prefs.pref_city ?? 0.5,
      pref_adventure: prefs.pref_adventure ?? 0.5,
      pref_culture: prefs.pref_culture ?? 0.5,
      pref_nightlife: prefs.pref_nightlife ?? 0.5,
      pref_nature: prefs.pref_nature ?? 0.5,
      pref_food: prefs.pref_food ?? 0.5,
    };
  } catch {
    return null;
  }
}

// ─── Transform DB row → frontend Destination shape ───────────────────

function toFrontend(d: ScoredDest) {
  return {
    id: d.id,
    iataCode: d.iata_code,
    city: d.city,
    country: d.country,
    tagline: d.tagline,
    description: d.description,
    imageUrl: d.image_url,
    imageUrls: d.image_urls,
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
  };
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const origin = (req.query.origin as string) || 'TPA';
    const cursor = parseInt((req.query.cursor as string) || '0', 10);

    const destinations = await getDestinationsWithPrices(origin);

    // Check for auth -> personalized vs generic scoring
    const userPrefs = await getUserPrefs(req.headers.authorization);

    let scored: ScoredDest[];
    if (userPrefs) {
      const personalized = scorePersonalizedFeed(destinations, userPrefs);
      scored = composeFeed(personalized, destinations);
    } else {
      scored = scoreFeedGeneric(destinations);
    }

    const page = scored.slice(cursor, cursor + PAGE_SIZE).map(toFrontend);
    const nextCursor = cursor + PAGE_SIZE < scored.length ? String(cursor + PAGE_SIZE) : null;

    // Shorter cache for personalized feeds
    const cacheTime = userPrefs ? 60 : 300;
    res.setHeader('Cache-Control', `s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`);
    return res.status(200).json({ destinations: page, nextCursor });
  } catch (err) {
    console.error('[api/feed]', err);
    return res.status(500).json({ error: 'Failed to load feed' });
  }
}
