import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { tripPlanBodySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';
import { checkRateLimit, getClientIp } from '../../utils/rateLimit';
import { cors } from '../_cors.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Strip control characters and excess whitespace from user-supplied strings */
function sanitize(input: string): string {
  return input.replace(/[\r\n\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Rate limit: 10 requests per minute per IP
  const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
  const rl = checkRateLimit(`trip-plan:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  const v = validateRequest(tripPlanBodySchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  const { city, country, duration, style, interests } = v.data;

  // Demo fallback when API key is not configured
  if (!process.env.ANTHROPIC_API_KEY) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const fallback = `${city}${country ? `, ${country}` : ''} — ${duration}-Day ${style.charAt(0).toUpperCase() + style.slice(1)} Itinerary\n\nDay 1 — Arrival & First Impressions\n🌅 Morning: Arrive and check into your hotel\n🏛 Afternoon: Explore the city center and main landmarks\n🍽 Evening: Dinner at a top-rated local restaurant\n💡 Tip: Exchange currency at the airport for convenience\n\nDay 2 — Local Highlights\n☀️ Morning: Visit the most popular attraction\n🚶 Afternoon: Walking tour through historic neighborhoods\n🌙 Evening: Sunset views and nightlife district\n💡 Tip: Public transit is the most efficient way to get around\n\nDay 3 — Hidden Gems & Departure\n🌿 Morning: Off-the-beaten-path neighborhood exploration\n🛍 Afternoon: Local markets and souvenir shopping\n✈️ Evening: Depart ${city}\n💡 Tip: Book airport transfer in advance to save time\n\nPro Tips:\n1. Learn a few basic phrases in the local language\n2. Try street food for the most authentic experience\n3. Keep copies of important documents separate from originals`;
    return res.status(200).end(fallback);
  }

  const safeCity = sanitize(city);
  const safeCountry = sanitize(country || '');
  const safeInterests = interests ? sanitize(interests) : '';

  const styleDesc: Record<string, string> = {
    budget: 'budget-friendly options, hostels, street food, free activities',
    comfort: 'mid-range hotels, good restaurants, balanced mix of activities',
    luxury: 'high-end hotels, fine dining, premium experiences, private tours',
  };

  const prompt = `Create a ${duration}-day travel itinerary for ${safeCity}${safeCountry ? `, ${safeCountry}` : ''}.

Travel style: ${style} (${styleDesc[style] || styleDesc.comfort})
${safeInterests ? `Interests: ${safeInterests}` : ''}

Format as a day-by-day plan. For each day include:
- A theme/title for the day
- Morning, afternoon, and evening activities (2-3 each)
- One restaurant recommendation per meal (name, cuisine, price range)
- One insider tip

End with a "Pro Tips" section with 3-5 practical tips (transport, money, safety, culture).

Keep it practical and specific — real place names, real restaurants. Be concise but informative.
Use emojis sparingly for visual appeal. No markdown headers — use plain text with line breaks.`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text);
      }
    }
    res.end();
  } catch (err: unknown) {
    logApiError('api/ai/trip-plan', err);
    const message = err instanceof Error ? err.message : 'AI generation failed';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.write(`\n\n[Error: ${message}]`);
      res.end();
    }
  }
}
