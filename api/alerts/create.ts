import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Account, Databases, Query, ID } from 'node-appwrite';
import { priceAlertBodySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';
import { DATABASE_ID, COLLECTIONS } from '../../services/appwriteServer';
import { checkRateLimit, getClientIp } from '../../utils/rateLimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Rate limit: 20 alerts per minute per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`alerts-create:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  // Require auth — derive user_id from JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jwt = authHeader.replace('Bearer ', '');

  let userId: string;
  try {
    const userClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
      .setProject(
        process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
      )
      .setJWT(jwt);

    const userAccount = new Account(userClient);
    const user = await userAccount.get();
    userId = user.$id;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Validate input
  const v = validateRequest(priceAlertBodySchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { destination_id, target_price, email } = v.data;

  try {
    // Use admin client for database writes
    const adminClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
      .setProject(
        process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
      )
      .setKey(process.env.APPWRITE_API_KEY ?? '');

    const db = new Databases(adminClient);

    // Check for existing alert
    const existing = await db.listDocuments(DATABASE_ID, COLLECTIONS.priceAlerts, [
      Query.equal('user_id', userId),
      Query.equal('destination_id', destination_id),
      Query.equal('is_active', true),
    ]);

    if (existing.total > 0) {
      // Update existing alert
      const doc = existing.documents[0];
      const updated = await db.updateDocument(DATABASE_ID, COLLECTIONS.priceAlerts, doc.$id, {
        target_price: target_price,
      });
      return res.json({ alert: updated, updated: true });
    }

    const alert = await db.createDocument(DATABASE_ID, COLLECTIONS.priceAlerts, ID.unique(), {
      user_id: userId,
      email: email || null,
      destination_id,
      target_price,
      is_active: true,
      created_at: new Date().toISOString(),
      triggered_at: null,
    });

    res.json({ alert, created: true });
  } catch (err: unknown) {
    logApiError('api/alerts/create', err);
    const message = err instanceof Error ? err.message : 'Failed to create alert';
    res.status(500).json({ error: message });
  }
}
