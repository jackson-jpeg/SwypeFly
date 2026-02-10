import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGeminiClient, readCache, writeCache } from './_gemini';
import { liveUpdatesQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';

const CACHE_TTL = 3600; // 1 hour

interface LiveUpdatesResponse {
  summary: string;
  sources: { title: string; uri: string }[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const v = validateRequest(liveUpdatesQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { city, country } = v.data;
    const location = `${city}, ${country}`;
    const cacheKey = `live-updates:${location.toLowerCase()}`;

    // Check cache
    const cached = await readCache<LiveUpdatesResponse>(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(cached);
    }

    // Call Gemini with Google Search grounding
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `What is the current travel situation in ${location}? Include current weather conditions and any major news, advisories, or events relevant to tourists. 2-3 sentences max.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const summary = response.text || 'Live data unavailable.';
    const sources: { title: string; uri: string }[] = [];

    // Extract grounding sources
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      for (const chunk of chunks) {
        const web = (chunk as Record<string, unknown>).web as { title?: string; uri?: string } | undefined;
        if (web?.uri) {
          sources.push({
            title: web.title || 'Source',
            uri: web.uri,
          });
        }
      }
    }

    const result: LiveUpdatesResponse = {
      summary,
      sources: sources.slice(0, 3),
    };

    // Write to cache
    await writeCache(cacheKey, result, CACHE_TTL);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/ai/live-updates', err);
    return res.status(500).json({
      summary: 'Live data unavailable.',
      sources: [],
    });
  }
}
