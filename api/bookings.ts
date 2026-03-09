import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { verifyClerkToken } from '../utils/clerkAuth';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors.js';

export const maxDuration = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyClerkToken(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { documents: bookingDocs } = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.bookings,
      [
        Query.equal('user_id', auth.userId),
        Query.orderDesc('created_at'),
        Query.limit(50),
      ],
    );

    const bookings = await Promise.all(
      bookingDocs.map(async (doc) => {
        const { documents: passengerDocs } = await serverDatabases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.bookingPassengers,
          [Query.equal('booking_id', doc.$id)],
        );

        return {
          id: doc.$id,
          duffelOrderId: doc.duffel_order_id ?? '',
          status: doc.status ?? '',
          totalAmount: doc.total_amount ?? 0,
          currency: doc.currency ?? 'USD',
          passengerCount: doc.passenger_count ?? 0,
          stripePaymentIntentId: doc.stripe_payment_intent_id ?? '',
          createdAt: doc.created_at ?? '',
          destinationCity: doc.destination_city ?? '',
          destinationIata: doc.destination_iata ?? '',
          originIata: doc.origin_iata ?? '',
          departureDate: doc.departure_date ?? '',
          returnDate: doc.return_date ?? '',
          airline: doc.airline ?? '',
          bookingReference: doc.booking_reference ?? '',
          passengers: passengerDocs.map((p) => ({
            givenName: p.given_name ?? '',
            familyName: p.family_name ?? '',
            email: p.email ?? '',
          })),
        };
      }),
    );

    return res.status(200).json({ bookings });
  } catch (err) {
    logApiError('api/bookings', err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}
