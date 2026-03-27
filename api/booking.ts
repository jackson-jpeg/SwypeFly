// Consolidated booking API — dispatches on ?action= parameter
// Actions: search, offer, payment-intent, create-order, order, webhook
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  bookingSearchSchema,
  bookingOfferSchema,
  paymentIntentSchema,
  createOrderSchema,
  bookingOrderSchema,
  hotelSearchSchema,
  hotelQuoteSchema,
  hotelBookSchema,
  validateRequest,
} from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { verifyClerkToken } from '../utils/clerkAuth';
import { supabase, TABLES } from '../services/supabaseServer';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { cors } from './_cors.js';

const STUB_MODE = !process.env.DUFFEL_API_KEY;
const BOOKING_MARKUP_PERCENT = parseFloat(process.env.BOOKING_MARKUP_PERCENT || '3');

// ─── Auth helper ─────────────────────────────────────────────────────────────

function getJwt(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '');
}

async function verifyUser(jwt: string) {
  const result = await verifyClerkToken(`Bearer ${jwt}`);
  if (!result) throw new Error('Invalid token');
  return { $id: result.userId };
}

// ─── Stub data for when Duffel/Stripe keys are not configured ───────────────

// ─── Transform Duffel response to frontend-friendly camelCase format ─────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDuration(iso: string): string {
  // Handle ISO 8601 durations like PT4H35M, P1DT8H20M, P2DT3H
  const dm = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!dm) return iso;
  const days = parseInt(dm[1] ?? '0', 10);
  const hours = parseInt(dm[2] ?? '0', 10);
  const mins = parseInt(dm[3] ?? '0', 10);
  const totalHours = days * 24 + hours;
  return `${totalHours}h ${mins}m`;
}

