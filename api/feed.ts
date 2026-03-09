import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { feedQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
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
  live_hotel_price?: number | null;
  hotel_price_source?: string;
  available_flight_days?: string[];
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number }[];
  hotels_data?: any[];
}

// ─── Generic scoring (for anonymous users) ──────────────────────────

function scoreFeedGeneric(
  destinations: ScoredDest[],
  rand: () => number = Math.random,
): ScoredDest[] {
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
      const score =
        priceScore * 0.30 - regionPenalty * 0.30 - vibePenalty * 0.15 + jitter;

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
      Query.equal('origin', origin), Query.limit(500),
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
    }
  >();
  for (const p of prices) {
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
      image_url: imageMap.get(d.$id)?.url || (d.image_url as string) || '',
      image_urls: imageMap.get(d.$id)?.urls || (d.image_urls as string[]) || [],
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
    itinerary: d.itinerary || undefined,
    restaurants: d.restaurants || undefined,
    departureDate: d.departure_date || undefined,
    returnDate: d.return_date || undefined,
    tripDurationDays: d.trip_duration_days ?? undefined,
    airline: d.live_airline || undefined,
    priceDirection: (d.price_direction as 'up' | 'down' | 'stable') || undefined,
    previousPrice: d.previous_price ?? undefined,
    offerJson: d.offer_json || undefined,
    offerExpiresAt: d.offer_expires_at || undefined,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const v = validateRequest(feedQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { origin, cursor: parsedCursor, sessionId, excludeIds, vibeFilter, sortPreset, regionFilter, maxPrice } = v.data;
    const cursor = parsedCursor ?? 0;

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
      destinations = destinations.filter((d) => getRegion(d) === regionFilter);
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

    if (excludeIds) {
      const excludeSet = new Set(excludeIds.split(',').map((s) => s.trim()).filter(Boolean));
      destinations = destinations.filter((d) => !excludeSet.has(d.id));
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
    } else {
      scored = scoreFeedGeneric(destinations, rand);
      scored = softShuffle(scored, rand, 5);
    }

    const page = scored.slice(cursor, cursor + PAGE_SIZE).map(toFrontend);
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
