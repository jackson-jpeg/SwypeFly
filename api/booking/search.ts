import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bookingSearchSchema, validateRequest } from '../../utils/validation';
import { searchFlights } from '../../services/duffel';
import { logApiError } from '../../utils/apiLogger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const v = validateRequest(bookingSearchSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  try {
    const result = await searchFlights({
      origin: v.data.origin,
      destination: v.data.destination,
      departureDate: v.data.departureDate,
      returnDate: v.data.returnDate,
      passengers: v.data.passengers,
      cabinClass: v.data.cabinClass,
    });

    // Sort offers by total amount ascending
    const offers = (result.offers || [])
      .sort((a: { total_amount: string }, b: { total_amount: string }) =>
        parseFloat(a.total_amount) - parseFloat(b.total_amount),
      )
      .slice(0, 20); // Return top 20 cheapest

    return res.status(200).json({
      offers,
      slices: result.slices,
      passengers: result.passengers,
    });
  } catch (err) {
    logApiError('api/booking/search', err);
    return res.status(500).json({ error: 'Failed to search flights' });
  }
}
