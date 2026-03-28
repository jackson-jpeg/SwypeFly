/**
 * Route price statistics — tracks median, percentiles, min/max per route.
 * Uses Supabase `price_history_stats` table (was Appwrite — migrated for
 * consistency with the rest of the data pipeline).
 *
 * Stats are updated incrementally using online percentile estimation
 * (no need to store every historical price — just the running stats).
 */

import { supabase, TABLES } from '../services/supabaseServer';

// ─── Types ───────────────────────────────────────────────────────────

export interface RouteStats {
  routeKey: string;
  origin: string;
  destinationIata: string;
  medianPrice: number;
  p20Price: number;
  p5Price: number;
  p80Price: number;
  minPriceEver: number;
  maxPriceEver: number;
  sampleCount: number;
  last30dAvg: number;
  lastUpdated?: string;
}

// ─── In-memory cache (per lambda invocation) ─────────────────────────

const statsCache = new Map<string, RouteStats | null>();

function docToStats(doc: Record<string, unknown>): RouteStats {
  return {
    routeKey: (doc.route_key as string) || `${doc.origin}-${doc.destination_iata}`,
    origin: doc.origin as string,
    destinationIata: doc.destination_iata as string,
    medianPrice: doc.median_price as number,
    p20Price: doc.p20_price as number,
    p5Price: doc.p5_price as number,
    p80Price: doc.p80_price as number,
    minPriceEver: doc.min_price_ever as number,
    maxPriceEver: doc.max_price_ever as number,
    sampleCount: doc.sample_count as number,
    last30dAvg: doc.last_30d_avg as number,
    lastUpdated: doc.last_updated as string,
  };
}

// ─── Get stats for a single route ────────────────────────────────────

export async function getRouteStats(
  origin: string,
  destinationIata: string,
): Promise<RouteStats | null> {
  const key = `${origin}-${destinationIata}`;
  if (statsCache.has(key)) return statsCache.get(key)!;

  try {
    const { data, error } = await supabase
      .from(TABLES.priceHistoryStats)
      .select('*')
      .eq('route_key', key)
      .limit(1);
    if (error) throw error;

    if (!data || data.length === 0) {
      statsCache.set(key, null);
      return null;
    }

    const stats = docToStats(data[0]);
    statsCache.set(key, stats);
    return stats;
  } catch (err) {
    console.warn(`[priceStats] Failed to fetch stats for ${key}:`, err);
    statsCache.set(key, null);
    return null;
  }
}

// ─── Compute price percentile ────────────────────────────────────────

/**
 * Given a price and route stats, return a percentile (0–100).
 * Without stats, returns 50 (assume median).
 */
export function computePricePercentile(price: number, stats: RouteStats | null): number {
  if (!stats || stats.sampleCount < 1) return 50;

  // Simple piecewise linear interpolation between known percentile anchors
  if (price <= stats.p5Price) return 5;
  if (price <= stats.p20Price) {
    const range = stats.p20Price - stats.p5Price;
    if (range <= 0) return 12;
    return 5 + ((price - stats.p5Price) / range) * 15;
  }
  if (price <= stats.medianPrice) {
    const range = stats.medianPrice - stats.p20Price;
    if (range <= 0) return 35;
    return 20 + ((price - stats.p20Price) / range) * 30;
  }
  if (price <= stats.p80Price) {
    const range = stats.p80Price - stats.medianPrice;
    if (range <= 0) return 65;
    return 50 + ((price - stats.medianPrice) / range) * 30;
  }
  return Math.min(100, 80 + ((price - stats.p80Price) / (stats.maxPriceEver - stats.p80Price || 1)) * 20);
}

// ─── Update stats with a new price observation ──────────────────────

