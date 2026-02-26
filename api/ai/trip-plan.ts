import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { tripPlanBodySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';
import { checkRateLimit, getClientIp } from '../../utils/rateLimit';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Strip control characters and excess whitespace from user-supplied strings */
function sanitize(input: string): string {
  return input.replace(/[\r\n\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      model: 'claude-sonnet-4-20250514',
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
