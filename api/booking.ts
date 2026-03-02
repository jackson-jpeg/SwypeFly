// Consolidated booking API — dispatches on ?action= parameter
// Actions: search, offer, payment-intent, create-order, order, webhook
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Account, Databases, ID, Permission, Role, Query } from 'node-appwrite';
import {
  bookingSearchSchema,
  bookingOfferSchema,
  paymentIntentSchema,
  createOrderSchema,
  bookingOrderSchema,
  validateRequest,
} from '../utils/validation';
import { logApiError } from '../utils/apiLogger';

const DATABASE_ID = 'sogojet';
const STUB_MODE = !process.env.DUFFEL_API_KEY;

// ─── Auth helper ─────────────────────────────────────────────────────────────

function getJwt(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '');
}

async function verifyUser(jwt: string) {
  const userClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
    .setProject(process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '')
    .setJWT(jwt);
  const userAccount = new Account(userClient);
  return userAccount.get();
}

function getServerDatabases() {
  const serverClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
    .setProject(process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '')
    .setKey(process.env.APPWRITE_API_KEY ?? '');
  return new Databases(serverClient);
}

// ─── Stub data for when Duffel/Stripe keys are not configured ───────────────

function stubSearch(origin: string, destination: string, cabinClass: string) {
  const basePrices: Record<string, number> = {
    economy: 287,
    premium_economy: 549,
    business: 1450,
    first: 3200,
  };
  const base = basePrices[cabinClass] || 287;

  return {
    offers: [
      {
        id: 'stub_offer_1',
        total_amount: String(base),
        total_currency: 'USD',
        owner: { name: 'Delta Air Lines', iata_code: 'DL' },
        slices: [
          {
            origin: { iata_code: origin },
            destination: { iata_code: destination },
            duration: 'PT4H35M',
            segments: [
              {
                operating_carrier: { name: 'Delta Air Lines', iata_code: 'DL' },
                operating_carrier_flight_number: '1842',
                departing_at: '2026-04-15T08:15:00',
                arriving_at: '2026-04-15T12:50:00',
                origin: { iata_code: origin },
                destination: { iata_code: destination },
                cabin_class: cabinClass,
              },
            ],
          },
        ],
        passengers: [{ id: 'stub_pas_1', type: 'adult' }],
      },
      {
        id: 'stub_offer_2',
        total_amount: String(base + 43),
        total_currency: 'USD',
        owner: { name: 'United Airlines', iata_code: 'UA' },
        slices: [
          {
            origin: { iata_code: origin },
            destination: { iata_code: destination },
            duration: 'PT5H10M',
            segments: [
              {
                operating_carrier: { name: 'United Airlines', iata_code: 'UA' },
                operating_carrier_flight_number: '923',
                departing_at: '2026-04-15T10:30:00',
                arriving_at: '2026-04-15T15:40:00',
                origin: { iata_code: origin },
                destination: { iata_code: destination },
                cabin_class: cabinClass,
              },
            ],
          },
        ],
        passengers: [{ id: 'stub_pas_1', type: 'adult' }],
      },
      {
        id: 'stub_offer_3',
        total_amount: String(base + 91),
        total_currency: 'USD',
        owner: { name: 'American Airlines', iata_code: 'AA' },
        slices: [
          {
            origin: { iata_code: origin },
            destination: { iata_code: destination },
            duration: 'PT3H55M',
            segments: [
              {
                operating_carrier: { name: 'American Airlines', iata_code: 'AA' },
                operating_carrier_flight_number: '407',
                departing_at: '2026-04-15T14:00:00',
                arriving_at: '2026-04-15T17:55:00',
                origin: { iata_code: origin },
                destination: { iata_code: destination },
                cabin_class: cabinClass,
              },
            ],
          },
        ],
        passengers: [{ id: 'stub_pas_1', type: 'adult' }],
      },
    ],
    slices: [],
    passengers: [{ id: 'stub_pas_1', type: 'adult' }],
  };
}

function stubOffer(offerId: string) {
  return {
    offer: {
      id: offerId,
      total_amount: '287.00',
      total_currency: 'USD',
      available_services: [
        {
          id: 'stub_svc_bag_1',
          type: 'baggage',
          total_amount: '35.00',
          total_currency: 'USD',
          metadata: { type: 'checked', weight_kg: 23, maximum_quantity: 2 },
        },
      ],
    },
    seatMap: null,
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
    const { searchFlights } = await import('../services/duffel');
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
      .slice(0, 20);

    return res.status(200).json({ offers, slices: result.slices, passengers: result.passengers });
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
    const { getOffer, getSeatMap } = await import('../services/duffel');
    const [offer, seatMap] = await Promise.all([
      getOffer(v.data.offerId),
      getSeatMap(v.data.offerId).catch(() => null),
    ]);
    return res.status(200).json({ offer, seatMap });
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

    const { createPaymentIntent } = await import('../services/stripe');
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

    const { getPaymentIntent } = await import('../services/stripe');
    const paymentIntent = await getPaymentIntent(v.data.paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const { createOrder } = await import('../services/duffel');
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
        'booking_passengers',
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

    const { getOrder } = await import('../services/duffel');
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

    const { constructWebhookEvent } = await import('../services/stripe');
    const event = constructWebhookEvent(rawBody, signature);
    const databases = getServerDatabases();

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const bookings = await databases.listDocuments(DATABASE_ID, 'bookings', [
          Query.equal('stripe_payment_intent_id', paymentIntent.id),
          Query.limit(1),
        ]);
        if (bookings.documents.length > 0) {
          await databases.updateDocument(DATABASE_ID, 'bookings', bookings.documents[0].$id, {
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