export async function updateRouteStats(
  origin: string,
  destinationIata: string,
  newPrice: number,
): Promise<RouteStats> {
  const key = `${origin}-${destinationIata}`;
  const existing = await getRouteStats(origin, destinationIata);

  if (!existing) {
    // Bootstrap new route — first price observation
    const stats: RouteStats = {
      routeKey: key,
      origin,
      destinationIata,
      medianPrice: newPrice,
      p20Price: newPrice,
      p5Price: newPrice,
      p80Price: newPrice,
      minPriceEver: newPrice,
      maxPriceEver: newPrice,
      sampleCount: 1,
      last30dAvg: newPrice,
      lastUpdated: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from(TABLES.priceHistoryStats)
        .upsert({
          route_key: key,
          origin,
          destination_iata: destinationIata,
          median_price: newPrice,
          p20_price: newPrice,
          p5_price: newPrice,
          p80_price: newPrice,
          min_price_ever: newPrice,
          max_price_ever: newPrice,
          sample_count: 1,
          last_30d_avg: newPrice,
          last_updated: stats.lastUpdated,
        }, { onConflict: 'route_key' });
      if (error) throw error;
    } catch (err) {
      console.warn(`[priceStats] Failed to create stats for ${key}:`, err);
    }

    statsCache.set(key, stats);
    return stats;
  }

  // Online percentile update using decay factor
  // Higher sample counts → slower adaptation (more stable)
  const n = existing.sampleCount + 1;
  const alpha = Math.max(0.01, 1 / Math.sqrt(n));

  const nudge = (current: number, target: number) =>
    Math.round(current + alpha * (target - current));

  const updated: RouteStats = {
    routeKey: key,
    origin,
    destinationIata,
    medianPrice: nudge(existing.medianPrice, newPrice),
    p20Price: newPrice < existing.medianPrice
      ? nudge(existing.p20Price, newPrice)
      : existing.p20Price,
    p5Price: newPrice < existing.p20Price
      ? nudge(existing.p5Price, newPrice)
      : existing.p5Price,
    p80Price: newPrice > existing.medianPrice
      ? nudge(existing.p80Price, newPrice)
      : existing.p80Price,
    minPriceEver: Math.min(existing.minPriceEver, newPrice),
    maxPriceEver: Math.max(existing.maxPriceEver, newPrice),
    sampleCount: n,
    last30dAvg: nudge(existing.last30dAvg, newPrice),
    lastUpdated: new Date().toISOString(),
  };

  // Ensure ordering invariant: p5 <= p20 <= median <= p80
  if (updated.p20Price > updated.medianPrice) updated.p20Price = updated.medianPrice;
  if (updated.p5Price > updated.p20Price) updated.p5Price = updated.p20Price;
  if (updated.p80Price < updated.medianPrice) updated.p80Price = updated.medianPrice;

  try {
    const { error } = await supabase
      .from(TABLES.priceHistoryStats)
      .update({
        median_price: updated.medianPrice,
        p20_price: updated.p20Price,
        p5_price: updated.p5Price,
        p80_price: updated.p80Price,
        min_price_ever: updated.minPriceEver,
        max_price_ever: updated.maxPriceEver,
        sample_count: updated.sampleCount,
        last_30d_avg: updated.last30dAvg,
        last_updated: updated.lastUpdated,
      })
      .eq('route_key', key);
    if (error) throw error;
  } catch (err) {
    console.warn(`[priceStats] Failed to update stats for ${key}:`, err);
  }

  statsCache.set(key, updated);
  return updated;
}

// ─── Bulk fetch for feed scoring ─────────────────────────────────────

export async function bulkGetRouteStats(
  origin: string,
): Promise<Map<string, RouteStats>> {
  const results = new Map<string, RouteStats>();

  try {
    const { data, error } = await supabase
      .from(TABLES.priceHistoryStats)
      .select('*')
      .eq('origin', origin)
      .limit(500);
    if (error) throw error;

    for (const doc of data ?? []) {
      const stats = docToStats(doc);
      results.set(stats.routeKey, stats);
      statsCache.set(stats.routeKey, stats);
    }
  } catch (err) {
    console.warn(`[priceStats] Failed to bulk-fetch stats for ${origin}:`, err);
  }

  return results;
}

// ─── Clear cache ─────────────────────────────────────────────────────

export function clearStatsCache(): void {
  statsCache.clear();
}
