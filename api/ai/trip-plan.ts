import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase, readCache, writeCache } from './_gemini';
import { tripPlanBodySchema, validateRequest } from '../../utils/validation';
import { logApiError } from '../../utils/apiLogger';

const CACHE_TTL = 86400; // 24 hours

let _anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

interface TripPlanResponse {
  plan: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth required
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sb = getSupabase();
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const v = validateRequest(tripPlanBodySchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { destination_id, city, country } = v.data;
    const cacheKey = `trip-plan:${user.id}:${destination_id}`;

    // Check cache
    const cached = await readCache<TripPlanResponse>(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Fetch user preferences for personalization
    const { data: prefs } = await sb
      .from('user_preferences')
      .select('traveler_type, budget_level, travel_style')
      .eq('user_id', user.id)
      .single();

    const travelerType = prefs?.traveler_type || 'explorer';
    const budgetLevel = prefs?.budget_level || 'comfortable';
    const travelStyle = prefs?.travel_style || 'balanced';

    // Call Claude Sonnet 4.5
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are an expert travel strategist. Create a concise, actionable trip plan for ${city}, ${country}.

Traveler profile: ${travelStyle} style, ${budgetLevel} budget, ${travelerType} type.

Structure your plan with these sections using markdown headers:
## Logistics
Best routes, transport options, visa tips

## Budget Playbook
Where to splurge, where to save, estimated daily costs

## Cultural Intel
Etiquette tips, local customs, useful phrases

## Neighborhood Vibes
Top 3-4 areas with personality descriptions

## Pro Moves
3 insider tips that most tourists miss

Keep it punchy — no fluff, no generic advice. Be specific to ${city}.`,
        },
      ],
    });

    const plan = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const result: TripPlanResponse = { plan };

    await writeCache(cacheKey, result, CACHE_TTL);

    return res.status(200).json(result);
  } catch (err) {
    logApiError('api/ai/trip-plan', err);
    return res.status(500).json({
      plan: 'Trip planning is temporarily unavailable. Please try again.',
    });
  }
}
