// Tests for utils/priceStats.ts

import {
  computePricePercentile,
  clearStatsCache,
  getRouteStats,
  updateRouteStats,
  bulkGetRouteStats,
} from '@/utils/priceStats';
import type { RouteStats } from '@/utils/priceStats';
import { supabase } from '../../services/supabaseServer';

// ─── Factory ──────────────────────────────────────────────────────────

function makeStats(overrides: Partial<RouteStats> = {}): RouteStats {
  return {
    routeKey: 'JFK-CDG',
    origin: 'JFK',
    destinationIata: 'CDG',
    medianPrice: 500,
    p20Price: 350,
    p5Price: 250,
    p80Price: 700,
    minPriceEver: 200,
    maxPriceEver: 1200,
    sampleCount: 100,
    last30dAvg: 480,
    lastUpdated: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

// ─── computePricePercentile ───────────────────────────────────────────

describe('computePricePercentile', () => {
  const stats = makeStats();

  it('returns 50 when stats is null', () => {
    expect(computePricePercentile(300, null)).toBe(50);
  });

  it('returns 50 when sampleCount < 1', () => {
    expect(computePricePercentile(300, makeStats({ sampleCount: 0 }))).toBe(50);
  });

  it('returns 5 for price at or below p5', () => {
    expect(computePricePercentile(250, stats)).toBe(5);
    expect(computePricePercentile(200, stats)).toBe(5);
    expect(computePricePercentile(100, stats)).toBe(5);
  });

  it('interpolates between p5 and p20', () => {
    // p5=250, p20=350 => range=100
    // price=300 => 5 + ((300-250)/100)*15 = 5 + 7.5 = 12.5
    expect(computePricePercentile(300, stats)).toBe(12.5);
  });

  it('interpolates between p20 and median', () => {
    // p20=350, median=500 => range=150
    // price=425 => 20 + ((425-350)/150)*30 = 20 + 15 = 35
    expect(computePricePercentile(425, stats)).toBe(35);
  });

  it('interpolates between median and p80', () => {
    // median=500, p80=700 => range=200
    // price=600 => 50 + ((600-500)/200)*30 = 50 + 15 = 65
    expect(computePricePercentile(600, stats)).toBe(65);
  });

  it('interpolates above p80 up to 100', () => {
    // p80=700, max=1200 => range=500
    // price=950 => 80 + ((950-700)/500)*20 = 80 + 10 = 90
    expect(computePricePercentile(950, stats)).toBe(90);
  });

  it('caps at 100 for very high prices', () => {
    expect(computePricePercentile(5000, stats)).toBe(100);
  });

  it('handles edge where p5 equals p20 (zero range)', () => {
    const s = makeStats({ p5Price: 300, p20Price: 300 });
    // price between p5 and p20 but range=0, should return 12
    expect(computePricePercentile(300, s)).toBe(5); // price <= p5Price so returns 5
  });

  it('handles edge where p20 equals median (zero range)', () => {
    const s = makeStats({ p20Price: 500, medianPrice: 500 });
    // price=500 => price <= p20Price(500), enters p5-p20 interpolation
    // p5=250, p20=500, range=250, price=500 => 5 + ((500-250)/250)*15 = 5+15 = 20
    expect(computePricePercentile(500, s)).toBe(20);
  });

  it('handles edge where median equals p80 (zero range)', () => {
    const s = makeStats({ medianPrice: 500, p80Price: 500 });
    // price=500 => price <= medianPrice, enters p20-median interpolation
    expect(computePricePercentile(500, s)).toBeLessThanOrEqual(50);
  });

  it('handles all same prices', () => {
    const s = makeStats({
      p5Price: 400,
      p20Price: 400,
      medianPrice: 400,
      p80Price: 400,
      minPriceEver: 400,
      maxPriceEver: 400,
    });
    // price=400 <= p5Price => 5
    expect(computePricePercentile(400, s)).toBe(5);
    // price=500 > p80, maxPriceEver - p80 = 0, uses || 1, so 80 + ((500-400)/1)*20 = 2080, capped at 100
    expect(computePricePercentile(500, s)).toBe(100);
  });
});

// ─── getRouteStats (with Supabase mock) ──────────────────────────────

describe('getRouteStats', () => {
  beforeEach(() => {
    clearStatsCache();
    jest.clearAllMocks();
  });

  it('returns null when no data found', async () => {
    // The mock chain resolves to { data: [], error: null } by default
    const result = await getRouteStats('JFK', 'CDG');
    expect(result).toBeNull();
  });

  it('caches null results', async () => {
    await getRouteStats('JFK', 'CDG');
    // Second call should use cache, not call supabase again
    const fromSpy = supabase.from as jest.Mock;
    fromSpy.mockClear();
    await getRouteStats('JFK', 'CDG');
    // from() should not be called again for cached route
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

// ─── updateRouteStats ────────────────────────────────────────────────

describe('updateRouteStats', () => {
  beforeEach(() => {
    clearStatsCache();
    jest.clearAllMocks();
  });

  it('bootstraps new route with first price', async () => {
    const result = await updateRouteStats('SFO', 'NRT', 800);
    expect(result.routeKey).toBe('SFO-NRT');
    expect(result.origin).toBe('SFO');
    expect(result.destinationIata).toBe('NRT');
    expect(result.medianPrice).toBe(800);
    expect(result.p5Price).toBe(800);
    expect(result.p20Price).toBe(800);
    expect(result.p80Price).toBe(800);
    expect(result.minPriceEver).toBe(800);
    expect(result.maxPriceEver).toBe(800);
    expect(result.sampleCount).toBe(1);
    expect(result.last30dAvg).toBe(800);
    expect(result.lastUpdated).toBeDefined();
  });
});

// ─── bulkGetRouteStats ──────────────────────────────────────────────

describe('bulkGetRouteStats', () => {
  beforeEach(() => {
    clearStatsCache();
    jest.clearAllMocks();
  });

  it('returns empty map when no data', async () => {
    const result = await bulkGetRouteStats('JFK');
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});

// ─── clearStatsCache ────────────────────────────────────────────────

describe('clearStatsCache', () => {
  it('does not throw', () => {
    expect(() => clearStatsCache()).not.toThrow();
  });
});
