// Consolidated booking API — dispatches on ?action= parameter
// Actions: search, offer, payment-intent, create-order, order, webhook
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Databases, ID, Permission, Role, Query } from 'node-appwrite';
import {
  bookingSearchSchema,
  bookingOfferSchema,
  paymentIntentSchema,
  createOrderSchema,
  bookingOrderSchema,
  validateRequest,
} from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { verifyClerkToken } from '../utils/clerkAuth';
import { COLLECTIONS } from '../services/appwriteServer';

const DATABASE_ID = 'sogojet';
const STUB_MODE = !process.env.DUFFEL_API_KEY;

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

function getServerDatabases() {
  const serverClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
    .setProject(process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '')
    .setKey(process.env.APPWRITE_API_KEY ?? '');
  return new Databases(serverClient);
}

// ─── Stub data for when Duffel/Stripe keys are not configured ───────────────

// ─── Transform Duffel response to frontend-friendly camelCase format ─────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const h = m[1] ?? '0';
  const min = m[2] ?? '0';
  return `${h}h ${min}m`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformOffer(raw: any, cabinClass = 'economy') {
  const total = parseFloat(raw.total_amount) || 0;
  const tax = Math.round(total * 0.19);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slices = (raw.slices || []).map((s: any) => {
    const seg = s.segments?.[0];
    return {
      origin: s.origin?.iata_code ?? '',
      destination: s.destination?.iata_code ?? '',
      departureTime: seg?.departing_at ?? '',
      arrivalTime: seg?.arriving_at ?? '',
      duration: parseDuration(s.duration || ''),
      stops: (s.segments?.length || 1) - 1,
      airline: seg?.operating_carrier?.name ?? raw.owner?.name ?? '',
      flightNumber: `${seg?.operating_carrier?.iata_code ?? ''} ${seg?.operating_carrier_flight_number ?? ''}`.trim(),
      aircraft: seg?.aircraft?.name ?? '',
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
  return {
    id: raw.id,
    totalAmount: total,
    totalCurrency: raw.total_currency || 'USD',
    baseAmount: total - tax,
    taxAmount: tax,
    slices,
    cabinClass: raw.slices?.[0]?.segments?.[0]?.cabin_class ?? cabinClass,
    passengers: raw.passengers || [],
    expiresAt: raw.expires_at ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    availableServices: services,
  };
}

function stubSearch(origin: string, destination: string, cabinClass: string) {
  const basePrices: Record<string, number> = {
    economy: 287,
    premium_economy: 549,
    business: 1450,
    first: 3200,
  };
  const base = basePrices[cabinClass] || 287;
  const depDate = '2026-04-15';
  const retDate = '2026-04-22';

  const airlines = [
    { name: 'Delta Air Lines', code: 'DL', flight: '1842', depTime: '08:15', arrTime: '12:50', dur: '4h 35m', offset: 0 },
    { name: 'United Airlines', code: 'UA', flight: '923', depTime: '10:30', arrTime: '15:40', dur: '5h 10m', offset: 43 },
    { name: 'American Airlines', code: 'AA', flight: '407', depTime: '14:00', arrTime: '17:55', dur: '3h 55m', offset: 91 },
  ];

  return airlines.map((a) => ({
    id: `stub_offer_${a.code.toLowerCase()}`,
    totalAmount: base + a.offset,
    totalCurrency: 'USD',
    baseAmount: Math.round((base + a.offset) * 0.81),
    taxAmount: Math.round((base + a.offset) * 0.19),
    slices: [
      {
        origin,
        destination,
        departureTime: `${depDate}T${a.depTime}:00`,
        arrivalTime: `${depDate}T${a.arrTime}:00`,
        duration: a.dur,
        stops: 0,
        airline: a.name,
        flightNumber: `${a.code} ${a.flight}`,
        aircraft: 'Boeing 737-900',
      },
      {
        origin: destination,
        destination: origin,
        departureTime: `${retDate}T${a.depTime}:00`,
        arrivalTime: `${retDate}T${a.arrTime}:00`,
        duration: a.dur,
        stops: 0,
        airline: a.name,
        flightNumber: `${a.code} ${parseInt(a.flight) + 1}`,
        aircraft: 'Boeing 737-900',
      },
    ],
    cabinClass,
    passengers: [{ id: 'stub_pas_1', type: 'adult' }],
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    availableServices: [
      { id: 'bag-23kg', type: 'baggage', name: '1 Checked Bag (23kg)', amount: 35, currency: 'USD' },
      { id: 'bag-2x23kg', type: 'baggage', name: '2 Checked Bags (23kg each)', amount: 60, currency: 'USD' },
    ],
  }));
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
          destination: 'BCN',
          departureTime: '2026-04-15T08:15:00',
          arrivalTime: '2026-04-15T12:50:00',
          duration: '4h 35m',
          stops: 0,
          airline: 'Delta Air Lines',
          flightNumber: 'DL 1842',
          aircraft: 'Boeing 737-900',
        },
      ],
      cabinClass: 'economy',
      passengers: [{ id: 'stub_pas_1', type: 'adult' }],
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      availableServices: [
        { id: 'bag-23kg', type: 'baggage', name: '1 Checked Bag (23kg)', amount: 35, currency: 'USD' },
        { id: 'bag-2x23kg', type: 'baggage', name: '2 Checked Bags (23kg each)', amount: 60, currency: 'USD' },
      ],
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
    bookingId: 'stub_booking_' + Date.now(),
    duffelOrderId: 'stub_ord_' + Date.now(),
    status: 'confirmed',
    bookingReference: pnr,
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
function transformSeatMap(raw: any): { columns: string[]; exitRows: number[]; aisleAfterColumns: string[]; rows: { rowNumber: number; seats: { column: string; available: boolean; extraLegroom: boolean; price: number; currency: string; designator: string }[] }[] } | null {
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
    const seats: { column: string; available: boolean; extraLegroom: boolean; price: number; currency: string; designator: string }[] = [];

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
          available: el.available_services ? el.available_services.length > 0 : true,
          extraLegroom: hasExitDisclosure || (el.disclosures?.includes('extra_legroom') ?? false),
          price,
          currency,
          designator: el.designator || `${rn}${col}`,
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

// ─── Live action handlers ───────────────────────────────────────────────────

async function handleSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const v = validateRequest(bookingSearchSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — Duffel API key not configured');
    const data = stubSearch(v.data.origin, v.data.destination, v.data.cabinClass || 'economy');
    return res.status(200).json(data);
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

    return res.status(200).json(offers);
  } catch (err) {
    logApiError('api/booking/search', err);
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
  } catch (err) {
    logApiError('api/booking/offer', err);
    return res.status(500).json({ error: 'Failed to get offer details' });
  }
}

async function handlePaymentIntent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = getJwt(req);
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — Stripe/Duffel API keys not configured');
    return res.status(200).json(stubPaymentIntent());
  }

  try {
    const user = await verifyUser(jwt);
    const v = validateRequest(paymentIntentSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { createPaymentIntent } = await import('../services/stripe.js');
    const result = await createPaymentIntent(v.data.amount, v.data.currency, {
      userId: user.$id,
      offerId: v.data.offerId,
    });
    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/booking/payment-intent', err);
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
}

async function handleCreateOrder(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = getJwt(req);
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

  if (STUB_MODE) {
    console.warn('[booking] Stub mode — Duffel API key not configured');
    return res.status(200).json(stubCreateOrder());
  }

  try {
    const user = await verifyUser(jwt);
    const v = validateRequest(createOrderSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { getPaymentIntent } = await import('../services/stripe.js');
    const paymentIntent = await getPaymentIntent(v.data.paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const { createOrder } = await import('../services/duffel.js');
    const duffelOrder = await createOrder({
      offerId: v.data.offerId,
      passengers: v.data.passengers,
      selectedServices: v.data.selectedServices,
      paymentAmount: (paymentIntent.amount / 100).toFixed(2),
      paymentCurrency: paymentIntent.currency.toUpperCase(),
    });

    const databases = getServerDatabases();

    const booking = await databases.createDocument(
      DATABASE_ID,
      'bookings',
      ID.unique(),
      {
        user_id: user.$id,
        duffel_order_id: duffelOrder.id,
        status: 'confirmed',
        total_amount: parseFloat(duffelOrder.total_amount),
        currency: duffelOrder.total_currency,
        passenger_count: v.data.passengers.length,
        stripe_payment_intent_id: v.data.paymentIntentId,
        created_at: new Date().toISOString(),
      },
      [Permission.read(Role.user(user.$id)), Permission.delete(Role.user(user.$id))],
    );

    for (const passenger of v.data.passengers) {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.bookingPassengers,
        ID.unique(),
        {
          booking_id: booking.$id,
          given_name: passenger.given_name,
          family_name: passenger.family_name,
          born_on: passenger.born_on,
          gender: passenger.gender,
          title: passenger.title,
          email: passenger.email,
          phone_number: passenger.phone_number,
        },
        [Permission.read(Role.user(user.$id))],
      );
    }

    return res.status(200).json({
      bookingId: booking.$id,
      duffelOrderId: duffelOrder.id,
      status: 'confirmed',
      bookingReference: duffelOrder.booking_reference,
    });
  } catch (err) {
    logApiError('api/booking/create-order', err);
    return res.status(500).json({ error: 'Failed to create booking' });
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
    const databases = getServerDatabases();

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const bookings = await databases.listDocuments(DATABASE_ID, COLLECTIONS.bookings, [
          Query.equal('stripe_payment_intent_id', paymentIntent.id),
          Query.limit(1),
        ]);
        if (bookings.documents.length > 0) {
          await databases.updateDocument(DATABASE_ID, COLLECTIONS.bookings, bookings.documents[0].$id, {
            status: event.type === 'payment_intent.succeeded' ? 'confirmed' : 'failed',
          });
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

// ─── Router ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '');

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
    case 'webhook':
      return handleWebhook(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid action parameter' });
  }
}
