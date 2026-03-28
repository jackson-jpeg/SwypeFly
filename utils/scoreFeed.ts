import type { Destination } from '../types/destination';

/**
 * Sub-region mapping — matches the server's 16 sub-regions for consistent diversity.
 */
const COUNTRY_REGION: Record<string, string> = {
  france: 'eu-west', spain: 'eu-west', portugal: 'eu-west', uk: 'eu-west', ireland: 'eu-west', belgium: 'eu-west', netherlands: 'eu-west',
  italy: 'eu-med', greece: 'eu-med', croatia: 'eu-med', turkey: 'eu-med', malta: 'eu-med', montenegro: 'eu-med', cyprus: 'eu-med',
  iceland: 'eu-north', norway: 'eu-north', sweden: 'eu-north', denmark: 'eu-north', finland: 'eu-north', switzerland: 'eu-north', austria: 'eu-north', germany: 'eu-north',
  thailand: 'asia-se', vietnam: 'asia-se', cambodia: 'asia-se', singapore: 'asia-se', malaysia: 'asia-se',
  indonesia: 'asia-island', philippines: 'asia-island', maldives: 'asia-island',
  japan: 'asia-east', 'south korea': 'asia-east', taiwan: 'asia-east',
  india: 'asia-south', nepal: 'asia-south',
  mexico: 'latam-mex', 'costa rica': 'latam-central', panama: 'latam-central',
  colombia: 'latam-south', peru: 'latam-south', ecuador: 'latam-south',
  brazil: 'latam-brazil', argentina: 'latam-brazil', chile: 'latam-brazil',
  jamaica: 'caribbean', 'dominican republic': 'caribbean', bahamas: 'caribbean', 'puerto rico': 'caribbean',
  morocco: 'africa', 'south africa': 'africa', kenya: 'africa', egypt: 'africa',
  uae: 'middle-east', israel: 'middle-east', jordan: 'middle-east',
  australia: 'oceania', 'new zealand': 'oceania',
  usa: 'domestic', canada: 'americas',
};

function getRegion(dest: Destination): string {
  const country = dest.country.toLowerCase();
  return COUNTRY_REGION[country] ?? 'other';
}

/**
 * Multi-tag vibe bucketing — matches server's 10 buckets.
 */
const VIBE_BUCKETS: Record<string, string[]> = {
  'beach-tropical': ['beach', 'tropical'],
  'beach-luxury': ['luxury', 'romantic', 'beach'],
  'mountain-adventure': ['mountain', 'adventure', 'winter', 'hiking'],
  'nature-relaxation': ['nature', 'wellness', 'relaxation'],
  'city-nightlife': ['city', 'nightlife', 'urban'],
  'city-culture': ['culture', 'historic', 'foodie', 'art'],
  'island-escape': ['island', 'tropical', 'diving'],
  'budget-backpacker': ['budget', 'backpacker', 'adventure'],
  'luxury-romantic': ['luxury', 'romantic', 'spa'],
  'off-beaten-path': ['offbeat', 'unique', 'hidden'],
};

function getVibeBucket(dest: Destination): string {
  if (!dest.vibeTags || dest.vibeTags.length === 0) return 'other';
  const tagSet = new Set(dest.vibeTags.map((t) => t.toLowerCase()));
  let bestBucket = 'other';
  let bestScore = 0;
  for (const [bucket, keywords] of Object.entries(VIBE_BUCKETS)) {
    const matches = keywords.filter((k) => tagSet.has(k)).length;
    const score = matches / keywords.length + matches * 0.1;
    if (score > bestScore) { bestScore = score; bestBucket = bucket; }
  }
  return bestBucket;
}

/**
 * Diversity-aware feed sort with discovery signals.
 *
 * Matches the server-side scoring engine:
 * - Discovery: price anomaly detection, hidden gem bonus
 * - Trend: price direction signals
 * - Convenience: nonstop/short flights
 * - Diversity: region, country, vibe penalties
 * - Value density: price per day
 */
