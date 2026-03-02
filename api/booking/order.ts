import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Account } from 'node-appwrite';
import { bookingOrderSchema, validateRequest } from '../../utils/validation';
import { getOrder } from '../../services/duffel';
import { logApiError } from '../../utils/apiLogger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
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

    const v = validateRequest(bookingOrderSchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });

    const order = await getOrder(v.data.orderId);

    return res.status(200).json({ order });
  } catch (err) {
    logApiError('api/booking/order', err);
    return res.status(500).json({ error: 'Failed to get order details' });
  }
}
