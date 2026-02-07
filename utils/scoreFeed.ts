import type { Destination } from '../types/destination';

/**
 * Region mapping based on geographic proximity.
 * Used to ensure users don't see 5 Caribbean beaches in a row.
 */
function getRegion(dest: Destination): string {
  const country = dest.country.toLowerCase();
  const id = parseInt(dest.id, 10);

  // Caribbean & Mexico (ids 21-28)
  if (id >= 21 && id <= 28) return 'caribbean';
  // Central & South America (ids 29-34, plus Peru/Argentina)
  if (id >= 29 && id <= 34) return 'latam';
  if (['peru', 'argentina'].includes(country)) return 'latam';
  // Europe (ids 35-42, plus existing European destinations)
  if (id >= 35 && id <= 42) return 'europe';
  if (['greece', 'croatia', 'italy', 'portugal', 'iceland', 'switzerland'].includes(country))
    return 'europe';
  // Asia
  if (
    ['indonesia', 'japan', 'thailand', 'singapore', 'south korea', 'vietnam', 'maldives'].includes(
      country,
    )
  )
    return 'asia';
  // Africa / Middle East
  if (['morocco', 'south africa', 'uae'].includes(country)) return 'africa-me';
  // Domestic US
  if (country === 'usa') return 'domestic';
  // Oceania
  if (['new zealand', 'australia'].includes(country)) return 'oceania';
  // Canada
  if (country === 'canada') return 'americas';
  // Cuba
  if (country === 'cuba') return 'caribbean';

  return 'other';
}

/**
 * Returns the primary vibe "bucket" for diversity purposes.
 * We only look at the first vibe tag to keep it simple.
 */
function getVibeBucket(dest: Destination): string {
  const primary = dest.vibeTags[0];
  // Group similar vibes
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

  // Normalise prices for scoring (0-1 range)
  const prices = remaining.map((d) => d.flightPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // Track recent regions and vibes (sliding window of last N picks)
  const recentRegions: string[] = [];
  const recentVibes: string[] = [];
  const WINDOW = 4;

  // Start with a solid value pick — best rating-to-price ratio
  remaining.sort((a, b) => {
    const scoreA = a.rating / (a.flightPrice / 1000);
    const scoreB = b.rating / (b.flightPrice / 1000);
    return scoreB - scoreA;
  });

  // Seed with the top value pick
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

      // Price score: cheaper = higher (0 to 1)
      const priceScore = 1 - (d.flightPrice - minPrice) / priceRange;

      // Region diversity: penalty if same region appeared recently
      let regionPenalty = 0;
      for (let j = 0; j < recentRegions.length; j++) {
        if (recentRegions[j] === region) {
          // More recent = bigger penalty
          regionPenalty += 1 - j / WINDOW;
        }
      }

      // Vibe diversity: penalty if same vibe bucket appeared recently
      let vibePenalty = 0;
      for (let j = 0; j < recentVibes.length; j++) {
        if (recentVibes[j] === vibe) {
          vibePenalty += 1 - j / WINDOW;
        }
      }

      // Rating boost (normalised 0-1, most are 4.4-4.9)
      const ratingScore = (d.rating - 4.0) / 1.0;

      // Weighted combination
      const score =
        priceScore * 0.3 + // Slight preference for affordable
        ratingScore * 0.2 + // Quality matters
        -regionPenalty * 0.35 + // Strong diversity push
        -vibePenalty * 0.15; // Mild vibe variety

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const pick = remaining.splice(bestIdx, 1)[0];
    result.push(pick);

    // Update sliding windows
    recentRegions.unshift(getRegion(pick));
    recentVibes.unshift(getVibeBucket(pick));
    if (recentRegions.length > WINDOW) recentRegions.pop();
    if (recentVibes.length > WINDOW) recentVibes.pop();
  }

  return result;
}