// Calculate layover duration between two ISO timestamps
function connectionDuration(arrivalIso: string, departureIso: string): string {
  if (!arrivalIso || !departureIso) return '';
  const diffMs = new Date(departureIso).getTime() - new Date(arrivalIso).getTime();
  if (diffMs <= 0) return '';
  const totalMins = Math.round(diffMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${m}m`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformOffer(raw: any, cabinClass = 'economy') {
  const total = parseFloat(raw.total_amount) || 0;
  const tax = Math.round(total * 0.19);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slices = (raw.slices || []).map((s: any) => {
    const firstSeg = s.segments?.[0];
    const lastSeg = s.segments?.length > 1 ? s.segments[s.segments.length - 1] : firstSeg;

    // Map ALL segments (not just first/last) for connection details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segments = (s.segments || []).map((seg: any) => ({
      origin: seg.origin?.iata_code || '',
      originCityName: seg.origin?.city_name || seg.origin?.name || '',
      destination: seg.destination?.iata_code || '',
      destinationCityName: seg.destination?.city_name || seg.destination?.name || '',
      departureTime: seg.departing_at || '',
      arrivalTime: seg.arriving_at || '',
      duration: parseDuration(seg.duration || ''),
      airline: seg.operating_carrier?.name || seg.marketing_carrier?.name || '',
      airlineCode: seg.operating_carrier?.iata_code || seg.marketing_carrier?.iata_code || '',
      flightNumber: seg.operating_carrier_flight_number || seg.marketing_carrier_flight_number || '',
      aircraft: seg.aircraft?.name || '',
      aircraftCode: seg.aircraft?.iata_code || '',
      cabinClass: seg.cabin_class || '',
    }));

    // Calculate connection durations between consecutive segments
    const connections: string[] = [];
    for (let i = 0; i < segments.length - 1; i++) {
      connections.push(connectionDuration(segments[i].arrivalTime, segments[i + 1].departureTime));
    }

    return {
      origin: s.origin?.iata_code ?? '',
      originCityName: s.origin?.city_name || s.origin?.name || '',
      destination: s.destination?.iata_code ?? '',
      destinationCityName: s.destination?.city_name || s.destination?.name || '',
      departureTime: firstSeg?.departing_at ?? '',
      arrivalTime: lastSeg?.arriving_at ?? '',
      duration: parseDuration(s.duration || ''),
      stops: (s.segments?.length || 1) - 1,
      airline: firstSeg?.operating_carrier?.name ?? raw.owner?.name ?? '',
      flightNumber: `${firstSeg?.operating_carrier?.iata_code ?? ''} ${firstSeg?.operating_carrier_flight_number ?? ''}`.trim(),
      aircraft: firstSeg?.aircraft?.name ?? '',
      segments,
      connectionDurations: connections,
    };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const services = (raw.available_services || []).map((svc: any) => ({
    id: svc.id,
    type: svc.type,
    name: svc.metadata?.type ? `${svc.metadata.type} (${svc.metadata.weight_kg}kg)` : svc.type,
    amount: parseFloat(svc.total_amount) || 0,
    currency: svc.total_currency || 'USD',
    metadata: svc.metadata,
  }));

  // Extract baggage info from first passenger
  const firstPassenger = raw.passengers?.[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baggageIncluded = (firstPassenger?.baggages || []).map((b: any) => ({
    type: b.type || '',           // 'carry_on' or 'checked'
    quantity: b.quantity ?? 0,
  }));

  // Extract meal info from first passenger (if available)
  const mealInfo = firstPassenger?.meal
    ? { type: firstPassenger.meal.type || '', description: firstPassenger.meal.description || '' }
    : null;

  // Extract booking conditions (refund/change policies)
  const rawConditions = raw.conditions || {};
  const conditions = {
    refundable: rawConditions.refund_before_departure?.allowed ?? null,
    refundPenalty: rawConditions.refund_before_departure?.penalty_amount
      ? `${rawConditions.refund_before_departure.penalty_currency || 'USD'} ${rawConditions.refund_before_departure.penalty_amount}`
      : null,
    changeable: rawConditions.change_before_departure?.allowed ?? null,
    changePenalty: rawConditions.change_before_departure?.penalty_amount
      ? `${rawConditions.change_before_departure.penalty_currency || 'USD'} ${rawConditions.change_before_departure.penalty_amount}`
      : null,
  };

  // Apply booking markup
  const markupAmount = Math.round(total * (BOOKING_MARKUP_PERCENT / 100));
  const markedUpTotal = total + markupAmount;

  return {
    id: raw.id,
    totalAmount: markedUpTotal,
    totalCurrency: raw.total_currency || 'USD',
    baseAmount: markedUpTotal - tax,
    taxAmount: tax,
    slices,
    cabinClass: raw.slices?.[0]?.segments?.[0]?.cabin_class ?? cabinClass,
    passengers: raw.passengers || [],
    expiresAt: raw.expires_at ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    availableServices: services,
    baggageIncluded,
    mealInfo,
    conditions,
    // Accounting fields (not shown to user)
    _duffelBasePrice: total,
    _markupAmount: markupAmount,
    _markupPercent: BOOKING_MARKUP_PERCENT,
  };
}

function stubSearch(origin: string, destination: string, cabinClass: string, departureDate?: string, priceHint?: number) {
  const cabinMultipliers: Record<string, number> = {
    economy: 1,
    premium_economy: 1.9,
    business: 5,
    first: 11,
  };
  const multiplier = cabinMultipliers[cabinClass] || 1;
  const base = Math.round((priceHint || 287) * multiplier);

  // Use the destination's actual departure date if available, else 2 weeks out
  const baseDepMs = departureDate
    ? new Date(departureDate).getTime()
    : Date.now() + 14 * 86400000;

  const airlines = [
    { name: 'Delta Air Lines', code: 'DL', flight: '1842', depTime: '08:15', arrTime: '12:50', dur: '4h 35m', offset: 0, dayShift: 0, nights: 7 },
    { name: 'United Airlines', code: 'UA', flight: '923', depTime: '10:30', arrTime: '15:40', dur: '5h 10m', offset: 43, dayShift: 3, nights: 10 },
    { name: 'American Airlines', code: 'AA', flight: '407', depTime: '14:00', arrTime: '17:55', dur: '3h 55m', offset: 91, dayShift: 7, nights: 5 },
  ];

  return airlines.map((a) => {
    const depMs = baseDepMs + a.dayShift * 86400000;
    const retMs = depMs + a.nights * 86400000;
    const depDate = new Date(depMs).toISOString().slice(0, 10);
    const retDate = new Date(retMs).toISOString().slice(0, 10);

    return {
      id: `stub_offer_${a.code.toLowerCase()}`,
      totalAmount: base + a.offset,
      totalCurrency: 'USD',
      baseAmount: Math.round((base + a.offset) * 0.81),
      taxAmount: Math.round((base + a.offset) * 0.19),
      slices: [
        {
          origin,
          originCityName: '',
          destination,
          destinationCityName: '',
          departureTime: `${depDate}T${a.depTime}:00`,
          arrivalTime: `${depDate}T${a.arrTime}:00`,
          duration: a.dur,
          stops: 0,
          airline: a.name,
          flightNumber: `${a.code} ${a.flight}`,
          aircraft: 'Boeing 737-900',
          segments: [{
            origin,
            originCityName: '',
            destination,
            destinationCityName: '',
            departureTime: `${depDate}T${a.depTime}:00`,
            arrivalTime: `${depDate}T${a.arrTime}:00`,
            duration: a.dur,
            airline: a.name,
            airlineCode: a.code,
            flightNumber: a.flight,
            aircraft: 'Boeing 737-900',
            aircraftCode: '',
            cabinClass,
          }],
          connectionDurations: [],
        },
        {
          origin: destination,
          originCityName: '',
          destination: origin,
          destinationCityName: '',
          departureTime: `${retDate}T${a.depTime}:00`,
          arrivalTime: `${retDate}T${a.arrTime}:00`,
          duration: a.dur,
          stops: 0,
          airline: a.name,
          flightNumber: `${a.code} ${parseInt(a.flight) + 1}`,
          aircraft: 'Boeing 737-900',
          segments: [{
            origin: destination,
            originCityName: '',
            destination: origin,
            destinationCityName: '',
            departureTime: `${retDate}T${a.depTime}:00`,
            arrivalTime: `${retDate}T${a.arrTime}:00`,
            duration: a.dur,
            airline: a.name,
            airlineCode: a.code,
            flightNumber: `${parseInt(a.flight) + 1}`,
            aircraft: 'Boeing 737-900',
            aircraftCode: '',
            cabinClass,
          }],
          connectionDurations: [],
        },
      ],
      cabinClass,
      passengers: [{ id: 'stub_pas_1', type: 'adult' }],
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      availableServices: [
        { id: 'bag-23kg', type: 'baggage', name: '1 Checked Bag (23kg)', amount: 35, currency: 'USD' },
        { id: 'bag-2x23kg', type: 'baggage', name: '2 Checked Bags (23kg each)', amount: 60, currency: 'USD' },
      ],
      baggageIncluded: [{ type: 'carry_on', quantity: 1 }],
      mealInfo: null,
      conditions: { refundable: false, refundPenalty: null, changeable: true, changePenalty: 'USD 75.00' },
    };
  });
}

// Seeded PRNG for deterministic stub occupancy — same offerId always produces same seat map
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => { h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 13), 0x45d9f3b); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

function stubOffer(offerId: string) {
  const rand = seededRandom(offerId);
  const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const EXIT_ROWS = [14, 25];
  const TOTAL_ROWS = 30;

  const rows = Array.from({ length: TOTAL_ROWS }, (_, i) => {
    const rowNum = i + 1;
    const isExit = EXIT_ROWS.includes(rowNum);
    return {
      rowNumber: rowNum,
      seats: COLUMNS.map((col) => {
        // ~65% occupancy, window/aisle seats fill faster
        const isWindowOrAisle = 'ADF'.includes(col);
        const threshold = isWindowOrAisle ? 0.58 : 0.72;
        const occupied = rand() > threshold;
        return {
          column: col,
          available: !occupied,
          extraLegroom: isExit,
          price: isExit ? 25 : 0,
          currency: 'USD',
          designator: `${rowNum}${col}`,
        };
      }),
    };
  });

  return {
    offer: {
      id: offerId,
      totalAmount: 287,
      totalCurrency: 'USD',
      baseAmount: 232,
      taxAmount: 55,
      slices: [
        {
          origin: 'JFK',
          originCityName: 'New York',
          destination: 'BCN',
          destinationCityName: 'Barcelona',
          departureTime: '2026-04-15T08:15:00',
          arrivalTime: '2026-04-15T12:50:00',
          duration: '4h 35m',
          stops: 0,
          airline: 'Delta Air Lines',
          flightNumber: 'DL 1842',
          aircraft: 'Boeing 737-900',
          segments: [{
            origin: 'JFK',
            originCityName: 'New York',
            destination: 'BCN',
            destinationCityName: 'Barcelona',
            departureTime: '2026-04-15T08:15:00',
            arrivalTime: '2026-04-15T12:50:00',
            duration: '4h 35m',
            airline: 'Delta Air Lines',
            airlineCode: 'DL',
            flightNumber: '1842',
            aircraft: 'Boeing 737-900',
            aircraftCode: '',
            cabinClass: 'economy',
          }],
          connectionDurations: [],
        },
      ],
      cabinClass: 'economy',
      passengers: [{ id: 'stub_pas_1', type: 'adult' }],
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      availableServices: [
        { id: 'bag-23kg', type: 'baggage', name: '1 Checked Bag (23kg)', amount: 35, currency: 'USD' },
        { id: 'bag-2x23kg', type: 'baggage', name: '2 Checked Bags (23kg each)', amount: 60, currency: 'USD' },
      ],
      baggageIncluded: [{ type: 'carry_on', quantity: 1 }],
      mealInfo: null,
      conditions: { refundable: false, refundPenalty: null, changeable: true, changePenalty: 'USD 75.00' },
    },
    seatMap: {
      columns: COLUMNS,
      exitRows: EXIT_ROWS,
      aisleAfterColumns: ['C'],
      rows,
    },
  };
}

function stubPaymentIntent() {
  return {
    clientSecret: 'stub_pi_secret_' + Date.now(),
    paymentIntentId: 'stub_pi_' + Date.now(),
  };
}

function stubCreateOrder() {
  const pnr = 'SGJ' + Math.random().toString(36).substring(2, 8).toUpperCase();
  return {
    orderId: 'stub_booking_' + Date.now(),
    bookingReference: pnr,
    status: 'confirmed' as const,
    passengers: [{ id: 'pax-1', name: 'Demo User' }],
    slices: [
      { origin: 'JFK', destination: 'BCN', departureTime: new Date(Date.now() + 14 * 86400000).toISOString(), arrivalTime: new Date(Date.now() + 14 * 86400000 + 8 * 3600000).toISOString(), duration: '8h 0m', stops: 0, airline: 'Demo Air', flightNumber: 'DA 100', aircraft: '' },
      { origin: 'BCN', destination: 'JFK', departureTime: new Date(Date.now() + 21 * 86400000).toISOString(), arrivalTime: new Date(Date.now() + 21 * 86400000 + 9 * 3600000).toISOString(), duration: '9h 0m', stops: 0, airline: 'Demo Air', flightNumber: 'DA 101', aircraft: '' },
    ],
    totalPaid: 387,
    currency: 'USD',
  };
}

function stubGetOrder(orderId: string) {
  return {
    order: {
      id: orderId,
      status: 'confirmed',
      booking_reference: 'SGJDEMO1',
      total_amount: '287.00',
      total_currency: 'USD',
      created_at: new Date().toISOString(),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformSeatMap(raw: any): { columns: string[]; exitRows: number[]; aisleAfterColumns: string[]; rows: { rowNumber: number; seats: { column: string; available: boolean; extraLegroom: boolean; price: number; currency: string; designator: string; serviceId: string | null }[] }[] } | null {
  if (!raw || !Array.isArray(raw)) return null;
  // Duffel returns an array of seat maps (one per slice); use the first
  const sliceMap = raw[0];
  if (!sliceMap?.cabins?.length) return null;

  const cabin = sliceMap.cabins[0]; // primary cabin
  const allColumns = new Set<string>();
  const exitRows: number[] = [];
  const aisleAfterCols = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of cabin.rows ?? []) {
    const rowNumber = row.sections?.[0]?.elements?.[0]?.designator?.match(/^(\d+)/)?.[1];
    if (!rowNumber) continue;
    const rn = parseInt(rowNumber);
    let isExit = false;
    const seats: { column: string; available: boolean; extraLegroom: boolean; price: number; currency: string; designator: string; serviceId: string | null }[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.sections?.forEach((section: any, sIdx: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const el of section.elements ?? []) {
        if (el.type !== 'seat') continue;
        const col = el.designator?.replace(/^\d+/, '') ?? '';
        allColumns.add(col);
        const hasExitDisclosure = el.disclosures?.includes('exit_row') ?? false;
        if (hasExitDisclosure) isExit = true;
        const seatService = el.available_services?.[0];
        const price = seatService ? parseFloat(seatService.total_amount) || 0 : 0;
        const currency = seatService?.total_currency || 'USD';
        seats.push({
          column: col,
          available: Array.isArray(el.available_services) ? el.available_services.length > 0 : false,
          extraLegroom: hasExitDisclosure || (el.disclosures?.includes('extra_legroom') ?? false),
          price,
          currency,
          designator: el.designator || `${rn}${col}`,
          serviceId: seatService?.id || null,
        });
      }
      // Track aisles: if there's a next section, the last column of this section is before an aisle
      if (sIdx < (row.sections?.length ?? 0) - 1 && seats.length > 0) {
        aisleAfterCols.add(seats[seats.length - 1].column);
      }
    });

    if (isExit) exitRows.push(rn);
    rows.push({ rowNumber: rn, seats });
  }

  const columns = Array.from(allColumns).sort();
  return {
    columns,
    exitRows,
    aisleAfterColumns: Array.from(aisleAfterCols).sort(),
    rows,
  };
}

// ─── Offer expiration helper ─────────────────────────────────────────────────

async function refreshExpiredOffer(
  offerId: string,
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
  cabinClass?: string,
): Promise<{ newOfferId: string; priceChanged: boolean; oldPrice: number; newPrice: number } | null> {
  try {
    const { getOffer, searchFlights } = await import('../services/duffel.js');

    // Try to fetch the offer — if it throws, the offer has expired
    let oldPrice = 0;
    try {
      const existingOffer = await getOffer(offerId);
      // Offer is still valid — no refresh needed
      oldPrice = parseFloat(existingOffer.total_amount) || 0;
      return { newOfferId: offerId, priceChanged: false, oldPrice, newPrice: oldPrice };
    } catch {
      // Offer expired or invalid — proceed with re-search
      console.log(`[booking] Offer ${offerId} expired, attempting re-search: ${origin} → ${destination}`);
    }

    // Re-search with the same parameters
    const result = await searchFlights({
      origin,
      destination,
      departureDate,
      returnDate,
      passengers: [{ type: 'adult' }],
      cabinClass: (cabinClass as 'economy' | 'premium_economy' | 'business' | 'first') || 'economy',
    });

    const offers = result.offers || [];
    if (offers.length === 0) {
      console.warn('[booking] Re-search returned no offers');
      return null;
    }

    // Sort by price and pick the cheapest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offers.sort((a: any, b: any) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
    const bestOffer = offers[0];
    const newPrice = parseFloat(bestOffer.total_amount) || 0;

    return {
      newOfferId: bestOffer.id,
      priceChanged: oldPrice > 0 ? Math.abs(newPrice - oldPrice) > 0.01 : true,
      oldPrice,
      newPrice,
    };
  } catch (err) {
    console.error('[booking] Failed to refresh expired offer:', err);
    return null;
  }
}

// ─── Live action handlers ───────────────────────────────────────────────────

async function handleSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const v = validateRequest(bookingSearchSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  // Guard: origin and destination cannot be the same airport
  if (v.data.origin.toUpperCase() === v.data.destination.toUpperCase()) {
    return res.status(400).json({ error: 'Origin and destination cannot be the same airport' });
  }

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — Duffel API key not configured');
    const offers = stubSearch(v.data.origin, v.data.destination, v.data.cabinClass || 'economy', v.data.departureDate, v.data.priceHint);
    return res.status(200).json({ offers });
  }

  try {
    const { searchFlights } = await import('../services/duffel.js');
    const result = await searchFlights({
      origin: v.data.origin,
      destination: v.data.destination,
      departureDate: v.data.departureDate,
      returnDate: v.data.returnDate,
      passengers: v.data.passengers,
      cabinClass: v.data.cabinClass,
    });

    const offers = (result.offers || [])
      .sort((a: { total_amount: string }, b: { total_amount: string }) =>
        parseFloat(a.total_amount) - parseFloat(b.total_amount),
      )
      .slice(0, 20)
      .map((o: Record<string, unknown>) => transformOffer(o, v.data.cabinClass || 'economy'));

    // Price discrepancy context: compare cheapest offer to the priceHint from feed
    let priceDiscrepancy: {
      tier: 'cheaper' | 'similar' | 'moderate_increase' | 'significant_increase';
      message: string;
      feedPrice: number;
      bookingPrice: number;
      percentDiff: number;
    } | undefined;

    if (v.data.priceHint && offers.length > 0) {
      const cheapest = offers[0].totalAmount;
      const feedPrice = v.data.priceHint;
      const diff = cheapest - feedPrice;
      const percentDiff = Math.round((diff / feedPrice) * 100);

      if (diff <= 0) {
        priceDiscrepancy = {
          tier: 'cheaper',
          message: 'This deal is still available!',
          feedPrice, bookingPrice: cheapest, percentDiff,
        };
      } else if (percentDiff <= 15) {
        priceDiscrepancy = {
          tier: 'similar',
          message: `Price updated to $${cheapest}`,
          feedPrice, bookingPrice: cheapest, percentDiff,
        };
      } else if (percentDiff <= 50) {
        priceDiscrepancy = {
          tier: 'moderate_increase',
          message: `Live fares are ${percentDiff}% higher than when this deal was spotted.`,
          feedPrice, bookingPrice: cheapest, percentDiff,
        };
      } else {
        priceDiscrepancy = {
          tier: 'significant_increase',
          message: `Fares have jumped ${percentDiff}% since this deal was spotted. Prices change fast — these are today's live rates.`,
          feedPrice, bookingPrice: cheapest, percentDiff,
        };
      }
    }

    return res.status(200).json({ offers, priceDiscrepancy });
  } catch (err: any) {
    logApiError('api/booking/search', err);
    const detail = err?.response?.data ?? err?.body ?? err?.message ?? String(err);
    console.error('[booking/search] Duffel error detail:', JSON.stringify(detail, null, 2));
    return res.status(500).json({ error: 'Failed to search flights' });
  }
}

