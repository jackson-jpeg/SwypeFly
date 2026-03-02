import type { VercelRequest, VercelResponse } from '@vercel/node';
import { constructWebhookEvent } from '../../services/stripe';
import { Client, Databases, Query } from 'node-appwrite';
import { logApiError } from '../../utils/apiLogger';

const DATABASE_ID = 'sogojet';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    const rawBody = await getRawBody(req);
    const event = constructWebhookEvent(rawBody, signature);

    const serverClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
      .setProject(
        process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
      )
      .setKey(process.env.APPWRITE_API_KEY ?? '');

    const databases = new Databases(serverClient);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        // Update booking status if we have a matching record
        const bookings = await databases.listDocuments(DATABASE_ID, 'bookings', [
          Query.equal('stripe_payment_intent_id', paymentIntent.id),
          Query.limit(1),
        ]);
        if (bookings.documents.length > 0) {
          await databases.updateDocument(DATABASE_ID, 'bookings', bookings.documents[0].$id, {
            status: 'confirmed',
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const bookings = await databases.listDocuments(DATABASE_ID, 'bookings', [
          Query.equal('stripe_payment_intent_id', paymentIntent.id),
          Query.limit(1),
        ]);
        if (bookings.documents.length > 0) {
          await databases.updateDocument(DATABASE_ID, 'bookings', bookings.documents[0].$id, {
            status: 'failed',
          });
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logApiError('api/webhooks/stripe', err);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
}
