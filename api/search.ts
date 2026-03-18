import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { ID } from 'node-appwrite';
import { searchFlights } from '../services/duffel';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { searchQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors';

// ─── Date strategy (same as cron: ~2 weeks out, shifted to next Wednesday) ──

function getSearchDates(): { departureDate: string; returnDate: string } {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86400000);
  const dayOfWeek = twoWeeksOut.getDay();
  const daysUntilWed = (3 - dayOfWeek + 7) % 7 || 7;
  const departure = new Date(twoWeeksOut.getTime() + daysUntilWed * 86400000);
  const returnDate = new Date(departure.getTime() + 7 * 86400000);
  return {
    departureDate: departure.toISOString().split('T')[0],
    returnDate: returnDate.toISOString().split('T')[0],
  };
}

// ─── Compact Duffel offer for caching ───────────────────────────────────────

function compactOfferJson(offer: Record<string, unknown>): string {
  const compact = {
    id: offer.id,
    total_amount: offer.total_amount,
    total_currency: offer.total_currency,
    expires_at: offer.expires_at,
    slices: ((offer.slices as any[]) || []).map((slice: any) => ({
      segments: ((slice.segments as any[]) || []).map((seg: any) => ({
        operating_carrier: {
          name: seg.operating_carrier?.name,
          iata_code: seg.operating_carrier?.iata_code,
        },
        operating_carrier_flight_number: seg.operating_carrier_flight_number,
        departing_at: seg.departing_at,
        arriving_at: seg.arriving_at,
        origin: { iata_code: seg.origin?.iata_code },
        destination: { iata_code: seg.destination?.iata_code },
        aircraft: seg.aircraft ? { name: seg.aircraft.name } : null,
      })),
    })),
  };
  return JSON.stringify(compact);
}

// ─── Cache freshness check ─────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function isFreshCache(doc: Record<string, unknown>): boolean {
  const fetchedAt = doc.fetched_at as string | undefined;
  const offerExpiresAt = doc.offer_expires_at as string | undefined;
  const source = doc.source as string | undefined;

  if (source !== 'duffel') return false;
  if (!fetchedAt || !offerExpiresAt) return false;

  const now = Date.now();
  const fetchedTime = new Date(fetchedAt).getTime();
  const expiresTime = new Date(offerExpiresAt).getTime();

  return now - fetchedTime < CACHE_TTL_MS && expiresTime > now;
}

// ─── Extract response fields from a cached_prices document ─────────────────

function buildResponse(doc: Record<string, unknown>, cached: boolean) {
  const offerJson = doc.offer_json ? JSON.parse(doc.offer_json as string) : null;
  const outboundSlice = offerJson?.slices?.[0];
  const firstSeg = outboundSlice?.segments?.[0];
  const lastSeg = outboundSlice?.segments?.[outboundSlice.segments.length - 1];

  let flightDuration = '';
  if (firstSeg && lastSeg) {
    const depTime = new Date(firstSeg.departing_at).getTime();
    const arrTime = new Date(lastSeg.arriving_at).getTime();
    const durationMs = arrTime - depTime;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    flightDuration = `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  return {
    price: doc.price as number,
    currency: (doc.currency as string) || 'USD',
    airline: (doc.airline as string) || '',
    airlineCode: (doc.airline_code as string) || '',
    flightDuration,
    departureDate: (doc.departure_date as string) || '',
    returnDate: (doc.return_date as string) || '',
    tripDays: 7,
    offerJson,
    offerExpiresAt: (doc.offer_expires_at as string) || '',
    cached,
    searchedAt: (doc.fetched_at as string) || new Date().toISOString(),
  };
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Validate input
  const validation = validateRequest(searchQuerySchema, req.query);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error });
  }
  const { origin, destination } = validation.data;

  // Rate limit: 10 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rateLimit = checkRateLimit(`search:${ip}`, 10, 60_000);
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Rate limited', retryAfter });
  }

  try {
    // Check cache for fresh Duffel result
    const cached = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
      Query.equal('origin', origin),
      Query.equal('destination_iata', destination),
      Query.equal('source', 'duffel'),
      Query.orderAsc('price'),
      Query.limit(1),
    ]);

    if (cached.documents.length > 0 && isFreshCache(cached.documents[0])) {
      return res.status(200).json(buildResponse(cached.documents[0], true));
    }

    // Cache miss — perform live Duffel search
    const { departureDate, returnDate } = getSearchDates();
    const offerResponse = await searchFlights({
      origin,
      destination,
      departureDate,
      returnDate,
      passengers: [{ type: 'adult' }],
      cabinClass: 'economy',
    });

    const offers = (offerResponse as any)?.data ?? [];
    if (!offers.length) {
      return res.status(404).json({ error: 'No flights found' });
    }

    // Find cheapest offer
    const cheapest = offers.reduce((best: any, offer: any) => {
      const price = parseFloat(offer.total_amount);
      return price < parseFloat(best.total_amount) ? offer : best;
    }, offers[0]);

    const outboundSlice = cheapest.slices?.[0];
    const firstSeg = outboundSlice?.segments?.[0];
    const price = parseFloat(cheapest.total_amount);
    const airlineName = firstSeg?.operating_carrier?.name || '';
    const airlineCode = firstSeg?.operating_carrier?.iata_code || '';

    // Upsert into cached_prices
    const docData: Record<string, unknown> = {
      origin,
      destination_iata: destination,
      price,
      currency: cheapest.total_currency || 'USD',
      airline: airlineName,
      airline_code: airlineCode,
      source: 'duffel',
      departure_date: departureDate,
      return_date: returnDate,
      offer_json: compactOfferJson(cheapest),
      offer_expires_at: cheapest.expires_at || '',
      fetched_at: new Date().toISOString(),
    };

    // Check for existing doc to update
    const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
      Query.equal('origin', origin),
      Query.equal('destination_iata', destination),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      await serverDatabases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.cachedPrices,
        existing.documents[0].$id as string,
        docData,
      );
    } else {
      await serverDatabases.createDocument(
        DATABASE_ID,
        COLLECTIONS.cachedPrices,
        ID.unique(),
        docData,
      );
    }

    // Build response from the fresh data
    const responseDoc = { ...docData };
    return res.status(200).json(buildResponse(responseDoc, false));
  } catch (err) {
    logApiError('search', err);
    return res.status(500).json({ error: 'Search failed' });
  }
}