async function handleOffer(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const v = validateRequest(bookingOfferSchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — Duffel API key not configured');
    return res.status(200).json(stubOffer(v.data.offerId));
  }

  try {
    const { getOffer, getSeatMap } = await import('../services/duffel.js');
    const [rawOffer, seatMap] = await Promise.all([
      getOffer(v.data.offerId),
      getSeatMap(v.data.offerId).catch(() => null),
    ]);
    return res.status(200).json({ offer: transformOffer(rawOffer), seatMap: transformSeatMap(seatMap) });
  } catch (err: any) {
    // Check if the offer expired — try to refresh if we have route info in query params
    const origin = String(req.query.origin || '');
    const destination = String(req.query.destination || '');
    const departureDate = String(req.query.departureDate || '');
    const cabinClass = String(req.query.cabinClass || 'economy');

    if (origin && destination && departureDate) {
      console.log(`[booking/offer] Offer ${v.data.offerId} failed, attempting refresh`);
      const refreshed = await refreshExpiredOffer(
        v.data.offerId,
        origin,
        destination,
        departureDate,
        req.query.returnDate ? String(req.query.returnDate) : undefined,
        cabinClass,
      );

      if (refreshed) {
        try {
          const { getOffer: getRefreshedOffer, getSeatMap: getRefreshedSeatMap } = await import('../services/duffel.js');
          const [newRawOffer, newSeatMap] = await Promise.all([
            getRefreshedOffer(refreshed.newOfferId),
            getRefreshedSeatMap(refreshed.newOfferId).catch(() => null),
          ]);
          return res.status(200).json({
            offer: transformOffer(newRawOffer),
            seatMap: transformSeatMap(newSeatMap),
            refreshed: true,
            priceChanged: refreshed.priceChanged,
            oldPrice: refreshed.oldPrice,
            newPrice: refreshed.newPrice,
          });
        } catch (refreshErr) {
          logApiError('api/booking/offer-refresh', refreshErr);
        }
      }
    }

    logApiError('api/booking/offer', err);
    return res.status(500).json({ error: 'Failed to get offer details' });
  }
}

