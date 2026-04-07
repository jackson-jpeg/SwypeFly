import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, TABLES } from '../services/supabaseServer';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors';
import { sendSuccess, sendError } from '../utils/apiResponse';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  total_saves: number;
  avg_savings_percent: number;
  score: number;
  top_destination: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET is supported');
  }

  const limit = Math.min(Number(req.query.limit) || 20, 100);

  try {
    // 1. Get all saved trips
    const { data: savedTrips, error: savedErr } = await supabase
      .from(TABLES.savedTrips)
      .select('user_id, destination_id');

    if (savedErr) throw savedErr;
    if (!savedTrips || savedTrips.length === 0) {
      return sendSuccess(res, { leaderboard: [], total: 0 });
    }

    // 2. Collect unique destination IDs and build per-user save counts
    const destIds = new Set<string>();
    const userSaves = new Map<string, string[]>(); // user_id → [destination_id, ...]

    for (const trip of savedTrips) {
      const uid = trip.user_id as string;
      const did = trip.destination_id as string;
      if (!uid || !did) continue;

      destIds.add(did);
      const saves = userSaves.get(uid);
      if (saves) saves.push(did);
      else userSaves.set(uid, [did]);
    }

    // 3. Fetch destination names
    const destIdsArr = [...destIds];
    const destNameMap = new Map<string, string>();

    // Supabase IN filter supports up to ~300 items; batch if needed
    const BATCH = 200;
    for (let i = 0; i < destIdsArr.length; i += BATCH) {
      const batch = destIdsArr.slice(i, i + BATCH);
      const { data: dests } = await supabase
        .from(TABLES.destinations)
        .select('id, city, country')
        .in('id', batch);
      if (dests) {
        for (const d of dests) {
          destNameMap.set(d.id as string, `${d.city}, ${d.country}`);
        }
      }
    }

    // 4. Fetch cached prices to compute savings per destination
    // Get the latest cached price per destination with a usual_price for savings computation
    const savingsMap = new Map<string, number>(); // destination_id → savings_percent

    for (let i = 0; i < destIdsArr.length; i += BATCH) {
      const batch = destIdsArr.slice(i, i + BATCH);
      const { data: prices } = await supabase
        .from(TABLES.cachedPrices)
        .select('destination_iata, price, usual_price')
        .in('destination_iata', batch)
        .not('usual_price', 'is', null)
        .order('fetched_at', { ascending: false });

      if (prices) {
        for (const p of prices) {
          const iata = p.destination_iata as string;
          if (savingsMap.has(iata)) continue; // take most recent
          const price = Number(p.price) || 0;
          const usual = Number(p.usual_price) || 0;
          if (usual > 0 && price < usual) {
            savingsMap.set(iata, Math.round(((usual - price) / usual) * 100));
          }
        }
      }
    }

    // Also try matching by destination ID (cached_prices may use iata_code, not doc ID)
    // Get iata codes for destinations
    const iataMap = new Map<string, string>(); // dest_id → iata
    for (let i = 0; i < destIdsArr.length; i += BATCH) {
      const batch = destIdsArr.slice(i, i + BATCH);
      const { data: dests } = await supabase
        .from(TABLES.destinations)
        .select('id, iata_code')
        .in('id', batch);
      if (dests) {
        for (const d of dests) {
          if (d.iata_code) iataMap.set(d.id as string, d.iata_code as string);
        }
      }
    }

    // 5. Build leaderboard entries
    const entries: LeaderboardEntry[] = [];

    for (const [userId, destIdList] of userSaves) {
      const totalSaves = destIdList.length;

      // Compute avg savings percent across saved destinations
      let savingsSum = 0;
      let savingsCount = 0;
      const destCounts = new Map<string, number>();

      for (const did of destIdList) {
        const name = destNameMap.get(did) || 'Unknown';
        destCounts.set(name, (destCounts.get(name) || 0) + 1);

        // Try iata-based savings lookup
        const iata = iataMap.get(did);
        const pct = iata ? savingsMap.get(iata) : undefined;
        if (pct !== undefined) {
          savingsSum += pct;
          savingsCount++;
        }
      }

      const avgSavings = savingsCount > 0 ? Math.round(savingsSum / savingsCount) : 0;

      // Score: savings_percent * saves (as specified in the roadmap)
      const score = avgSavings * totalSaves;

      // Top destination
      let topDest: string | null = null;
      let topCount = 0;
      for (const [dest, count] of destCounts) {
        if (count > topCount) {
          topCount = count;
          topDest = dest;
        }
      }

      entries.push({
        rank: 0,
        user_id: userId,
        username: `Traveler ${userId.slice(-4).toUpperCase()}`,
        total_saves: totalSaves,
        avg_savings_percent: avgSavings,
        score,
        top_destination: topDest,
      });
    }

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks and trim
    const trimmed = entries.slice(0, limit).map((entry, i) => ({
      ...entry,
      rank: i + 1,
    }));

    return sendSuccess(res, { leaderboard: trimmed, total: entries.length });
  } catch (err) {
    logApiError('leaderboard', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch leaderboard');
  }
}
