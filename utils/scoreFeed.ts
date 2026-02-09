import type { Destination } from '../types/destination';

/**
 * Region mapping based on continent column (if available) or country fallback.
 * Used to ensure users don't see 5 Caribbean beaches in a row.
 */
function getRegion(dest: Destination): string {
  // Prefer continent field if available (set by migration)
  const continent = (dest as unknown as Record<string, unknown>).continent as string | undefined;
  if (continent) {
    const c = continent.toLowerCase();
    if (c.includes('caribbean')) return 'caribbean';
    if (c.includes('south america') || c.includes('central america')) return 'latam';
    if (c.includes('europe')) return 'europe';
    if (c.includes('asia')) return 'asia';
    if (c.includes('africa') || c.includes('middle east')) return 'africa-me';
    if (c.includes('north america')) {
      return dest.country.toLowerCase() === 'usa' ? 'domestic' : 'americas';
    }
    if (c.includes('oceania')) return 'oceania';
    return 'other';
  }

  // Fallback: country-based mapping
  const country = dest.country.toLowerCase();
  if (['indonesia', 'japan', 'thailand', 'singapore', 'south korea', 'vietnam', 'maldives'].includes(country)) return 'asia';
  if (['greece', 'croatia', 'italy', 'portugal', 'iceland', 'switzerland', 'spain', 'france'].includes(country)) return 'europe';
  if (['morocco', 'south africa', 'uae'].includes(country)) return 'africa-me';
  if (['peru', 'argentina', 'brazil', 'colombia', 'costa rica'].includes(country)) return 'latam';
  if (['jamaica', 'dominican republic', 'bahamas', 'cuba', 'puerto rico'].includes(country)) return 'caribbean';
  if (country === 'usa') return 'domestic';
  if (['new zealand', 'australia'].includes(country)) return 'oceania';
  if (['canada', 'mexico'].includes(country)) return 'americas';
  return 'other';
}

/**
 * Returns the primary vibe "bucket" for diversity purposes.
 * We only look at the first vibe tag to keep it simple.
 */
function getVibeBucket(dest: Destination): string {
  const primary = dest.vibeTags[0];
  if (['beach', 'tropical'].includes(primary)) return 'beach';
  if (['mountain', 'nature', 'adventure', 'winter'].includes(primary)) return 'outdoor';
  if (['city', 'nightlife'].includes(primary)) return 'urban';
  if (['culture', 'historic', 'foodie'].includes(primary)) return 'cultural';
  if (['romantic', 'luxury'].includes(primary)) return 'premium';
  return 'other';
}

/**
 * Diversity-aware feed sort.
 *
 * Strategy: greedy pick that maximizes distance from recently shown
 * regions and vibes, while still giving a slight edge to cheaper flights.
 *
 * Not ML — just weighted scoring with a penalty for consecutive
 * same-region or same-vibe destinations.
 */
export function scoreFeed(destinations: Destination[]): Destination[] {
  if (destinations.length <= 1) return destinations;

  const remaining = [...destinations];
  const result: Destination[] = [];

  const prices = remaining.map((d) => d.flightPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const recentRegions: string[] = [];
  const recentVibes: string[] = [];
  const WINDOW = 4;

  remaining.sort((a, b) => {
    const scoreA = a.rating / (a.flightPrice / 1000);
    const scoreB = b.rating / (b.flightPrice / 1000);
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

      const priceScore = 1 - (d.flightPrice - minPrice) / priceRange;

      let regionPenalty = 0;
      for (let j = 0; j < recentRegions.length; j++) {
        if (recentRegions[j] === region) {
          regionPenalty += 1 - j / WINDOW;
        }
      }

      let vibePenalty = 0;
      for (let j = 0; j < recentVibes.length; j++) {
        if (recentVibes[j] === vibe) {
          vibePenalty += 1 - j / WINDOW;
        }
      }

      const ratingScore = (d.rating - 4.0) / 1.0;

      const score =
        priceScore * 0.3 +
        ratingScore * 0.2 +
        -regionPenalty * 0.35 +
        -vibePenalty * 0.15;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const pick = remaining.splice(bestIdx, 1)[0];
    result.push(pick);

    recentRegions.unshift(getRegion(pick));
    recentVibes.unshift(getVibeBucket(pick));
    if (recentRegions.length > WINDOW) recentRegions.pop();
    if (recentVibes.length > WINDOW) recentVibes.pop();
  }

  return result;
}