async function handlePaymentIntent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — Stripe/Duffel API keys not configured');
    return res.status(200).json(stubPaymentIntent());
  }

  try {
    const jwt = getJwt(req);
    let userId = 'guest';
    if (jwt) {
      const user = await verifyUser(jwt);
      userId = user.$id;
    }

    const v = validateRequest(paymentIntentSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });

    // Validate that the client-sent amount matches the actual offer price from Duffel
    try {
      const { getOffer } = await import('../services/duffel.js');
      const offer = await getOffer(v.data.offerId);
      const duffelTotal = parseFloat(offer.total_amount) || 0;
      // Apply the same markup the client should have seen
      const expectedTotal = duffelTotal + Math.round(duffelTotal * (BOOKING_MARKUP_PERCENT / 100));
      // Client sends amount in cents; convert to dollars for comparison
      const clientAmount = v.data.amount / 100;
      const discrepancy = Math.abs(clientAmount - expectedTotal) / expectedTotal;
      if (discrepancy > 0.005) {
        console.warn(`[booking/payment-intent] Amount mismatch: client=$${clientAmount}, expected=$${expectedTotal} (${(discrepancy * 100).toFixed(1)}% off)`);
        return res.status(400).json({
          error: 'Payment amount does not match offer price. Please refresh the offer and try again.',
          code: 'AMOUNT_MISMATCH',
          expectedAmount: Math.round(expectedTotal * 100),
          providedAmount: v.data.amount,
        });
      }
      // Verify currency matches the offer
      const offerCurrency = offer.total_currency || 'USD';
      if (v.data.currency.toUpperCase() !== offerCurrency.toUpperCase()) {
        return res.status(400).json({ error: 'Currency mismatch', code: 'CURRENCY_MISMATCH' });
      }
    } catch (offerErr: any) {
      // If the offer can't be fetched (expired, etc.), reject — don't allow blind payment
      console.warn(`[booking/payment-intent] Could not verify offer ${v.data.offerId}: ${offerErr?.message}`);
      return res.status(400).json({
        error: 'Could not verify offer price. The offer may have expired — please search again.',
        code: 'OFFER_VERIFICATION_FAILED',
      });
    }

    // For guest checkout, use email from request body as receipt_email
    const receiptEmail = (req.body as Record<string, unknown>)?.email as string | undefined;

    const { createPaymentIntent } = await import('../services/stripe.js');
    const result = await createPaymentIntent(v.data.amount, v.data.currency, {
      userId,
      offerId: v.data.offerId,
      ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
    });
    return res.status(200).json(result);
  } catch (err: any) {
    logApiError('api/booking/payment-intent', err);
    const detail = err?.message ?? String(err);
    console.error('[booking/payment-intent] Error detail:', detail);
    return res.status(500).json({ error: `Payment intent failed: ${detail}` });
  }
}

