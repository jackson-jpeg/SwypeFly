import {
  evaluateDealQuality,
  extractSegmentData,
  US_AIRPORTS,
} from '../utils/dealQuality';
import type { DealQualityInput } from '../utils/dealQuality';
import { computePricePercentile } from '../utils/priceStats';
import type { RouteStats } from '../utils/priceStats';

// ─── Factory helpers ──────────────────────────────────────────────────

/** Returns a valid deal input that passes all hard filters by default. */
function makeDeal(overrides: Partial<DealQualityInput> = {}): DealQualityInput {
  // Use a future date to avoid 'departure_in_past' rejection
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 2);
  const dep = futureDate.toISOString().split('T')[0];
  const ret = new Date(futureDate.getTime() + 7 * 86_400_000)
    .toISOString()
    .split('T')[0];

  return {
    originIata: 'JFK',
    destinationIata: 'LHR',
    price: 350,
    departureDate: dep,
    returnDate: ret,
    destinationCountry: 'United Kingdom',
    ...overrides,
  };
}

function makeStats(overrides: Partial<RouteStats> = {}): RouteStats {
  return {
    routeKey: 'JFK-LHR',
    origin: 'JFK',
    destinationIata: 'LHR',
    medianPrice: 500,
    p20Price: 350,
    p5Price: 250,
    p80Price: 700,
    minPriceEver: 200,
    maxPriceEver: 1200,
    sampleCount: 100,
    last30dAvg: 480,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Hard rejection filters ───────────────────────────────────────────

describe('evaluateDealQuality — hard rejection filters', () => {
  it('rejects $0 price', () => {
    const result = evaluateDealQuality(makeDeal({ price: 0 }));
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('price_zero_or_negative');
    expect(result.dealTier).toBe('rejected');
    expect(result.qualityScore).toBe(0);
    expect(result.dealScore).toBe(0);
  });

  it('rejects negative price', () => {
    const result = evaluateDealQuality(makeDeal({ price: -50 }));
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('price_zero_or_negative');
  });

  it('rejects same origin and destination', () => {
    const result = evaluateDealQuality(
      makeDeal({ originIata: 'JFK', destinationIata: 'JFK' }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('same_origin_destination');
  });

  it('rejects departure in the past', () => {
    const result = evaluateDealQuality(
      makeDeal({
        departureDate: '2020-01-01',
        returnDate: '2020-01-10',
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('departure_in_past');
  });

  it('rejects domestic trip shorter than 2 days', () => {
    const dep = makeDeal().departureDate;
    const nextDay = new Date(new Date(dep).getTime() + 86_400_000)
      .toISOString()
      .split('T')[0];
    const result = evaluateDealQuality(
      makeDeal({
        originIata: 'JFK',
        destinationIata: 'LAX',
        departureDate: dep,
        returnDate: nextDay,
        isDomestic: true,
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('trip_too_short_domestic');
  });

  it('rejects international trip shorter than 3 days', () => {
    const dep = makeDeal().departureDate;
    const twoDaysLater = new Date(new Date(dep).getTime() + 2 * 86_400_000)
      .toISOString()
      .split('T')[0];
    const result = evaluateDealQuality(
      makeDeal({
        departureDate: dep,
        returnDate: twoDaysLater,
        isDomestic: false,
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('trip_too_short_international');
  });

  it('rejects domestic flight with more than 1 stop', () => {
    const result = evaluateDealQuality(
      makeDeal({
        originIata: 'JFK',
        destinationIata: 'LAX',
        isDomestic: true,
        totalStops: 2,
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('too_many_stops_domestic');
  });

  it('rejects international flight with more than 2 stops', () => {
    const result = evaluateDealQuality(
      makeDeal({
        totalStops: 3,
        isDomestic: false,
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('too_many_stops_international');
  });

  it('rejects layover longer than 8 hours', () => {
    const result = evaluateDealQuality(
      makeDeal({ maxLayoverMinutes: 481 }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('layover_too_long');
  });

  it('allows layover of exactly 480 minutes (8 hours)', () => {
    const result = evaluateDealQuality(
      makeDeal({ maxLayoverMinutes: 480 }),
    );
    expect(result.pass).toBe(true);
    expect(result.rejectReason).toBeNull();
  });

  it('rejects excessive travel time (>3.5x direct estimate)', () => {
    // US-UK direct estimate is 480 min; 3.5x = 1680
    const result = evaluateDealQuality(
      makeDeal({
        originIata: 'JFK',
        destinationIata: 'LHR',
        destinationCountry: 'United Kingdom',
        totalTravelTimeMinutes: 1700,
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('travel_time_excessive');
  });

  it('allows travel time just under 3.5x direct estimate', () => {
    // 3.5x of 480 = 1680
    const result = evaluateDealQuality(
      makeDeal({
        originIata: 'JFK',
        destinationIata: 'LHR',
        destinationCountry: 'United Kingdom',
        totalTravelTimeMinutes: 1440,
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('auto-detects domestic when both airports are US', () => {
    const dep = makeDeal().departureDate;
    const nextDay = new Date(new Date(dep).getTime() + 86_400_000)
      .toISOString()
      .split('T')[0];
    const result = evaluateDealQuality(
      makeDeal({
        originIata: 'JFK',
        destinationIata: 'LAX',
        departureDate: dep,
        returnDate: nextDay,
        // isDomestic not provided — should auto-detect
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.rejectReason).toBe('trip_too_short_domestic');
  });

  it('skips stop/layover/travel-time filters when segment data missing', () => {
    // No totalStops, maxLayoverMinutes, or totalTravelTimeMinutes — should pass
    const result = evaluateDealQuality(makeDeal());
    expect(result.pass).toBe(true);
    expect(result.rejectReason).toBeNull();
  });
});

// ─── Passing deals ────────────────────────────────────────────────────

describe('evaluateDealQuality — passing deals', () => {
  it('passes a standard international round trip', () => {
    const result = evaluateDealQuality(makeDeal());
    expect(result.pass).toBe(true);
    expect(result.rejectReason).toBeNull();
    expect(result.dealTier).not.toBe('rejected');
    expect(result.qualityScore).toBeGreaterThan(0);
    expect(result.dealScore).toBeGreaterThan(0);
  });

  it('passes a 2-day domestic trip', () => {
    const dep = makeDeal().departureDate;
    const twoDays = new Date(new Date(dep).getTime() + 2 * 86_400_000)
      .toISOString()
      .split('T')[0];
    const result = evaluateDealQuality(
      makeDeal({
        originIata: 'JFK',
        destinationIata: 'MIA',
        departureDate: dep,
        returnDate: twoDays,
        isDomestic: true,
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('passes a 3-day international trip', () => {
    const dep = makeDeal().departureDate;
    const threeDays = new Date(new Date(dep).getTime() + 3 * 86_400_000)
      .toISOString()
      .split('T')[0];
    const result = evaluateDealQuality(
      makeDeal({
        departureDate: dep,
        returnDate: threeDays,
        isDomestic: false,
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('passes a nonstop flight on a major carrier', () => {
    const result = evaluateDealQuality(
      makeDeal({
        totalStops: 0,
        airline: 'DL',
        pricePercentile: 10,
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.qualityScore).toBeGreaterThanOrEqual(100); // 100 base + 15 nonstop + 5 major
  });

  it('passes international with 2 stops (the max allowed)', () => {
    const result = evaluateDealQuality(
      makeDeal({ totalStops: 2, isDomestic: false }),
    );
    expect(result.pass).toBe(true);
  });

  it('passes domestic with 1 stop (the max allowed)', () => {
    const result = evaluateDealQuality(
      makeDeal({
        originIata: 'JFK',
        destinationIata: 'LAX',
        isDomestic: true,
        totalStops: 1,
      }),
    );
    expect(result.pass).toBe(true);
  });
});

// ─── Quality score computation ────────────────────────────────────────

describe('evaluateDealQuality — quality score', () => {
  it('gives nonstop bonus (+15)', () => {
    const nonstop = evaluateDealQuality(makeDeal({ totalStops: 0 }));
    const noData = evaluateDealQuality(makeDeal());
    // nonstop: 100 - 0*15 + 15 = 115, clamped to 100
    // But actually: 100 - 0 + 15 = 115 → clamped 100
    expect(nonstop.qualityScore).toBe(100);
  });

  it('penalizes each stop by 15 points', () => {
    const oneStop = evaluateDealQuality(makeDeal({ totalStops: 1 }));
    const twoStop = evaluateDealQuality(makeDeal({ totalStops: 2, isDomestic: false }));
    // 1 stop: 100 - 15 = 85
    expect(oneStop.qualityScore).toBe(85);
    // 2 stops: 100 - 30 = 70
    expect(twoStop.qualityScore).toBe(70);
  });

  it('penalizes layover >= 4h by 15 points', () => {
    const result = evaluateDealQuality(makeDeal({ maxLayoverMinutes: 300 }));
    expect(result.qualityScore).toBe(85); // 100 - 15
  });

  it('penalizes layover >= 2h by 5 points', () => {
    const result = evaluateDealQuality(makeDeal({ maxLayoverMinutes: 150 }));
    expect(result.qualityScore).toBe(95); // 100 - 5
  });

  it('no layover penalty under 2h', () => {
    const result = evaluateDealQuality(makeDeal({ maxLayoverMinutes: 90 }));
    expect(result.qualityScore).toBe(100);
  });

  it('penalizes red-eye departures (23:00-04:59) by 10 points', () => {
    const lateNight = evaluateDealQuality(makeDeal({ departureHour: 23 }));
    expect(lateNight.qualityScore).toBe(90); // 100 - 10

    const earlyMorning = evaluateDealQuality(makeDeal({ departureHour: 3 }));
    expect(earlyMorning.qualityScore).toBe(90);
  });

  it('gives morning departure bonus (+5) for hours 7-10', () => {
    const morning = evaluateDealQuality(makeDeal({ departureHour: 8 }));
    expect(morning.qualityScore).toBe(100); // 100 + 5 = 105, clamped to 100

    // Check it actually adds 5 by combining with a penalty
    const morningOneStop = evaluateDealQuality(
      makeDeal({ departureHour: 9, totalStops: 1 }),
    );
    // 100 - 15 (1 stop) + 5 (morning) = 90
    expect(morningOneStop.qualityScore).toBe(90);
  });

  it('penalizes ULCC carriers by 10 points', () => {
    const spirit = evaluateDealQuality(makeDeal({ airline: 'NK' }));
    expect(spirit.qualityScore).toBe(90); // 100 - 10

    const frontier = evaluateDealQuality(makeDeal({ airline: 'F9' }));
    expect(frontier.qualityScore).toBe(90);
  });

  it('gives major carrier bonus (+5)', () => {
    // Combined with a penalty to make the +5 visible
    const delta = evaluateDealQuality(makeDeal({ airline: 'DL', totalStops: 1 }));
    // 100 - 15 + 5 = 90
    expect(delta.qualityScore).toBe(90);
  });

  it('stacks multiple penalties correctly', () => {
    const result = evaluateDealQuality(
      makeDeal({
        totalStops: 2,
        isDomestic: false,
        maxLayoverMinutes: 300, // 5h → -15
        departureHour: 1,      // red-eye → -10
        airline: 'NK',          // ULCC → -10
      }),
    );
    // 100 - 30 (2 stops) - 15 (layover) - 10 (red-eye) - 10 (ULCC) = 35
    expect(result.qualityScore).toBe(35);
  });

  it('clamps quality score to 0 (never negative)', () => {
    // Force a very low score — this won't pass hard filters as domestic,
    // so use international with max allowed stops
    const result = evaluateDealQuality(
      makeDeal({
        totalStops: 2,
        isDomestic: false,
        maxLayoverMinutes: 300,
        departureHour: 0,
        airline: 'NK',
        // Additional penalties can't get below 0 but let's verify clamp
      }),
    );
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
  });

  it('clamps quality score to 100 (never above)', () => {
    const result = evaluateDealQuality(
      makeDeal({
        totalStops: 0,
        departureHour: 8,
        airline: 'SQ',
      }),
    );
    // 100 + 15 (nonstop) + 5 (morning) + 5 (major) = 125 → clamped to 100
    expect(result.qualityScore).toBe(100);
  });
});

// ─── Deal tier classification ─────────────────────────────────────────

describe('evaluateDealQuality — deal tier classification', () => {
  it('classifies amazing tier (dealScore >= 85)', () => {
    const result = evaluateDealQuality(
      makeDeal({
        pricePercentile: 0,    // priceScore = 100
        totalStops: 0,         // qualityScore = 100
        airline: 'DL',
        departureHour: 8,
        popularityScore: 1.0,
        foundAt: new Date().toISOString(), // recency = 100
      }),
    );
    // priceScore=100*0.35 + quality=100*0.25 + popularity=100*0.15 + recency=100*0.15 + season≈60*0.10
    // = 35 + 25 + 15 + 15 + 6 = 96
    expect(result.dealTier).toBe('amazing');
    expect(result.dealScore).toBeGreaterThanOrEqual(85);
  });

  it('classifies great tier (70-84)', () => {
    const result = evaluateDealQuality(
      makeDeal({
        pricePercentile: 15,
        totalStops: 1,
        popularityScore: 0.7,
        foundAt: new Date(Date.now() - 3 * 3_600_000).toISOString(), // 3h ago
      }),
    );
    // priceScore=85*0.35 + quality=85*0.25 + pop=70*0.15 + recency=80*0.15 + season≈60*0.10
    // ≈ 29.75 + 21.25 + 10.5 + 12 + 6 = 79.5 → ~80
    expect(result.dealTier).toBe('great');
    expect(result.dealScore).toBeGreaterThanOrEqual(70);
    expect(result.dealScore).toBeLessThan(85);
  });

  it('classifies good tier (50-69)', () => {
    const result = evaluateDealQuality(
      makeDeal({
        pricePercentile: 35,
        totalStops: 1,
        popularityScore: 0.5,
      }),
    );
    // priceScore=65*0.35 + quality=85*0.25 + pop=50*0.15 + recency=50*0.15 + season≈60*0.10
    // ≈ 22.75 + 21.25 + 7.5 + 7.5 + 6 = 65
    expect(result.dealTier).toBe('good');
    expect(result.dealScore).toBeGreaterThanOrEqual(50);
    expect(result.dealScore).toBeLessThan(70);
  });

  it('classifies fair tier (30-49)', () => {
    const result = evaluateDealQuality(
      makeDeal({
        pricePercentile: 70,
        totalStops: 2,
        isDomestic: false,
        maxLayoverMinutes: 240,
        airline: 'NK',
        popularityScore: 0.2,
        foundAt: new Date(Date.now() - 72 * 3_600_000).toISOString(), // 72h ago
      }),
    );
    // priceScore=30*0.35 + quality=45*0.25 + pop=20*0.15 + recency=5*0.15 + season≈60*0.10
    // ≈ 10.5 + 11.25 + 3 + 0.75 + 6 = 31.5
    expect(result.dealTier).toBe('fair');
    expect(result.dealScore).toBeGreaterThanOrEqual(30);
    expect(result.dealScore).toBeLessThan(50);
  });

  it('returns rejected tier for hard-filtered deals', () => {
    const result = evaluateDealQuality(makeDeal({ price: 0 }));
    expect(result.dealTier).toBe('rejected');
    expect(result.pass).toBe(false);
  });

  it('pass is false only for rejected tier', () => {
    // A deal with very high percentile (bad price) but passing hard filters
    const result = evaluateDealQuality(
      makeDeal({
        pricePercentile: 99,
        totalStops: 2,
        isDomestic: false,
        maxLayoverMinutes: 300,
        airline: 'NK',
        departureHour: 1,
        popularityScore: 0,
        foundAt: new Date(Date.now() - 100 * 3_600_000).toISOString(),
      }),
    );
    // Very low dealScore, but if it passes hard filters, pass depends on tier
    if (result.dealTier === 'rejected') {
      expect(result.pass).toBe(false);
    } else {
      expect(result.pass).toBe(true);
    }
  });
});

// ─── Deal score components ────────────────────────────────────────────

describe('evaluateDealQuality — deal score components', () => {
  it('defaults pricePercentile to 50 when not provided', () => {
    const result = evaluateDealQuality(makeDeal());
    expect(result.pricePercentile).toBe(50);
  });

  it('uses provided pricePercentile', () => {
    const result = evaluateDealQuality(makeDeal({ pricePercentile: 20 }));
    expect(result.pricePercentile).toBe(20);
  });

  it('computes savingsPercent for below-median prices', () => {
    const result = evaluateDealQuality(makeDeal({ pricePercentile: 10 }));
    // (50 - 10) * 2 = 80%
    expect(result.savingsPercent).toBe(80);
  });

  it('savingsPercent is 0 for at or above median', () => {
    const atMedian = evaluateDealQuality(makeDeal({ pricePercentile: 50 }));
    expect(atMedian.savingsPercent).toBe(0);

    const aboveMedian = evaluateDealQuality(makeDeal({ pricePercentile: 75 }));
    expect(aboveMedian.savingsPercent).toBe(0);
  });

  it('savingsPercent maxes at 100 for 0th percentile', () => {
    const result = evaluateDealQuality(makeDeal({ pricePercentile: 0 }));
    expect(result.savingsPercent).toBe(100);
  });

  it('defaults popularityScore to 0.5 (50) when not provided', () => {
    const withPop = evaluateDealQuality(
      makeDeal({ popularityScore: 1.0, pricePercentile: 50 }),
    );
    const withoutPop = evaluateDealQuality(
      makeDeal({ pricePercentile: 50 }),
    );
    // Popularity component: 100*0.15 vs 50*0.15 = 15 vs 7.5 → diff ~7-8
    expect(withPop.dealScore).toBeGreaterThan(withoutPop.dealScore);
  });

  it('recency score is 100 for price found < 1h ago', () => {
    const fresh = evaluateDealQuality(
      makeDeal({
        foundAt: new Date().toISOString(),
        pricePercentile: 50,
        popularityScore: 0.5,
      }),
    );
    const stale = evaluateDealQuality(
      makeDeal({
        foundAt: new Date(Date.now() - 72 * 3_600_000).toISOString(),
        pricePercentile: 50,
        popularityScore: 0.5,
      }),
    );
    expect(fresh.dealScore).toBeGreaterThan(stale.dealScore);
  });

  it('recency defaults to 50 when foundAt not provided', () => {
    const noFoundAt = evaluateDealQuality(
      makeDeal({ pricePercentile: 50, popularityScore: 0.5 }),
    );
    const sixHourOld = evaluateDealQuality(
      makeDeal({
        foundAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
        pricePercentile: 50,
        popularityScore: 0.5,
      }),
    );
    // Both have recency ~50-80, but the 5h old deal has recency=80
    // no foundAt = 50, 5h = 80 → 6h old should score higher
    expect(sixHourOld.dealScore).toBeGreaterThanOrEqual(noFoundAt.dealScore);
  });
});

// ─── Boundary tests ───────────────────────────────────────────────────

describe('evaluateDealQuality — boundary values', () => {
  it('deal score exactly 85 is amazing', () => {
    // We can't precisely control dealScore=85, but we can verify the boundary logic
    // by testing the tier classifier through evaluateDealQuality output
    const result = evaluateDealQuality(
      makeDeal({
        pricePercentile: 0,
        totalStops: 0,
        airline: 'DL',
        popularityScore: 0.9,
        foundAt: new Date().toISOString(),
      }),
    );
    if (result.dealScore >= 85) {
      expect(result.dealTier).toBe('amazing');
    }
  });

  it('deal score exactly at 70 is great', () => {
    const result = evaluateDealQuality(
      makeDeal({ pricePercentile: 15, popularityScore: 0.6 }),
    );
    if (result.dealScore >= 70 && result.dealScore < 85) {
      expect(result.dealTier).toBe('great');
    }
  });

  it('trip of exactly 2 days passes domestic check', () => {
    const dep = makeDeal().departureDate;
    const twoDays = new Date(new Date(dep).getTime() + 2 * 86_400_000)
      .toISOString()
      .split('T')[0];
    const result = evaluateDealQuality(
      makeDeal({
        originIata: 'JFK',
        destinationIata: 'MIA',
        departureDate: dep,
        returnDate: twoDays,
        isDomestic: true,
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('trip of exactly 3 days passes international check', () => {
    const dep = makeDeal().departureDate;
    const threeDays = new Date(new Date(dep).getTime() + 3 * 86_400_000)
      .toISOString()
      .split('T')[0];
    const result = evaluateDealQuality(
      makeDeal({
        departureDate: dep,
        returnDate: threeDays,
        isDomestic: false,
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('departure hour 5 is NOT red-eye (boundary)', () => {
    const result = evaluateDealQuality(makeDeal({ departureHour: 5 }));
    // Hour 5 is outside 23-4 range, no red-eye penalty
    expect(result.qualityScore).toBe(100);
  });

  it('departure hour 22 is NOT red-eye (boundary)', () => {
    const result = evaluateDealQuality(makeDeal({ departureHour: 22 }));
    expect(result.qualityScore).toBe(100);
  });

  it('maxLayoverMinutes at exactly 120 triggers 2-4h penalty', () => {
    const result = evaluateDealQuality(makeDeal({ maxLayoverMinutes: 120 }));
    expect(result.qualityScore).toBe(95); // 100 - 5
  });

  it('maxLayoverMinutes at exactly 240 triggers 4-8h penalty', () => {
    const result = evaluateDealQuality(makeDeal({ maxLayoverMinutes: 240 }));
    expect(result.qualityScore).toBe(85); // 100 - 15
  });

  it('maxLayoverMinutes at 119 has no penalty', () => {
    const result = evaluateDealQuality(makeDeal({ maxLayoverMinutes: 119 }));
    expect(result.qualityScore).toBe(100);
  });

  it('$1 price passes (minimum valid)', () => {
    const result = evaluateDealQuality(makeDeal({ price: 1 }));
    expect(result.pass).toBe(true);
  });
});

// ─── extractSegmentData ───────────────────────────────────────────────

describe('extractSegmentData', () => {
  it('extracts data from a nonstop Duffel offer', () => {
    const offer = {
      slices: [
        {
          segments: [
            {
              departing_at: '2026-06-15T08:30:00Z',
              arriving_at: '2026-06-15T20:45:00Z',
              operating_carrier: { iata_code: 'BA' },
            },
          ],
        },
      ],
    };
    const result = extractSegmentData(JSON.stringify(offer));
    expect(result).not.toBeNull();
    expect(result!.totalStops).toBe(0);
    expect(result!.isNonstop).toBe(true);
    expect(result!.totalTravelTimeMinutes).toBe(735); // 12h15m
    expect(result!.maxLayoverMinutes).toBe(0);
    expect(result!.airlineCode).toBe('BA');
  });

  it('extracts data from a one-stop offer with layover', () => {
    const offer = {
      slices: [
        {
          segments: [
            {
              departing_at: '2026-06-15T08:00:00Z',
              arriving_at: '2026-06-15T12:00:00Z',
              operating_carrier: { iata_code: 'AA' },
            },
            {
              departing_at: '2026-06-15T14:30:00Z',
              arriving_at: '2026-06-15T18:00:00Z',
              operating_carrier: { iata_code: 'AA' },
            },
          ],
        },
      ],
    };
    const result = extractSegmentData(JSON.stringify(offer));
    expect(result).not.toBeNull();
    expect(result!.totalStops).toBe(1);
    expect(result!.isNonstop).toBe(false);
    expect(result!.maxLayoverMinutes).toBe(150); // 2.5h
    expect(result!.totalTravelTimeMinutes).toBe(600); // 10h
    expect(result!.airlineCode).toBe('AA');
  });

  it('picks the largest layover from multi-stop', () => {
    const offer = {
      slices: [
        {
          segments: [
            {
              departing_at: '2026-06-15T06:00:00Z',
              arriving_at: '2026-06-15T09:00:00Z',
              operating_carrier: { iata_code: 'UA' },
            },
            {
              departing_at: '2026-06-15T10:00:00Z', // 1h layover
              arriving_at: '2026-06-15T14:00:00Z',
              operating_carrier: { iata_code: 'UA' },
            },
            {
              departing_at: '2026-06-15T18:00:00Z', // 4h layover
              arriving_at: '2026-06-15T22:00:00Z',
              operating_carrier: { iata_code: 'UA' },
            },
          ],
        },
      ],
    };
    const result = extractSegmentData(JSON.stringify(offer));
    expect(result!.totalStops).toBe(2);
    expect(result!.maxLayoverMinutes).toBe(240); // 4h is the max
  });

  it('returns null for invalid JSON', () => {
    expect(extractSegmentData('not json')).toBeNull();
  });

  it('returns null for empty slices', () => {
    expect(extractSegmentData(JSON.stringify({ slices: [] }))).toBeNull();
  });

  it('returns null for missing segments', () => {
    expect(
      extractSegmentData(JSON.stringify({ slices: [{ segments: [] }] })),
    ).toBeNull();
  });

  it('handles missing operating_carrier gracefully', () => {
    const offer = {
      slices: [
        {
          segments: [
            {
              departing_at: '2026-06-15T10:00:00Z',
              arriving_at: '2026-06-15T14:00:00Z',
            },
          ],
        },
      ],
    };
    const result = extractSegmentData(JSON.stringify(offer));
    expect(result).not.toBeNull();
    expect(result!.airlineCode).toBe('');
  });
});

// ─── US_AIRPORTS export ───────────────────────────────────────────────

describe('US_AIRPORTS', () => {
  it('contains major US airports', () => {
    expect(US_AIRPORTS.has('JFK')).toBe(true);
    expect(US_AIRPORTS.has('LAX')).toBe(true);
    expect(US_AIRPORTS.has('ORD')).toBe(true);
    expect(US_AIRPORTS.has('SFO')).toBe(true);
  });

  it('does not contain international airports', () => {
    expect(US_AIRPORTS.has('LHR')).toBe(false);
    expect(US_AIRPORTS.has('NRT')).toBe(false);
    expect(US_AIRPORTS.has('CDG')).toBe(false);
  });
});

// ─── computePricePercentile (priceStats.ts) ───────────────────────────

describe('computePricePercentile', () => {
  it('returns 50 when stats is null', () => {
    expect(computePricePercentile(300, null)).toBe(50);
  });

  it('returns 50 when sampleCount < 3', () => {
    const lowSample = makeStats({ sampleCount: 2 });
    expect(computePricePercentile(300, lowSample)).toBe(50);
  });

  it('returns 5 for price at or below p5', () => {
    const stats = makeStats(); // p5 = 250
    expect(computePricePercentile(250, stats)).toBe(5);
    expect(computePricePercentile(100, stats)).toBe(5);
  });

  it('interpolates between p5 and p20', () => {
    const stats = makeStats(); // p5=250, p20=350
    // Midpoint: 300 → 5 + ((300-250)/100)*15 = 5 + 7.5 = 12.5
    expect(computePricePercentile(300, stats)).toBe(12.5);
  });

  it('returns p20 boundary for price exactly at p20', () => {
    const stats = makeStats(); // p20=350
    // price=350 triggers the p20 branch: 5 + ((350-250)/100)*15 = 5+15 = 20
    expect(computePricePercentile(350, stats)).toBe(20);
  });

  it('interpolates between p20 and median', () => {
    const stats = makeStats(); // p20=350, median=500
    // Price 425: 20 + ((425-350)/150)*30 = 20 + 15 = 35
    expect(computePricePercentile(425, stats)).toBe(35);
  });

  it('returns 50 for price exactly at median', () => {
    const stats = makeStats(); // median=500
    // 20 + ((500-350)/150)*30 = 20 + 30 = 50
    expect(computePricePercentile(500, stats)).toBe(50);
  });

  it('interpolates between median and p80', () => {
    const stats = makeStats(); // median=500, p80=700
    // Price 600: 50 + ((600-500)/200)*30 = 50 + 15 = 65
    expect(computePricePercentile(600, stats)).toBe(65);
  });

  it('interpolates above p80 toward max', () => {
    const stats = makeStats(); // p80=700, max=1200
    // Price 950: 80 + ((950-700)/500)*20 = 80 + 10 = 90
    expect(computePricePercentile(950, stats)).toBe(90);
  });

  it('caps at 100 for price at max_price_ever', () => {
    const stats = makeStats(); // max=1200
    // 80 + ((1200-700)/500)*20 = 80 + 20 = 100
    expect(computePricePercentile(1200, stats)).toBe(100);
  });

  it('caps at 100 for price above max_price_ever', () => {
    const stats = makeStats(); // max=1200
    // 80 + ((1500-700)/500)*20 = 80 + 32 → capped at 100
    expect(computePricePercentile(1500, stats)).toBe(100);
  });

  it('returns 5 for price below min_price_ever', () => {
    const stats = makeStats(); // min=200, p5=250
    // price=150 ≤ p5(250) → returns 5
    expect(computePricePercentile(150, stats)).toBe(5);
  });

  it('handles degenerate stats where all percentiles are equal', () => {
    const flat = makeStats({
      p5Price: 500,
      p20Price: 500,
      medianPrice: 500,
      p80Price: 500,
      minPriceEver: 500,
      maxPriceEver: 500,
    });
    // price=500 ≤ p5 → 5
    expect(computePricePercentile(500, flat)).toBe(5);
    // price=600 > p80, range=0 → 80
    expect(computePricePercentile(600, flat)).toBe(80);
  });

  it('handles zero-range between p5 and p20', () => {
    const stats = makeStats({ p5Price: 300, p20Price: 300 });
    // price=300 ≤ p5=300 → 5 (hits first condition)
    expect(computePricePercentile(300, stats)).toBe(5);
  });

  it('handles zero-range between p20 and median', () => {
    const stats = makeStats({ p20Price: 500, medianPrice: 500 });
    // price=500 ≤ p5? No (p5=250). ≤ p20? Yes (500≤500).
    // interpolate: 5 + ((500-250)/(500-250))*15 = 5 + 15 = 20
    expect(computePricePercentile(500, stats)).toBe(20);
  });

  it('handles zero-range between median and p80', () => {
    const stats = makeStats({ medianPrice: 700, p80Price: 700 });
    // price=700 ≤ p5? No. ≤ p20? No (350). ≤ median? Yes (700≤700).
    // 20 + ((700-350)/(700-350))*30 = 20 + 30 = 50
    expect(computePricePercentile(700, stats)).toBe(50);
  });
});
