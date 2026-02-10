import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGeminiClient, readCache, writeCache } from './_gemini';
import { destinationGuideQuerySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';

const CACHE_TTL = 7 * 86400; // 7 days

interface ItineraryDay {
  day: number;
  activities: string[];
}

interface Restaurant {
  name: string;
  type: string;
  rating: number;
  mapsUrl?: string;
}

interface DestinationGuideResponse {
  itinerary: ItineraryDay[];
  restaurants: Restaurant[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const v = validateRequest(destinationGuideQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { city, country } = v.data;
    const location = `${city}, ${country}`;
    const cacheKey = `destination-guide:${location.toLowerCase()}`;

    // Check cache
    const cached = await readCache<DestinationGuideResponse>(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(cached);
    }

    // Call Gemini with Google Maps grounding
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a travel guide for ${location}. Provide:

1. A 3-day itinerary with 3-4 activities per day. Format each day as "Day X:" followed by activities on separate lines prefixed with "- ".

2. 5 real restaurant recommendations. For each restaurant, provide on a single line: "RESTAURANT: [name] | [cuisine type] | [rating out of 5]"

Be specific with real place names. Keep activity descriptions concise (1 sentence each).`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const text = response.text || '';

    // Extract Maps URLs from grounding metadata
    const mapsUrls = new Map<string, string>();
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      for (const chunk of chunks) {
        const maps = (chunk as Record<string, unknown>).maps as { name?: string; uri?: string } | undefined;
        if (maps?.name && maps?.uri) {
          mapsUrls.set(maps.name.toLowerCase(), maps.uri);
        }
      }
    }

    // Parse itinerary from text
    const itinerary: ItineraryDay[] = [];
    const dayRegex = /Day\s+(\d+)\s*[:\-]/gi;
    const sections = text.split(dayRegex);

    // sections alternates: [preamble, dayNum, content, dayNum, content, ...]
    for (let i = 1; i < sections.length; i += 2) {
      const dayNum = parseInt(sections[i], 10);
      const content = sections[i + 1] || '';
      const activities = content
        .split('\n')
        .map((l) => l.replace(/^[\s\-*]+/, '').replace(/\*\*/g, '').trim())
        .filter((l) => l.length > 5 && !l.toLowerCase().startsWith('restaurant') && !l.toLowerCase().startsWith('day'));

      if (activities.length > 0) {
        itinerary.push({ day: dayNum, activities: activities.slice(0, 4) });
      }
    }

    // Parse restaurants from text
    const restaurants: Restaurant[] = [];
    const restaurantLines = text.split('\n').filter((l) => l.includes('RESTAURANT:'));
    for (const line of restaurantLines.slice(0, 5)) {
      const parts = line.replace(/.*RESTAURANT:\s*/, '').split('|').map((s) => s.trim());
      if (parts.length >= 2) {
        const name = parts[0].replace(/\*\*/g, '');
        const type = parts[1] || 'restaurant';
        const rating = parts[2] ? parseFloat(parts[2]) || 4.0 : 4.0;
        const mapsUrl = mapsUrls.get(name.toLowerCase())
          || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + location)}`;
        restaurants.push({ name, type, rating: Math.min(5, Math.max(1, rating)), mapsUrl });
      }
    }

    // Fallback: if structured parsing didn't find restaurants, try bullet-point format
    if (restaurants.length === 0) {
      const lines = text.split('\n');
      let inRestaurantSection = false;
      for (const line of lines) {
        if (/restaurant/i.test(line) && (line.includes(':') || line.includes('#'))) {
          inRestaurantSection = true;
          continue;
        }
        if (inRestaurantSection && restaurants.length < 5) {
          const cleaned = line.replace(/^[\s\-*\d.]+/, '').replace(/\*\*/g, '').trim();
          if (cleaned.length > 3) {
            const [name, ...rest] = cleaned.split(/[:\-–—]/);
            const trimmedName = name.trim();
            if (trimmedName.length > 2) {
              const mapsUrl = mapsUrls.get(trimmedName.toLowerCase())
                || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedName + ' ' + location)}`;
              restaurants.push({
                name: trimmedName,
                type: rest.join(' ').trim().slice(0, 30) || 'restaurant',
                rating: 4.0,
                mapsUrl,
              });
            }
          }
        }
        if (inRestaurantSection && /^(day|\d+\.|##)/i.test(line.trim())) {
          inRestaurantSection = false;
        }
      }
    }

    const result: DestinationGuideResponse = {
      itinerary: itinerary.slice(0, 3),
      restaurants: restaurants.slice(0, 5),
    };

    await writeCache(cacheKey, result, CACHE_TTL);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/ai/destination-guide', err);
    return res.status(500).json({ itinerary: [], restaurants: [] });
  }
}
