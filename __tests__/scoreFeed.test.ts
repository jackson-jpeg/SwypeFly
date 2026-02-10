import { scoreFeed } from '../utils/scoreFeed';
import type { Destination } from '../types/destination';

function makeDest(overrides: Partial<Destination> & { city: string; country: string }): Destination {
  return {
    id: Math.random().toString(36).slice(2),
    iataCode: 'TST',
    tagline: 'Test destination',
    description: 'A test destination',
    imageUrl: 'https://example.com/img.jpg',
    flightPrice: 500,
    hotelPricePerNight: 100,
    currency: 'USD',
    vibeTags: ['beach'],
    rating: 4.5,
    reviewCount: 100,
    bestMonths: ['Jan', 'Feb'],
    averageTemp: 75,
    flightDuration: '5h',
    ...overrides,
  };
}

describe('scoreFeed', () => {
  it('returns empty array for empty input', () => {
    expect(scoreFeed([])).toEqual([]);
  });

  it('returns single item unchanged', () => {
    const dest = makeDest({ city: 'Miami', country: 'USA' });
    const result = scoreFeed([dest]);
    expect(result).toHaveLength(1);
    expect(result[0].city).toBe('Miami');
  });

  it('returns all destinations (no items lost)', () => {
    const dests = [
      makeDest({ city: 'Miami', country: 'USA', vibeTags: ['beach'] }),
      makeDest({ city: 'Paris', country: 'France', vibeTags: ['culture'] }),
      makeDest({ city: 'Tokyo', country: 'Japan', vibeTags: ['city'] }),
      makeDest({ city: 'Cancun', country: 'Mexico', vibeTags: ['tropical'] }),
      makeDest({ city: 'Rome', country: 'Italy', vibeTags: ['historic'] }),
    ];
    const result = scoreFeed(dests);
    expect(result).toHaveLength(5);
    const cities = result.map((d) => d.city).sort();
    expect(cities).toEqual(['Cancun', 'Miami', 'Paris', 'Rome', 'Tokyo']);
  });

  it('applies region diversity — avoids consecutive same-region items', () => {
    const dests = [
      makeDest({ city: 'Paris', country: 'France', vibeTags: ['culture'], rating: 4.8, flightPrice: 500 }),
      makeDest({ city: 'Rome', country: 'Italy', vibeTags: ['historic'], rating: 4.7, flightPrice: 520 }),
      makeDest({ city: 'Madrid', country: 'Spain', vibeTags: ['foodie'], rating: 4.6, flightPrice: 510 }),
      makeDest({ city: 'Tokyo', country: 'Japan', vibeTags: ['city'], rating: 4.5, flightPrice: 800 }),
      makeDest({ city: 'Bali', country: 'Indonesia', vibeTags: ['beach'], rating: 4.4, flightPrice: 900 }),
    ];
    const result = scoreFeed(dests);

    // Not all three European cities should be consecutive
    const regions = result.map((d) => {
      if (['France', 'Italy', 'Spain'].includes(d.country)) return 'europe';
      return 'other';
    });
    // Check that we don't have 3 consecutive 'europe'
    let maxConsecutive = 0;
    let current = 0;
    for (const r of regions) {
      if (r === 'europe') {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }
    expect(maxConsecutive).toBeLessThanOrEqual(2);
  });

  it('preference boost increases score for matching vibe tags', () => {
    // Create two destinations: one matching saved vibes, one not
    const beachDest = makeDest({
      city: 'Cancun', country: 'Mexico', vibeTags: ['beach', 'tropical'],
      rating: 4.0, flightPrice: 600,
    });
    const cultureDest = makeDest({
      city: 'Rome', country: 'Italy', vibeTags: ['culture', 'historic'],
      rating: 4.0, flightPrice: 600,
    });

    // With beach preference, beach destination should rank higher
    const withPref = scoreFeed([beachDest, cultureDest], ['beach', 'tropical']);
    // Without preference, order might differ
    const withoutPref = scoreFeed([beachDest, cultureDest]);

    // Beach dest should be first with beach preference
    expect(withPref[0].city).toBe('Cancun');
    // This is a soft assertion — just verify both results have all items
    expect(withoutPref).toHaveLength(2);
  });

  it('cheaper flights score higher (all else being equal)', () => {
    const cheap = makeDest({
      city: 'Budget', country: 'USA', vibeTags: ['city'],
      rating: 4.5, flightPrice: 200,
    });
    const expensive = makeDest({
      city: 'Luxury', country: 'USA', vibeTags: ['city'],
      rating: 4.5, flightPrice: 2000,
    });
    // With same rating and vibe, cheaper should tend to rank first
    const result = scoreFeed([expensive, cheap]);
    expect(result[0].city).toBe('Budget');
  });
});
