import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { subscribeBodySchema, validateRequest } from '../utils/validation';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';
import { logApiError, logApiInfo } from '../utils/apiLogger';
import { ID, Permission, Role } from 'node-appwrite';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 5 per minute per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`subscribe:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const v = validateRequest(subscribeBodySchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { email, airport } = v.data;

  try {
    // Check if already subscribed
    const existing = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.subscribers,
      [Query.equal('email', email), Query.limit(1)],
    );

    if (existing.documents.length > 0) {
      // Update airport if changed
      const doc = existing.documents[0];
      if (doc.airport !== airport) {
        await serverDatabases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.subscribers,
          doc.$id,
          { airport },
        );
      }
      return res.status(200).json({ status: 'already_subscribed' });
    }

    // Create new subscriber
    await serverDatabases.createDocument(
      DATABASE_ID,
      COLLECTIONS.subscribers,
      ID.unique(),
      {
        email,
        airport,
        subscribed_at: new Date().toISOString(),
        active: true,
      },
      [Permission.read(Role.any())],
    );

    logApiInfo('api/subscribe', `New subscriber: ${email} from ${airport}`);

    // Send welcome email if Resend is configured
    try {
      const { sendWelcomeEmail } = await import('../utils/email');
      await sendWelcomeEmail(email, airport);
    } catch {
      // Email sending is best-effort
    }

    return res.status(201).json({ status: 'subscribed' });
  } catch (err) {
    logApiError('api/subscribe', err);
    return res.status(500).json({ error: 'Subscription failed' });
  }
}
