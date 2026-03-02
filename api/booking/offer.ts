import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bookingOfferSchema, validateRequest } from '../../utils/validation';
import { getOffer, getSeatMap } from '../../services/duffel';
import { logApiError } from '../../utils/apiLogger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const v = validateRequest(bookingOfferSchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });

  try {
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
