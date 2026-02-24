import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';
import { ID } from 'node-appwrite';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { user_id, destination_id, target_price, email } = req.body ?? {};
  if (!destination_id || !target_price) {
    return res.status(400).json({ error: 'destination_id and target_price required' });
  }

  try {
    // Check for existing alert
    const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.priceAlerts, [
      ...(user_id ? [Query.equal('user_id', user_id)] : []),
      ...(email ? [Query.equal('email', email)] : []),
      Query.equal('destination_id', destination_id),
      Query.equal('is_active', true),
    ]);

    if (existing.total > 0) {
      // Update existing alert
      const doc = existing.documents[0];
      const updated = await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.priceAlerts, doc.$id, {
        target_price: Number(target_price),
      });
      return res.json({ alert: updated, updated: true });
    }

    const alert = await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.priceAlerts, ID.unique(), {
      user_id: user_id || null,
      email: email || null,
      destination_id,
      target_price: Number(target_price),
      is_active: true,
      created_at: new Date().toISOString(),
      triggered_at: null,
    });

    res.json({ alert, created: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create alert';
    res.status(500).json({ error: message });
  }
}
