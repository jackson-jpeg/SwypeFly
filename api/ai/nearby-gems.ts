import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGeminiClient, readCache, writeCache } from './_gemini';
import { nearbyGemsQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';

const CACHE_TTL = 86400; // 24 hours

interface Place {
  name: string;
  description: string;
  mapsUrl?: string;
}

interface NearbyGemsResponse {
  places: Place[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const v = validateRequest(nearbyGemsQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { city, country, lat, lng } = v.data;
    const location = `${city}, ${country}`;
    const cacheKey = `nearby-gems:${location.toLowerCase()}`;

    // Check cache
    const cached = await readCache<NearbyGemsResponse>(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
      return res.status(200).json(cached);
    }

    // Call Gemini with Google Maps grounding
    const ai = getGeminiClient();
    const toolConfig = lat != null && lng != null
      ? { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
      : undefined;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Find 5 top-rated hidden gems or must-visit spots in ${location}. Focus on places with unique local character that tourists often miss — cafes, viewpoints, markets, parks, or cultural spots. For each place, give the name and a one-sentence description.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig,
      },
    });

    const text = response.text || '';

    // Extract places from grounding metadata
    const places: Place[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (chunks) {
      for (const chunk of chunks) {
        const maps = (chunk as Record<string, unknown>).maps as { name?: string; uri?: string } | undefined;
        if (maps?.name) {
          places.push({
            name: maps.name,
            description: '',
            mapsUrl: maps.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(maps.name + ' ' + location)}`,
          });
        }
      }
    }

    // If grounding didn't provide enough places, parse from text
    if (places.length === 0 && text) {
      const lines = text.split('\n').filter((l) => l.trim());
      for (const line of lines.slice(0, 5)) {
        const cleaned = line.replace(/^\d+\.\s*\**/, '').replace(/\*\*/g, '').trim();
        if (cleaned.length > 3) {
          const [name, ...rest] = cleaned.split(/[:\-–—]/);
          places.push({
            name: name.trim(),
            description: rest.join(' ').trim(),
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name.trim() + ' ' + location)}`,
          });
        }
      }
    }

    const result: NearbyGemsResponse = { places: places.slice(0, 5) };

    await writeCache(cacheKey, result, CACHE_TTL);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/ai/nearby-gems', err);
    return res.status(500).json({ places: [] });
  }
}
