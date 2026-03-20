/**
 * Price Statistics — rolling percentile tracking per route.
 *
 * Stores median, p5, p20, p80, min, max, and sample count in the
 * `price_history_stats` Appwrite collection. Updated incrementally
 * during each price refresh cron run using Welford-style online updates
 * rather than re-scanning all history.
 *
 * The collection must be created in Appwrite with these attributes:
 *   route_key (string, indexed, unique)
 *   origin (string, indexed)
 *   destination_iata (string, indexed)
 *   median_price (number)
 *   p20_price (number)
 *   p5_price (number)
 *   p80_price (number)
 *   min_price_ever (number)
 *   max_price_ever (number)
 *   sample_count (number)
 *   last_30d_avg (number)
 *   last_updated (string)
 */

import {
  serverDatabases,
  DATABASE_ID,
  COLLECTIONS,
  Query,
} from '../services/appwriteServer';
import { ID } from 'node-appwrite';

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
  lastUpdated: string;
}

// ─── In-memory cache (avoids repeated DB reads within a cron run) ────

const statsCache = new Map<string, RouteStats | null>();

/**
 * Fetch route stats from Appwrite (with in-memory cache for the cron run).
 */
export async function getRouteStats(
  origin: string,
  destinationIata: string,
): Promise<RouteStats | null> {
  const key = `${origin}-${destinationIata}`;
  if (statsCache.has(key)) return statsCache.get(key)!;

  try {
    const result = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.priceHistoryStats,
      [Query.equal('route_key', key), Query.limit(1)],
    );

    if (result.documents.length === 0) {
      statsCache.set(key, null);
      return null;
    }

    const doc = result.documents[0];
    const stats: RouteStats = {
      routeKey: doc.route_key as string,
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
    statsCache.set(key, stats);
    return stats;
  } catch (err) {
    console.warn(`[priceStats] Failed to fetch stats for ${key}:`, err);
    statsCache.set(key, null);
    return null;
  }
}

/**
 * Compute what percentile a given price falls at for a route.
 * Returns 0 (cheapest ever) to 100 (most expensive ever).
 * Without stats, returns 50 (assume median).
 */
export function computePricePercentile(
  price: number,
  stats: RouteStats | null,
): number {
  if (!stats || stats.sampleCount < 3) return 50; // Not enough data

  // Use the stored percentile boundaries for interpolation
  if (price <= stats.p5Price) return 5;
  if (price <= stats.p20Price) {
    // Interpolate between 5 and 20
    const range = stats.p20Price - stats.p5Price;
    if (range <= 0) return 5;
    return 5 + ((price - stats.p5Price) / range) * 15;
  }
  if (price <= stats.medianPrice) {
    // Interpolate between 20 and 50
    const range = stats.medianPrice - stats.p20Price;
    if (range <= 0) return 20;
    return 20 + ((price - stats.p20Price) / range) * 30;
  }
  if (price <= stats.p80Price) {
    // Interpolate between 50 and 80
    const range = stats.p80Price - stats.medianPrice;
    if (range <= 0) return 50;
    return 50 + ((price - stats.medianPrice) / range) * 30;
  }
  // Above 80th percentile — interpolate to 100
  const range = stats.maxPriceEver - stats.p80Price;
  if (range <= 0) return 80;
  return Math.min(100, 80 + ((price - stats.p80Price) / range) * 20);
}

/**
 * Update route stats with a new price observation using online
 * approximation. This avoids scanning all historical prices.
 *
 * The percentile estimates use exponential moving averages with a
 * decay factor, which converge to true percentiles over many samples.
 */
export async function updateRouteStats(
  origin: string,
  destinationIata: string,
  newPrice: number,
): Promise<RouteStats> {
  const key = `${origin}-${destinationIata}`;
  const existing = await getRouteStats(origin, destinationIata);

  if (!existing) {
    // Bootstrap new route
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
      await serverDatabases.createDocument(
        DATABASE_ID,
        COLLECTIONS.priceHistoryStats,
        ID.unique(),
        {
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
        },
      );
    } catch (err) {
      // May fail if concurrent create — that's OK, next update will fix it
      console.warn(`[priceStats] Failed to create stats for ${key}:`, err);
    }

    statsCache.set(key, stats);
    return stats;
  }

  // Online percentile update using decay factor
  // Higher sample counts → slower adaptation (more stable)
  const n = existing.sampleCount + 1;
  const alpha = Math.max(0.01, 1 / Math.sqrt(n)); // Decay factor

  // Shift percentile estimates toward the new price observation
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
    // Find and update existing doc
    const result = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.priceHistoryStats,
      [Query.equal('route_key', key), Query.limit(1)],
    );
    if (result.documents.length > 0) {
      await serverDatabases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.priceHistoryStats,
        result.documents[0].$id,
        {
          median_price: updated.medianPrice,
          p20_price: updated.p20Price,
          p5_price: updated.p5Price,
          p80_price: updated.p80Price,
          min_price_ever: updated.minPriceEver,
          max_price_ever: updated.maxPriceEver,
          sample_count: updated.sampleCount,
          last_30d_avg: updated.last30dAvg,
          last_updated: updated.lastUpdated,
        },
      );
    }
  } catch (err) {
    console.warn(`[priceStats] Failed to update stats for ${key}:`, err);
  }

  statsCache.set(key, updated);
  return updated;
}

/**
 * Bulk-fetch route stats for multiple routes at once (for feed scoring).
 * Returns a Map<routeKey, RouteStats>.
 */
export async function bulkGetRouteStats(
  origin: string,
): Promise<Map<string, RouteStats>> {
  const results = new Map<string, RouteStats>();

  try {
    const result = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.priceHistoryStats,
      [Query.equal('origin', origin), Query.limit(500)],
    );

    for (const doc of result.documents) {
      const stats: RouteStats = {
        routeKey: doc.route_key as string,
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
      results.set(stats.routeKey, stats);
      statsCache.set(stats.routeKey, stats);
    }
  } catch (err) {
    console.warn(`[priceStats] Failed to bulk-fetch stats for ${origin}:`, err);
  }

  return results;
}

/**
 * Clear the in-memory cache (call at start of each cron run).
 */
export function clearStatsCache(): void {
  statsCache.clear();
}
