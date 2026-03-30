// Public API — returns top deals across all airports.
// No auth required. Powers landing page hero, social content, and widget embeds.
// GET /api/top-deals?limit=10&origin=JFK
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { cors } from './_cors.js';
import { checkRateLimit, getClientIp } from '../utils/rateLimit';

const BOOKING_MARKUP_PERCENT = parseFloat(process.env.BOOKING_MARKUP_PERCENT || '3');
function withMarkup(price: number): number {
  return Math.round(price * (1 + BOOKING_MARKUP_PERCENT / 100));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Rate limit: 10 req/min per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`top-deals:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) });
  }

  const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 25);
  const origin = req.query.origin ? String(req.query.origin).toUpperCase() : undefined;

  try {
    let query = supabase
      .from(TABLES.priceCalendar)
      .select('*')
      .gt('deal_score', 50)
      .order('deal_score', { ascending: false })
      .limit(limit * 3); // over-fetch to deduplicate

    if (origin) {
      query = query.eq('origin', origin);
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    const entries = rows ?? [];

    // Deduplicate by destination
    const seen = new Set<string>();
    const deals: Array<Record<string, unknown>> = [];

    for (const doc of entries) {
      const destKey = (doc.destination_iata as string) || (doc.city as string);
      if (seen.has(destKey)) continue;
      seen.add(destKey);

      deals.push({
        id: doc.destination_id || doc.id,
        city: doc.city || 'Unknown',
        country: doc.country || '',
        iata: doc.destination_iata || '',
        origin: doc.origin || '',
        price: doc.price ? withMarkup(doc.price as number) : 0,
        dealScore: doc.deal_score || 0,
        dealTier: doc.deal_tier || 'fair',
        savingsPercent: doc.savings_percent || null,
        usualPrice: doc.usual_price ? withMarkup(doc.usual_price as number) : null,
        isNonstop: doc.is_nonstop || false,
        airline: doc.airline || '',
        departureDate: doc.departure_date || doc.date || '',
        returnDate: doc.return_date || '',
        tripDays: doc.trip_days || 0,
      });

      if (deals.length >= limit) break;
    }

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).json({
      deals,
      total: deals.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[top-deals] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
