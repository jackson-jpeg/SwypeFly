import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Account, Databases, ID, Permission, Role } from 'node-appwrite';
import { createOrderSchema, validateRequest } from '../../utils/validation';
import { createOrder } from '../../services/duffel';
import { getPaymentIntent } from '../../services/stripe';
import { logApiError } from '../../utils/apiLogger';

const DATABASE_ID = 'sogojet';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jwt = authHeader.replace('Bearer ', '');

  try {
    // Verify JWT
    const userClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
      .setProject(
        process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
      )
      .setJWT(jwt);

    const userAccount = new Account(userClient);
    const user = await userAccount.get();
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const v = validateRequest(createOrderSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });

    // Verify payment was successful
    const paymentIntent = await getPaymentIntent(v.data.paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Create order via Duffel
    const duffelOrder = await createOrder({
      offerId: v.data.offerId,
      passengers: v.data.passengers,
      selectedServices: v.data.selectedServices,
      paymentAmount: (paymentIntent.amount / 100).toFixed(2),
      paymentCurrency: paymentIntent.currency.toUpperCase(),
    });

    // Store booking in Appwrite
    const serverClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
      .setProject(
        process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
      )
      .setKey(process.env.APPWRITE_API_KEY ?? '');

    const databases = new Databases(serverClient);

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

    // Store passenger details
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