export function scoreFeed(destinations: Destination[], savedVibeTags?: string[]): Destination[] {
  if (destinations.length <= 1) return destinations;

  const remaining = [...destinations];
  const result: Destination[] = [];

  const prices = remaining.map((d) => d.flightPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const recentRegions: string[] = [];
  const recentVibes: string[] = [];
  const recentCountries: string[] = [];
  const WINDOW = 4;

  // Seed with most compelling deal (discovery + affordability + quality)
  remaining.sort((a, b) => {
    const pa = a.flightPrice;
    const pb = b.flightPrice;
    const discA = a.savingsPercent && a.savingsPercent > 15 ? a.savingsPercent / 100 : 0;
    const discB = b.savingsPercent && b.savingsPercent > 15 ? b.savingsPercent / 100 : 0;
    const scoreA = discA + (pa > 0 ? 1 - pa / (maxPrice || 1) : 0) * 0.3 + ((a.dealScore ?? 0) / 100) * 0.2;
    const scoreB = discB + (pb > 0 ? 1 - pb / (maxPrice || 1) : 0) * 0.3 + ((b.dealScore ?? 0) / 100) * 0.2;
    return scoreB - scoreA;
  });

  const seed = remaining.shift()!;
  result.push(seed);
  recentRegions.push(getRegion(seed));
  recentVibes.push(getVibeBucket(seed));

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = remaining[i];
      const region = getRegion(d);
      const vibe = getVibeBucket(d);
      const country = d.country.toLowerCase();

      const priceScore = 1 - (d.flightPrice - minPrice) / priceRange;

      // Discovery bonus: savings below usual price
      let discoveryBonus = 0;
      if (d.savingsPercent && d.savingsPercent > 10) {
        discoveryBonus = Math.min(0.40, (d.savingsPercent / 100) * 1.2);
      }

      // Deal quality bonus
      const qualityBonus = d.dealScore != null ? (d.dealScore / 100) * 0.12 : 0;

      // Convenience: nonstop flights get a boost
      let convenienceBonus = 0;
      if (d.isNonstop) convenienceBonus = 0.10;
      else if (d.totalStops === 1) convenienceBonus = 0.03;
      else if (d.totalStops != null && d.totalStops >= 2) convenienceBonus = -0.05;

      // Value density
      let valueDensity = 0;
      const tripDays = d.tripDurationDays ?? 5;
      if (d.flightPrice > 0 && tripDays > 0) {
        const ppd = d.flightPrice / tripDays;
        valueDensity = Math.max(0, Math.min(0.12, (1 - ppd / 200) * 0.12));
      }

      // Price trend
      let trendBonus = 0;
      if (d.priceDirection === 'down') trendBonus = 0.12;
      else if (d.priceDirection === 'stable') trendBonus = 0.03;

      // Diversity penalties
      let regionPenalty = 0;
      for (let j = 0; j < recentRegions.length; j++) {
        if (recentRegions[j] === region) regionPenalty += 1 - j / WINDOW;
      }
      let countryPenalty = 0;
      for (let j = 0; j < Math.min(recentCountries.length, 3); j++) {
        if (recentCountries[j] === country) countryPenalty += 0.3 * (1 - j / 3);
      }
      let vibePenalty = 0;
      for (let j = 0; j < recentVibes.length; j++) {
        if (recentVibes[j] === vibe) vibePenalty += 1 - j / WINDOW;
      }

      // Preference boost from saved vibes
      let preferenceBoost = 0;
      if (savedVibeTags && savedVibeTags.length > 0) {
        const overlap = d.vibeTags.filter((v) => savedVibeTags.includes(v)).length;
        preferenceBoost = Math.min(overlap / savedVibeTags.length, 1) * 0.20;
      }

      // Freshness boost
      let freshnessBoost = 0;
      if (d.priceFetchedAt) {
        const ageHours = (Date.now() - new Date(d.priceFetchedAt).getTime()) / 3600000;
        if (ageHours < 1) freshnessBoost = 0.10;
        else if (ageHours < 6) freshnessBoost = 0.06;
        else if (ageHours < 24) freshnessBoost = 0.02;
      }

      const jitter = Math.random() * 0.12;

      const score =
        priceScore * 0.20
        + discoveryBonus
        + qualityBonus
        + convenienceBonus
        + valueDensity
        + trendBonus
        + freshnessBoost
        + preferenceBoost
        - regionPenalty * 0.18
        - countryPenalty
        - vibePenalty * 0.08
        + jitter;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // 12% exploration weighted by discovery signals
    let pickIdx = bestIdx;
    if (Math.random() < 0.12) {
      const affordable = remaining
        .map((d, i) => ({ i, w: (d.savingsPercent ?? 0) / 100 + (d.flightPrice < 400 ? 0.2 : 0) }))
        .filter((x) => x.w > 0);
      if (affordable.length > 0) {
        const totalW = affordable.reduce((s, c) => s + c.w, 0);
        let r = Math.random() * totalW;
        for (const c of affordable) { r -= c.w; if (r <= 0) { pickIdx = c.i; break; } }
      }
    }

    const pick = remaining.splice(pickIdx, 1)[0];
    result.push(pick);
    recentRegions.unshift(getRegion(pick));
    recentVibes.unshift(getVibeBucket(pick));
    recentCountries.unshift(pick.country.toLowerCase());
    if (recentRegions.length > WINDOW) recentRegions.pop();
    if (recentVibes.length > WINDOW) recentVibes.pop();
    if (recentCountries.length > 3) recentCountries.pop();
  }

  return result;
}
