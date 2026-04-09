import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { searchFlights } from '../services/duffel';
import type { Offer, OfferRequest } from '@duffel/api/types';
import {
  compactOfferJson as sharedCompactOfferJson,
  getOffersFromResult,
  sortOffersByPrice,
} from '../utils/duffelMapper';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { searchQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors';
import { env, STUB_MODE } from '../utils/env';
import { STALE_PRICE_MS } from '../utils/config';
import { sendError } from '../utils/apiResponse';

const BOOKING_MARKUP_PERCENT = env.BOOKING_MARKUP_PERCENT;
function withMarkup(price: number): number {
  return Math.round(price * (1 + BOOKING_MARKUP_PERCENT / 100));
}

// ─── Date strategy (same as cron: ~2 weeks out, shifted to next Wednesday) ──

function getSearchDates(): { departureDate: string; returnDate: string } {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86400000);
  const dayOfWeek = twoWeeksOut.getDay();
  const daysUntilWed = (3 - dayOfWeek + 7) % 7 || 7;
  const departure = new Date(twoWeeksOut.getTime() + daysUntilWed * 86400000);
  const returnDate = new Date(departure.getTime() + 5 * 86400000);
  return {
    departureDate: departure.toISOString().split('T')[0],
    returnDate: returnDate.toISOString().split('T')[0],
  };
}

// ─── Compact Duffel offer for caching (delegates to shared mapper) ──────────

// ─── Cache freshness check ─────────────────────────────────────────────────

const CACHE_TTL_MS = STALE_PRICE_MS;

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
    price: withMarkup(doc.price as number),
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
  if (req.method !== 'GET') return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');

  // Validate input
  const validation = validateRequest(searchQuerySchema, req.query);
  if (!validation.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', validation.error);
  }
  const { origin, destination } = validation.data;

  // Rate limit: 10 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rateLimit = checkRateLimit(`search:${ip}`, 10, 60_000);
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return sendError(res, 429, 'RATE_LIMITED', 'Rate limited', { retryAfter });
  }

  try {
    // Check cache for fresh Duffel result
    const { data: cachedDocs, error: cacheError } = await supabase
      .from(TABLES.cachedPrices)
      .select('*')
      .eq('origin', origin)
      .eq('destination_iata', destination)
      .eq('source', 'duffel')
      .order('price', { ascending: true })
      .limit(1);
    if (cacheError) throw cacheError;

    if ((cachedDocs ?? []).length > 0 && isFreshCache(cachedDocs![0])) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=60');
      return res.status(200).json(buildResponse(cachedDocs![0], true));
    }

    // If we have any cached data (even stale), return it when Duffel is unavailable
    if (STUB_MODE) {
      if ((cachedDocs ?? []).length > 0) {
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=60');
        return res.status(200).json(buildResponse(cachedDocs![0], true));
      }
      return sendError(res, 404, 'NOT_FOUND', 'No flights found (search unavailable)');
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

    const offers = getOffersFromResult(offerResponse as OfferRequest);
    if (!offers.length) {
      return sendError(res, 404, 'NOT_FOUND', 'No flights found');
    }

    // Find cheapest offer
    const sorted = sortOffersByPrice(offers);
    const cheapest = sorted[0];

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
      offer_json: sharedCompactOfferJson(cheapest),
      offer_expires_at: cheapest.expires_at || '',
      fetched_at: new Date().toISOString(),
    };

    // Check for existing doc to update
    const { data: existing, error: existingError } = await supabase
      .from(TABLES.cachedPrices)
      .select('*')
      .eq('origin', origin)
      .eq('destination_iata', destination)
      .limit(1);
    if (existingError) throw existingError;

    if ((existing ?? []).length > 0) {
      const { error } = await supabase
        .from(TABLES.cachedPrices)
        .update(docData)
        .eq('id', existing![0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(TABLES.cachedPrices).insert(docData);
      if (error) throw error;
    }

    // Build response from the fresh data
    const responseDoc = { ...docData };
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(buildResponse(responseDoc, false));
  } catch (err) {
    logApiError('search', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Search failed');
  }
}