async function handleCreateOrder(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — Duffel API key not configured');
    return res.status(200).json(stubCreateOrder());
  }

  try {
    const jwt = getJwt(req);
    let userId = 'guest';
    if (jwt) {
      const user = await verifyUser(jwt);
      userId = user.$id;
    }

    const v = validateRequest(createOrderSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });

    // Verify payment was actually completed before creating a real ticket
    try {
      const { getPaymentIntent } = await import('../services/stripe.js');
      const paymentIntent = await getPaymentIntent(v.data.paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        console.warn(`[booking/create-order] Payment not completed: ${paymentIntent.status}`);
        return res.status(402).json({
          error: 'Payment required. Please complete payment before booking.',
          code: 'PAYMENT_REQUIRED',
        });
      }
    } catch (stripeErr: any) {
      console.warn(`[booking/create-order] Stripe verification failed: ${stripeErr.message}`);
      return res.status(402).json({
        error: 'Could not verify payment. Please try again.',
        code: 'PAYMENT_VERIFICATION_FAILED',
      });
    }

    // Check if the offer has expired before attempting to create the order
    // If origin/destination/departureDate are provided, we can attempt a re-search
    let activeOfferId = v.data.offerId;
    if (v.data.originIata && v.data.destinationIata && v.data.departureDate) {
      const refreshResult = await refreshExpiredOffer(
        v.data.offerId,
        v.data.originIata,
        v.data.destinationIata,
        v.data.departureDate,
        v.data.returnDate,
      );
      if (refreshResult === null) {
        return res.status(410).json({
          error: 'Offer expired and no replacement found. Please search again.',
          code: 'OFFER_EXPIRED',
        });
      }
      if (refreshResult.priceChanged) {
        // Price changed — inform the client so they can confirm
        return res.status(409).json({
          error: 'Offer expired and price has changed',
          code: 'PRICE_CHANGED',
          newOfferId: refreshResult.newOfferId,
          oldPrice: refreshResult.oldPrice,
          newPrice: refreshResult.newPrice,
          priceChanged: true,
        });
      }
      activeOfferId = refreshResult.newOfferId;
    }

    const { createOrder, getOffer } = await import('../services/duffel.js');
    const { refundPaymentIntent } = await import('../services/stripe.js');

    // Re-fetch the offer to get the authoritative currency — don't trust client-sent value
    let offerCheck: any = null;
    try {
      offerCheck = await getOffer(activeOfferId);
    } catch (_e) {
      // Non-fatal: fall back to USD if offer can't be re-fetched at this stage
    }
    // Use offer total from the request body (payment intent may not be confirmed yet)
    const paymentAmount = v.data.amount ? (v.data.amount / 100).toFixed(2) : '0.00';
    const paymentCurrency = offerCheck?.total_currency || 'USD'; // From Duffel, not client

    // Re-verify offer price before creating order — catch last-second price changes
    if (offerCheck && Math.abs(parseFloat(offerCheck.total_amount) - parseFloat(paymentAmount)) > 1) {
      // Price changed since payment was created — refund and tell client
      await refundPaymentIntent(v.data.paymentIntentId);
      console.warn(`[booking/create-order] Price changed: offer=$${offerCheck.total_amount}, payment=$${paymentAmount} — refunded ${v.data.paymentIntentId}`);
      return res.status(409).json({
        error: 'Price changed since payment was initiated. You have been refunded.',
        code: 'PRICE_CHANGED',
        newPrice: offerCheck.total_amount,
      });
    }

    // Wrap entire post-payment section — ANY failure triggers a refund
    try {
      const duffelOrder: any = await createOrder({
        offerId: activeOfferId,
        passengers: v.data.passengers,
        selectedServices: v.data.selectedServices,
        paymentAmount,
        paymentCurrency,
      });

      // Extract flight details for booking record
      const firstSlice = duffelOrder.slices?.[0];
      const firstSeg = firstSlice?.segments?.[0];
      const lastSlice = duffelOrder.slices?.[duffelOrder.slices.length - 1];
      const airlineName = firstSeg?.operating_carrier?.name ?? '';
      const bookingRef = duffelOrder.booking_reference ?? '';

      // Save to Supabase
      const { data: booking, error: bookingInsertErr } = await supabase
        .from(TABLES.bookings)
        .insert({
          user_id: userId,
          duffel_order_id: duffelOrder.id,
          status: 'confirmed',
          total_amount: parseFloat(duffelOrder.total_amount),
          currency: duffelOrder.total_currency,
          passenger_count: v.data.passengers.length,
          stripe_payment_intent_id: v.data.paymentIntentId,
          created_at: new Date().toISOString(),
          destination_city: v.data.destinationCity ?? '',
          destination_iata: v.data.destinationIata ?? (firstSlice?.destination?.iata_code ?? ''),
          origin_iata: v.data.originIata ?? (firstSlice?.origin?.iata_code ?? ''),
          departure_date: v.data.departureDate ?? (firstSeg?.departing_at?.split('T')[0] ?? ''),
          return_date: v.data.returnDate ?? (lastSlice?.segments?.[0]?.departing_at?.split('T')[0] ?? ''),
          airline: airlineName,
          booking_reference: bookingRef,
          customer_email: v.data.passengers?.[0]?.email || null,
        })
        .select()
        .single();
      if (bookingInsertErr) throw new Error(`DB insert failed: ${bookingInsertErr.message}`);

      // Save passengers — non-critical, Duffel order already has passenger data
      for (const passenger of v.data.passengers) {
        const { error: paxErr } = await supabase
          .from(TABLES.bookingPassengers)
          .insert({
            booking_id: booking.id,
            given_name: passenger.given_name,
            family_name: passenger.family_name,
            born_on: passenger.born_on,
            gender: passenger.gender,
            title: passenger.title,
            email: passenger.email,
            phone_number: passenger.phone_number,
          });
        if (paxErr) console.warn(`[booking/create-order] Passenger insert failed (non-critical): ${paxErr.message}`);
        // Don't throw on passenger insert — booking exists, this is supplementary
      }

      // Send confirmation email (non-blocking)
      try {
        const { sendBookingConfirmationEmail } = await import('../utils/email.js');
        const primaryEmail = v.data.passengers[0]?.email ?? '';
        if (primaryEmail) {
          sendBookingConfirmationEmail({
          to: primaryEmail,
          passengerName: `${v.data.passengers[0].given_name} ${v.data.passengers[0].family_name}`,
          bookingReference: bookingRef,
          destinationCity: v.data.destinationCity ?? '',
          originIata: v.data.originIata ?? (firstSlice?.origin?.iata_code ?? ''),
          destinationIata: v.data.destinationIata ?? (firstSlice?.destination?.iata_code ?? ''),
          departureDate: v.data.departureDate ?? (firstSeg?.departing_at?.split('T')[0] ?? ''),
          returnDate: v.data.returnDate ?? (lastSlice?.segments?.[0]?.departing_at?.split('T')[0] ?? ''),
          airline: airlineName,
          totalPaid: parseFloat(duffelOrder.total_amount) || 0,
          currency: duffelOrder.total_currency || 'USD',
        }).catch((emailErr) => console.warn('[booking] Confirmation email failed:', emailErr));
      }
    } catch {
      // Email is non-critical — don't fail the booking
    }

      const responseData = {
        orderId: booking.id,
        bookingReference: bookingRef,
        status: 'confirmed' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        passengers: (duffelOrder.passengers ?? []).map((p: any) => ({
          id: p.id,
          name: `${p.given_name} ${p.family_name}`,
          seatDesignator: p.seat?.designator,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slices: (duffelOrder.slices ?? []).map((s: any) => ({
          origin: s.origin?.iata_code ?? '',
          destination: s.destination?.iata_code ?? '',
          departureTime: s.segments?.[0]?.departing_at ?? '',
          arrivalTime: s.segments?.[0]?.arriving_at ?? '',
          duration: parseDuration(s.duration || ''),
          stops: (s.segments?.length || 1) - 1,
          airline: s.segments?.[0]?.operating_carrier?.name ?? '',
          flightNumber: `${s.segments?.[0]?.operating_carrier?.iata_code ?? ''} ${s.segments?.[0]?.operating_carrier_flight_number ?? ''}`.trim(),
          aircraft: s.segments?.[0]?.aircraft?.name ?? '',
        })),
        totalPaid: parseFloat(duffelOrder.total_amount) || 0,
        currency: duffelOrder.total_currency || 'USD',
      };

      return res.status(200).json(responseData);
    } catch (postPaymentErr: any) {
      // ANY failure after payment verification → refund
      try {
        await refundPaymentIntent(v.data.paymentIntentId);
        console.error(`[booking/create-order] Refunded ${v.data.paymentIntentId} after failure:`, postPaymentErr);
      } catch (refundErr: any) {
        console.error(`[booking/create-order] CRITICAL: Refund FAILED for ${v.data.paymentIntentId}: ${refundErr?.message}`);
        logApiError('api/booking/create-order-refund-failed', refundErr);
      }
      throw postPaymentErr; // re-throw to outer handler
    }
  } catch (err: any) {
    logApiError('api/booking/create-order', err);
    // Duffel SDK errors have `errors` array; Stripe/general errors use `message`
    const duffelErrors = err?.errors ?? err?.response?.data?.errors;
    const detail = duffelErrors
      ? JSON.stringify(duffelErrors)
      : err?.message || err?.statusCode || String(err);
    console.error('[booking/create-order] Error detail:', detail);

    // User-friendly error messages for known Duffel issues
    const firstError = Array.isArray(duffelErrors) ? duffelErrors[0] : null;
    if (firstError?.code === 'insufficient_balance') {
      return res.status(503).json({ error: 'Booking temporarily unavailable — please try again later' });
    }
    if (firstError?.code === 'invalid_phone_number') {
      return res.status(400).json({ error: 'Invalid phone number — use international format like +12125551234' });
    }
    if (firstError?.code === 'not_found' && firstError?.source?.field === 'selected_offers') {
      return res.status(410).json({ error: 'This offer has expired. Please search again.' });
    }
    return res.status(500).json({ error: 'Booking failed — please try again' });
  }
}

async function handleGetOrder(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = getJwt(req);
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — Duffel API key not configured');
    const orderId = String(req.query.orderId || 'stub_ord');
    return res.status(200).json(stubGetOrder(orderId));
  }

  try {
    await verifyUser(jwt);
    const v = validateRequest(bookingOrderSchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { getOrder } = await import('../services/duffel.js');
    const order = await getOrder(v.data.orderId);
    return res.status(200).json({ order });
  } catch (err) {
    logApiError('api/booking/order', err);
    return res.status(500).json({ error: 'Failed to get order details' });
  }
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — webhook ignored, Stripe not configured');
    return res.status(200).json({ received: true });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    const rawBody = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

    const { constructWebhookEvent } = await import('../services/stripe.js');
    const event = constructWebhookEvent(rawBody, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const { data: bookingRows } = await supabase
          .from(TABLES.bookings)
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .limit(1);
        if (bookingRows && bookingRows.length > 0) {
          await supabase
            .from(TABLES.bookings)
            .update({ status: event.type === 'payment_intent.succeeded' ? 'confirmed' : 'failed' })
            .eq('id', bookingRows[0].id);
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logApiError('api/booking/webhook', err);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
}

// ─── Duffel webhook handler ──────────────────────────────────────────────────

const DUFFEL_WEBHOOK_SECRET = (process.env.DUFFEL_WEBHOOK_SECRET || '').trim();

async function handleDuffelWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Reject webhooks if signature verification is not configured
  if (!DUFFEL_WEBHOOK_SECRET) {
    console.error('[booking/duffel-webhook] DUFFEL_WEBHOOK_SECRET not configured — rejecting unsigned webhook');
    return res.status(500).json({ error: 'Webhook signature verification not configured' });
  }

  // Duffel sends a signature in the x-duffel-signature header
  const signature = req.headers['x-duffel-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing x-duffel-signature header' });
  }

  // Read raw body for signature verification
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // Verify webhook signature
  const crypto = await import('crypto');
  const expected = crypto
    .createHmac('sha256', DUFFEL_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  if (signature !== expected) {
    console.warn('[booking/duffel-webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType = event?.type || event?.data?.type || '';

    console.log(`[booking/duffel-webhook] Received event: ${eventType}`);

    switch (eventType) {
      case 'order.created': {
        // Confirm booking if we received a 202 earlier
        const orderId = event?.data?.id;
        if (orderId) {
          const { data: bookingRows } = await supabase
            .from(TABLES.bookings)
            .select('id')
            .eq('duffel_order_id', orderId)
            .limit(1);
          if (bookingRows && bookingRows.length > 0) {
            await supabase
              .from(TABLES.bookings)
              .update({ status: 'confirmed' })
              .eq('id', bookingRows[0].id);
            console.log(`[booking/duffel-webhook] Order ${orderId} confirmed`);
          }
        }
        break;
      }

      case 'order.airline_initiated_change_detected': {
        // Airline changed the schedule — update booking and notify user
        const orderId = event?.data?.order_id || event?.data?.id;
        const changes = event?.data?.changes || [];
        if (orderId) {
          const { data: bookingRows } = await supabase
            .from(TABLES.bookings)
            .select('id, booking_reference')
            .eq('duffel_order_id', orderId)
            .limit(1);
          if (bookingRows && bookingRows.length > 0) {
            const booking = bookingRows[0];
            await supabase
              .from(TABLES.bookings)
              .update({ status: 'schedule_changed' })
              .eq('id', booking.id);
            console.log(`[booking/duffel-webhook] Schedule change detected for order ${orderId}: ${changes.length} changes`);

            // Attempt to send notification email
            try {
              const { data: paxRows } = await supabase
                .from(TABLES.bookingPassengers)
                .select('email')
                .eq('booking_id', booking.id)
                .limit(1);
              if (paxRows && paxRows.length > 0) {
                const email = paxRows[0].email as string;
                if (email) {
                  console.log(`[booking/duffel-webhook] Would notify ${email} about schedule change for ${booking.booking_reference}`);
                  // TODO: Send actual email when email service is configured
                }
              }
            } catch (notifyErr) {
              console.warn('[booking/duffel-webhook] Failed to look up passenger for notification:', notifyErr);
            }
          }
        }
        break;
      }

      case 'order_cancellation.confirmed': {
        const orderId = event?.data?.order_id;
        if (orderId) {
          const { data: bookingRows } = await supabase
            .from(TABLES.bookings)
            .select('id')
            .eq('duffel_order_id', orderId)
            .limit(1);
          if (bookingRows && bookingRows.length > 0) {
            await supabase
              .from(TABLES.bookings)
              .update({ status: 'cancelled' })
              .eq('id', bookingRows[0].id);
            console.log(`[booking/duffel-webhook] Order ${orderId} cancelled`);
          }
        }
        break;
      }

      default:
        console.log(`[booking/duffel-webhook] Unhandled event type: ${eventType}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logApiError('api/booking/duffel-webhook', err);
    return res.status(400).json({ error: 'Webhook processing failed' });
  }
}

// ─── Booking history ─────────────────────────────────────────────────────────

async function handleHistory(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = getJwt(req);
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await verifyUser(jwt);

    const { data: bookingDocs, error: historyErr } = await supabase
      .from(TABLES.bookings)
      .select('*')
      .eq('user_id', user.$id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (historyErr) throw historyErr;

    const bookings = await Promise.all(
      (bookingDocs ?? []).map(async (doc) => {
        let passengers: { givenName: string; familyName: string; email: string }[] = [];
        try {
          const { data: paxDocs } = await supabase
            .from(TABLES.bookingPassengers)
            .select('given_name, family_name, email')
            .eq('booking_id', doc.id);
          passengers = (paxDocs ?? []).map((p) => ({
            givenName: (p.given_name as string) ?? '',
            familyName: (p.family_name as string) ?? '',
            email: (p.email as string) ?? '',
          }));
        } catch {
          // Passengers may not exist yet
        }

        return {
          id: doc.id,
          duffelOrderId: (doc.duffel_order_id as string) ?? '',
          status: (doc.status as string) ?? '',
          totalAmount: (doc.total_amount as number) ?? 0,
          currency: (doc.currency as string) ?? 'USD',
          passengerCount: (doc.passenger_count as number) ?? 0,
          stripePaymentIntentId: (doc.stripe_payment_intent_id as string) ?? '',
          createdAt: (doc.created_at as string) ?? '',
          destinationCity: (doc.destination_city as string) ?? '',
          destinationIata: (doc.destination_iata as string) ?? '',
          originIata: (doc.origin_iata as string) ?? '',
          departureDate: (doc.departure_date as string) ?? '',
          returnDate: (doc.return_date as string) ?? '',
          airline: (doc.airline as string) ?? '',
          bookingReference: (doc.booking_reference as string) ?? '',
          passengers,
        };
      }),
    );

    return res.status(200).json({ bookings });
  } catch (err) {
    logApiError('api/booking/history', err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}

// ─── Hotel search ─────────────────────────────────────────────────────────

function stubHotelSearch() {
  return [
    {
      accommodationId: 'stub_hotel_1',
      name: 'Grand Sunset Resort',
      rating: 4,
      reviewScore: 8.7,
      reviewCount: 1243,
      photoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600',
      cheapestTotalAmount: 156,
      currency: 'USD',
      boardType: 'breakfast_included',
      rooms: [{ id: 'room_1a', name: 'Deluxe King', pricePerNight: 156 }, { id: 'room_1b', name: 'Ocean Suite', pricePerNight: 289 }],
    },
    {
      accommodationId: 'stub_hotel_2',
      name: 'Boutique City Hotel',
      rating: 3,
      reviewScore: 8.2,
      reviewCount: 876,
      photoUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600',
      cheapestTotalAmount: 98,
      currency: 'USD',
      boardType: 'room_only',
      rooms: [{ id: 'room_2a', name: 'Standard Double', pricePerNight: 98 }, { id: 'room_2b', name: 'Junior Suite', pricePerNight: 175 }],
    },
    {
      accommodationId: 'stub_hotel_3',
      name: 'Luxury Palace & Spa',
      rating: 5,
      reviewScore: 9.4,
      reviewCount: 2156,
      photoUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600',
      cheapestTotalAmount: 342,
      currency: 'USD',
      boardType: 'half_board',
      rooms: [{ id: 'room_3a', name: 'Premium King', pricePerNight: 342 }, { id: 'room_3b', name: 'Presidential Suite', pricePerNight: 589 }],
    },
  ];
}

function stubHotelQuote(accommodationId: string, roomId: string) {
  return {
    quoteId: 'stub_quote_' + Date.now(),
    accommodationId,
    roomId,
    totalAmount: 468,
    currency: 'USD',
    checkIn: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 17 * 86400000).toISOString().slice(0, 10),
    cancellationPolicy: 'Free cancellation until 24h before check-in',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    hotelName: 'Grand Sunset Resort',
    roomName: 'Deluxe King',
    pricePerNight: 156,
    nights: 3,
  };
}

function stubHotelBook() {
  const ref = 'SGH' + Math.random().toString(36).substring(2, 8).toUpperCase();
  return {
    bookingId: 'stub_hotel_booking_' + Date.now(),
    confirmationReference: ref,
    status: 'confirmed',
    hotelName: 'Grand Sunset Resort',
    checkIn: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 17 * 86400000).toISOString().slice(0, 10),
    totalAmount: 468,
    currency: 'USD',
  };
}

async function handleHotelSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const v = validateRequest(hotelSearchSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — hotel search returning stubs');
    return res.status(200).json(stubHotelSearch());
  }

  try {
    const { searchStays } = await import('../services/duffel.js');
    const results = await searchStays({
      latitude: v.data.latitude,
      longitude: v.data.longitude,
      radius: 10,
      checkIn: v.data.checkIn,
      checkOut: v.data.checkOut,
      guests: Array.from({ length: v.data.guests ?? 1 }, () => ({ type: 'adult' as const })),
    });
    return res.status(200).json(results);
  } catch (err: any) {
    logApiError('api/booking/hotel-search', err);
    const detail = err?.response?.data ?? err?.body ?? err?.message ?? String(err);
    console.error('[booking/hotel-search] Duffel error detail:', JSON.stringify(detail, null, 2));
    return res.status(500).json({ error: 'Failed to search hotels' });
  }
}

async function handleHotelQuote(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const v = validateRequest(hotelQuoteSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — hotel quote returning stub');
    return res.status(200).json(stubHotelQuote(v.data.accommodationId, v.data.roomId));
  }

  try {
    const { getStaysQuote } = await import('../services/duffel.js');
    const quote = await getStaysQuote({
      accommodationId: v.data.accommodationId,
      roomId: v.data.roomId,
      checkIn: v.data.checkIn,
      checkOut: v.data.checkOut,
    });
    return res.status(200).json(quote);
  } catch (err: any) {
    logApiError('api/booking/hotel-quote', err);
    const detail = err?.response?.data ?? err?.body ?? err?.message ?? String(err);
    console.error('[booking/hotel-quote] Duffel error detail:', JSON.stringify(detail, null, 2));
    return res.status(500).json({ error: 'Failed to get hotel quote' });
  }
}

async function handleHotelBook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = getJwt(req);
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  const v = validateRequest(hotelBookSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — hotel book returning stub');
    return res.status(200).json(stubHotelBook());
  }

  try {
    const user = await verifyUser(jwt);

    // Verify Stripe payment
    const { getPaymentIntent } = await import('../services/stripe.js');
    const paymentIntent = await getPaymentIntent(v.data.paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const { createStaysBooking } = await import('../services/duffel.js');
    const booking = await createStaysBooking({
      quoteId: v.data.quoteId,
      guestName: v.data.guestName,
      guestEmail: v.data.guestEmail,
      paymentAmount: (paymentIntent.amount / 100).toFixed(2),
      paymentCurrency: paymentIntent.currency.toUpperCase(),
    });

    // Save booking record to Supabase
    const { error: hotelInsertErr } = await supabase
      .from(TABLES.bookings)
      .insert({
        user_id: user.$id,
        duffel_order_id: booking.bookingId,
        status: booking.status,
        total_amount: booking.totalAmount,
        currency: booking.currency,
        passenger_count: 1,
        stripe_payment_intent_id: v.data.paymentIntentId,
        created_at: new Date().toISOString(),
        destination_city: booking.hotelName,
        departure_date: booking.checkIn,
        return_date: booking.checkOut,
        booking_reference: booking.confirmationReference,
        booking_type: 'hotel',
      });
    if (hotelInsertErr) throw hotelInsertErr;

    return res.status(200).json(booking);
  } catch (err: any) {
    logApiError('api/booking/hotel-book', err);
    const detail = err?.errors
      ? JSON.stringify(err.errors)
      : err?.message || String(err);
    console.error('[booking/hotel-book] Error detail:', detail);
    return res.status(500).json({ error: `Hotel booking failed: ${detail}` });
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const action = String(req.query.action || '');

  // In production, block real-money actions when Duffel/Stripe aren't configured
  if (STUB_MODE && process.env.NODE_ENV === 'production') {
    if (action === 'payment-intent' || action === 'create-order') {
      return res.status(503).json({ error: 'Booking service not configured' });
    }
  }

  // Rate limit expensive write actions: 5 req/min for booking ops, 15 req/min for search
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const expensiveActions = ['payment-intent', 'create-order', 'hotel-book'];
  if (expensiveActions.includes(action)) {
    const rl = checkRateLimit(`booking-write:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) });
    }
  } else if (action === 'search' || action === 'hotel-search') {
    const rl = checkRateLimit(`booking-search:${ip}`, 15, 60_000);
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) });
    }
  }

  switch (action) {
    case 'search':
      return handleSearch(req, res);
    case 'offer':
      return handleOffer(req, res);
    case 'payment-intent':
      return handlePaymentIntent(req, res);
    case 'create-order':
      return handleCreateOrder(req, res);
    case 'order':
      return handleGetOrder(req, res);
    case 'history':
      return handleHistory(req, res);
    case 'webhook':
      return handleWebhook(req, res);
    case 'duffel-webhook':
      return handleDuffelWebhook(req, res);
    case 'hotel-search':
      return handleHotelSearch(req, res);
    case 'hotel-quote':
      return handleHotelQuote(req, res);
    case 'hotel-book':
      return handleHotelBook(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid action parameter' });
  }
}
