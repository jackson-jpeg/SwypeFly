import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGeminiClient, readCache, writeCache } from './_gemini';
import { priceCheckQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';

const CACHE_TTL = 1800; // 30 minutes

interface PriceCheckResponse {
  price: number;
  source: string;
  url: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const v = validateRequest(priceCheckQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { origin, destination } = v.data;
    const cacheKey = `price-check:${origin}:${destination}`;

    // Check cache
    const cached = await readCache<PriceCheckResponse>(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
      return res.status(200).json(cached);
    }

    // Call Gemini with Google Search grounding
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Search for the current cheapest round-trip flight price from ${origin} to ${destination} for the next month. Return ONLY a JSON object with "price" (number, in USD), "source" (string, name of booking site), and "url" (string, direct booking link if available).`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT' as const,
          properties: {
            price: { type: 'NUMBER' as const },
            source: { type: 'STRING' as const },
            url: { type: 'STRING' as const },
          },
        },
      },
    });

    let data: { price?: number; source?: string; url?: string } = {};
    try {
      data = JSON.parse(response.text || '{}');
    } catch {
      data = {};
    }

    // Fallback: grab grounding source URL if model didn't return one
    if (!data.url) {
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        for (const chunk of chunks) {
          const web = (chunk as Record<string, unknown>).web as { title?: string; uri?: string } | undefined;
          if (web?.uri) {
            data.url = web.uri;
            data.source = data.source || web.title || 'Booking Site';
            break;
          }
        }
      }
    }

    const fallbackUrl = `https://www.google.com/travel/flights?q=Flights+from+${origin}+to+${destination}`;

    const result: PriceCheckResponse = {
      price: data.price && data.price > 0 ? Math.round(data.price) : 0,
      source: data.source || 'Google Flights',
      url: data.url || fallbackUrl,
    };

    if (result.price > 0) {
      await writeCache(cacheKey, result, CACHE_TTL);
    }

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/ai/price-check', err);
    return res.status(500).json({
      price: 0,
      source: 'Unavailable',
      url: `https://www.google.com/travel/flights`,
    });
  }
}
