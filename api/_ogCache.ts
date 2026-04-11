import { createHash } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CacheEntry {
  buffer: Buffer;
  etag: string;
  createdAt: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 50;
const TTL_MS = 60 * 60 * 1000; // 1 hour

function evict() {
  if (cache.size <= MAX_ENTRIES) return;
  let oldest: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of cache) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldest = key;
    }
  }
  if (oldest) cache.delete(oldest);
}

export function getCacheKey(params: Record<string, unknown>): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return createHash('md5').update(sorted).digest('hex');
}

export function tryCacheHit(
  req: VercelRequest,
  res: VercelResponse,
  cacheKey: string,
): boolean {
  const entry = cache.get(cacheKey);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(cacheKey);
    return false;
  }

  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch === entry.etag) {
    res.status(304).end();
    return true;
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('ETag', entry.etag);
  res.setHeader(
    'Cache-Control',
    'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  );
  res.status(200).send(entry.buffer);
  return true;
}

export function cacheAndSend(
  res: VercelResponse,
  cacheKey: string,
  buffer: Buffer,
  maxAge = 3600,
): void {
  const etag = `"${createHash('md5').update(buffer).digest('hex')}"`;
  cache.set(cacheKey, { buffer, etag, createdAt: Date.now() });
  evict();

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('ETag', etag);
  res.setHeader(
    'Cache-Control',
    `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
  );
  res.status(200).send(buffer);
}

export const OG_COLORS = {
  bg: '#0A0806',
  surface: '#151210',
  yellow: '#F7E8A0',
  white: '#FFF8F0',
  muted: '#8B7D6B',
  green: '#A8C4B8',
  dealAmazing: '#4ADE80',
  dealGreat: '#FBBF24',
  dealGood: '#60A5FA',
  border: '#2A231A',
} as const;

export const DEAL_TIER_COLORS: Record<string, string> = {
  amazing: OG_COLORS.dealAmazing,
  great: OG_COLORS.dealGreat,
  good: OG_COLORS.dealGood,
  fair: OG_COLORS.muted,
};

export const DEAL_TIER_LABELS: Record<string, string> = {
  amazing: 'INCREDIBLE DEAL',
  great: 'GREAT DEAL',
  good: 'GOOD PRICE',
};

export const VIBE_TAG_COLORS: Record<string, string> = {
  beach: '#38BDF8',
  mountain: '#6EE7B7',
  city: '#A78BFA',
  culture: '#FB923C',
  adventure: '#F87171',
  romantic: '#F472B6',
  foodie: '#FBBF24',
  nightlife: '#C084FC',
  nature: '#34D399',
  historic: '#D4A574',
  tropical: '#2DD4BF',
  winter: '#93C5FD',
  luxury: '#E2B96F',
  budget: '#86EFAC',
};

export const VIBE_TAG_LABELS: Record<string, string> = {
  beach: 'Beach',
  mountain: 'Mountain',
  city: 'City',
  culture: 'Culture',
  adventure: 'Adventure',
  romantic: 'Romantic',
  foodie: 'Foodie',
  nightlife: 'Nightlife',
  nature: 'Nature',
  historic: 'Historic',
  tropical: 'Tropical',
  winter: 'Winter',
  luxury: 'Luxury',
  budget: 'Budget',
};
