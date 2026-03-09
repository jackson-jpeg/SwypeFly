import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { searchDealsQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors.js';

const PAGE_SIZE = 20;

// ─── Region helper (mirrors api/feed.ts) ─────────────────────────────

interface DestDoc {
  $id: string;
  iata_code: string;
  city: string;
  country: string;
  continent?: string;
  image_url: string;
  vibe_tags: string[];
}

interface PriceDoc {
  destination_iata: string;
  origin: string;
  price: number;
  currency: string;
  airline: string;
  departure_date?: string;
  return_date?: string;
  trip_duration_days?: number;
  price_direction: string | null;
  previous_price: number | null;
  source: string;
  offer_json: string | null;
  offer_expires_at: string | null;
}

interface Deal {
  destinationId: string;
  city: string;
  country: string;
  iataCode: string;
  imageUrl: string;
  vibeTags: string[];
  price: number;
  currency: string;
  airline: string;
  departureDate: string;
  returnDate: string;
  tripDurationDays: number;
  priceDirection: string | null;
  previousPrice: number | null;
  priceSource: string;
  offerJson: string | null;
  offerExpiresAt: string | null;
}

function getRegion(d: { continent?: string; country: string }): string {
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
  if (['jamaica', 'dominican republic', 'bahamas', 'cuba', 'puerto rico'].includes(country))
    return 'caribbean';
  if (country === 'usa') return 'domestic';
  if (['new zealand', 'australia'].includes(country)) return 'oceania';
  if (['canada', 'mexico'].includes(country)) return 'americas';
  return 'other';
}

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const v = validateRequest(searchDealsQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { origin, search, region, minPrice, maxPrice, sort, cursor: parsedCursor } = v.data;
    const cursor = parsedCursor ?? 0;

    // Fetch destinations and cached prices in parallel
    const [destResult, priceResult] = await Promise.all([
      serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [
        Query.equal('is_active', true),
        Query.limit(500),
      ]),
      serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
        Query.equal('origin', origin),
        Query.limit(500),
      ]),
    ]);

    // Build price lookup by IATA code
    const priceMap = new Map<string, PriceDoc>();
    for (const p of priceResult.documents) {
      priceMap.set(p.destination_iata as string, {
        destination_iata: p.destination_iata as string,
        origin: p.origin as string,
        price: p.price as number,
        currency: (p.currency as string) || 'USD',
        airline: (p.airline as string) || '',
        departure_date: (p.departure_date as string) || '',
        return_date: (p.return_date as string) || '',
        trip_duration_days: (p.trip_duration_days as number) ?? 0,
        price_direction: (p.price_direction as string) || null,
        previous_price: (p.previous_price as number) ?? null,
        source: (p.source as string) || 'estimate',
        offer_json: (p.offer_json as string) || null,
        offer_expires_at: (p.offer_expires_at as string) || null,
      });
    }

    // Join: only destinations with a cached price become deals
    let deals: (Deal & { _region: string })[] = [];
    for (const d of destResult.documents) {
      const price = priceMap.get(d.iata_code as string);
      if (!price) continue;

      deals.push({
        destinationId: d.$id,
        city: d.city as string,
        country: d.country as string,
        iataCode: d.iata_code as string,
        imageUrl: (d.image_url as string) || '',
        vibeTags: (d.vibe_tags as string[]) || [],
        price: price.price,
        currency: price.currency,
        airline: price.airline,
        departureDate: price.departure_date || '',
        returnDate: price.return_date || '',
        tripDurationDays: price.trip_duration_days || 0,
        priceDirection: price.price_direction || null,
        previousPrice: price.previous_price ?? null,
        priceSource: price.source || 'estimate',
        offerJson: price.offer_json || null,
        offerExpiresAt: price.offer_expires_at || null,
        _region: getRegion({
          continent: (d.continent as string) || undefined,
          country: d.country as string,
        }),
      });
    }

    // Apply filters
    if (search) {
      const s = search.toLowerCase();
      deals = deals.filter(
        (d) =>
          d.city.toLowerCase().includes(s) ||
          d.country.toLowerCase().includes(s) ||
          d.iataCode.toLowerCase().includes(s),
      );
    }

    if (region && region !== 'all') {
      deals = deals.filter((d) => d._region === region);
    }

    if (minPrice != null) {
      deals = deals.filter((d) => d.price >= minPrice);
    }

    if (maxPrice != null) {
      deals = deals.filter((d) => d.price <= maxPrice);
    }

    // Sort
    if (sort === 'cheapest') {
      deals.sort((a, b) => a.price - b.price);
    } else if (sort === 'trending') {
      // Biggest price drops first (previous - current, descending)
      deals.sort((a, b) => {
        const dropA = a.previousPrice != null ? a.previousPrice - a.price : 0;
        const dropB = b.previousPrice != null ? b.previousPrice - b.price : 0;
        return dropB - dropA;
      });
    } else if (sort === 'newest') {
      // Earliest departure dates first
      deals.sort((a, b) => {
        const da = a.departureDate || '9999-12-31';
        const db = b.departureDate || '9999-12-31';
        return da.localeCompare(db);
      });
    }

    const total = deals.length;

    // Paginate
    const page = deals.slice(cursor, cursor + PAGE_SIZE);
    const nextCursor = cursor + PAGE_SIZE < total ? cursor + PAGE_SIZE : null;

    // Strip internal _region field
    const cleanDeals = page.map(({ _region, ...rest }) => rest);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ deals: cleanDeals, nextCursor, total });
  } catch (err) {
    logApiError('api/search-deals', err);
    return res.status(500).json({ error: 'Failed to search deals' });
  }
}
