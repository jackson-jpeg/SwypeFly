import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { city, country, duration = 5, style = 'comfort', interests } = req.body ?? {};
  if (!city) return res.status(400).json({ error: 'city required' });

  const styleDesc: Record<string, string> = {
    budget: 'budget-friendly options, hostels, street food, free activities',
    comfort: 'mid-range hotels, good restaurants, balanced mix of activities',
    luxury: 'high-end hotels, fine dining, premium experiences, private tours',
  };

  const prompt = `Create a ${duration}-day travel itinerary for ${city}, ${country || ''}.

Travel style: ${style} (${styleDesc[style] || styleDesc.comfort})
${interests ? `Interests: ${interests}` : ''}

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
    const message = err instanceof Error ? err.message : 'AI generation failed';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.write(`\n\n[Error: ${message}]`);
      res.end();
    }
  }
}
