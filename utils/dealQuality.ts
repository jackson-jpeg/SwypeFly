/**
 * Deal Quality Engine — hard rejection filters + composite scoring.
 *
 * Used by price refresh crons to gate what enters cached_prices / price_calendar,
 * and by the feed to sort by deal_score instead of raw price.
 *
 * Travelpayouts data is sparse (no stops/layovers), so many fields are optional.
 * When segment data is unavailable, quality scoring skips stop/layover penalties
 * and the hard filters that require them.
 */

// ─── US domestic airport codes (for isDomestic detection) ────────────

const US_AIRPORTS = new Set([
  'ATL', 'LAX', 'ORD', 'DFW', 'DEN', 'JFK', 'SFO', 'SEA', 'LAS', 'MCO',
  'MIA', 'CLT', 'EWR', 'PHX', 'IAH', 'BOS', 'MSP', 'DTW', 'FLL', 'PHL',
  'LGA', 'BWI', 'SLC', 'DCA', 'IAD', 'SAN', 'TPA', 'HNL', 'PDX', 'STL',
  'BNA', 'AUS', 'OAK', 'MSY', 'RDU', 'SJC', 'SMF', 'SNA', 'MCI', 'IND',
  'CLE', 'PIT', 'CMH', 'SAT', 'RSW', 'BDL', 'JAX', 'ABQ', 'OKC', 'MEM',
  'RIC', 'BUF', 'ONT', 'SDF', 'PVD', 'GRR', 'TUL', 'OMA', 'BHM', 'BOI',
  'ANC', 'PBI', 'PIE', 'SRQ', 'DAL', 'HOU', 'MDW', 'BUR', 'PSP', 'CHS',
  'SAV', 'MYR', 'DSM', 'LIT', 'GSP', 'SYR', 'ROC', 'PWM', 'MHT', 'ALB',
]);

// ─── Ultra-low-cost and major carrier classification ─────────────────

const ULCC_CODES = new Set(['NK', 'F9', 'G4', 'XP', 'VB']); // Spirit, Frontier, Allegiant, Avelo, VivaAerobus
const MAJOR_CARRIER_CODES = new Set([
  'DL', 'UA', 'AA', 'B6', 'WN', 'AS', // US majors
  'BA', 'LH', 'AF', 'KL', 'IB', 'SK', // EU majors
  'NH', 'JL', 'SQ', 'CX', 'QF', 'EK', 'QR', 'TK', // Intl majors
]);

// ─── Estimated direct flight times (minutes) from major US hubs ──────
// Rough great-circle estimates for popular routes. Used for the 3× travel
// time rejection filter. Routes not listed skip that filter.

const DIRECT_FLIGHT_ESTIMATES: Record<string, number> = {
  // Domestic — use higher estimate (cross-country, not just regional hops)
  'US-US': 270,       // ~4.5h avg (covers BOS-LAX, JFK-SFO etc)
  'US-HI': 600,       // ~10h (Hawaii from mainland)
  // Transatlantic
  'US-EU': 540,       // ~9h
  'US-UK': 480,       // ~8h
  // Caribbean / Central America
  'US-CB': 210,       // ~3.5h
  'US-MX': 240,       // ~4h
  'US-CA': 300,       // ~5h (Central America)
  // South America
  'US-SA': 600,       // ~10h (was 9h — covers southern cone)
  // Asia
  'US-AS': 840,       // ~14h
  // Middle East
  'US-ME': 720,       // ~12h
  // Africa
  'US-AF': 720,       // ~12h (was 11h — covers South Africa)
  // Oceania
  'US-OC': 960,       // ~16h
};

const HAWAII_AIRPORTS = new Set(['HNL', 'OGG', 'KOA', 'LIH']);

function getRegionCode(iata: string, country?: string): string {
  if (HAWAII_AIRPORTS.has(iata)) return 'HI';
  if (US_AIRPORTS.has(iata)) return 'US';
  // Rough mapping — could be refined with a full DB lookup
  const c = (country || '').toLowerCase();
  if (['uk', 'united kingdom', 'england', 'scotland', 'wales', 'ireland'].some(x => c.includes(x))) return 'UK';
  if (['mexico'].includes(c)) return 'MX';
  if (['jamaica', 'bahamas', 'dominican republic', 'cuba', 'puerto rico', 'aruba', 'curacao',
       'barbados', 'trinidad', 'st lucia', 'antigua', 'cayman', 'turks', 'bermuda', 'usvi',
       'u.s. virgin islands', 'bonaire', 'grenada', 'st kitts', 'martinique'].some(x => c.includes(x))) return 'CB';
  if (['costa rica', 'panama', 'guatemala', 'belize', 'honduras', 'el salvador', 'nicaragua'].some(x => c.includes(x))) return 'CA';
  if (['brazil', 'argentina', 'colombia', 'peru', 'chile', 'ecuador', 'bolivia', 'uruguay', 'paraguay', 'venezuela'].some(x => c.includes(x))) return 'SA';
  if (['japan', 'china', 'south korea', 'thailand', 'vietnam', 'indonesia', 'singapore', 'malaysia',
       'philippines', 'india', 'sri lanka', 'nepal', 'taiwan', 'cambodia', 'myanmar', 'laos', 'maldives'].some(x => c.includes(x))) return 'AS';
  if (['uae', 'united arab emirates', 'qatar', 'israel', 'jordan', 'oman', 'saudi arabia', 'bahrain', 'kuwait', 'lebanon'].some(x => c.includes(x))) return 'ME';
  if (['morocco', 'south africa', 'egypt', 'kenya', 'tanzania', 'nigeria', 'ghana', 'ethiopia', 'senegal', 'tunisia'].some(x => c.includes(x))) return 'AF';
  if (['australia', 'new zealand', 'fiji'].some(x => c.includes(x))) return 'OC';
  // Default to EU for European/unmatched countries
  return 'EU';
}

function estimateDirectMinutes(originIata: string, destIata: string, destCountry?: string): number | null {
  const originRegion = US_AIRPORTS.has(originIata) ? 'US' : null;
  if (!originRegion) return null; // Only estimate from US origins
  const destRegion = getRegionCode(destIata, destCountry);
  const key = `${originRegion}-${destRegion}`;
  return DIRECT_FLIGHT_ESTIMATES[key] ?? null;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface DealQualityInput {
  originIata: string;
  destinationIata: string;
  price: number;
  departureDate: string;          // YYYY-MM-DD
  returnDate: string;             // YYYY-MM-DD
  // Segment-level data (available from Duffel, not from Travelpayouts)
  totalStops?: number;
  totalTravelTimeMinutes?: number;
  maxLayoverMinutes?: number;
  // Contextual data
  isDomestic?: boolean;           // auto-detected if not provided
  destinationCountry?: string;    // for region estimation
  airline?: string;               // IATA carrier code
  departureHour?: number;         // 0-23, for red-eye detection
  // For price percentile (from priceStats)
  pricePercentile?: number;       // 0-100, provided externally
  // From destination metadata
  popularityScore?: number;       // 0-1
  bestMonths?: string[];          // e.g. ['June', 'July']
  foundAt?: string;               // ISO timestamp when price was discovered
}

export interface DealQualityResult {
  pass: boolean;
  rejectReason: string | null;
  qualityScore: number;   // 0-100 (trip quality)
  dealScore: number;       // 0-100 (composite)
  dealTier: 'amazing' | 'great' | 'good' | 'fair' | 'rejected';
  pricePercentile: number; // 0-100
  savingsPercent: number;  // 0-100, vs median
}

// ─── Hard rejection filters ─────────────────────────────────────────

function hardReject(input: DealQualityInput): string | null {
  // Price sanity
  if (input.price <= 0) return 'price_zero_or_negative';

  // Same origin and destination
  if (input.originIata === input.destinationIata) return 'same_origin_destination';

  // Departure in the past
  const today = new Date().toISOString().split('T')[0];
  if (input.departureDate < today) return 'departure_in_past';

  // Trip duration
  const dep = new Date(input.departureDate + 'T00:00:00Z');
  const ret = new Date(input.returnDate + 'T00:00:00Z');
  const tripDays = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));

  const isDomestic = input.isDomestic ?? (US_AIRPORTS.has(input.originIata) && US_AIRPORTS.has(input.destinationIata));

  if (isDomestic && tripDays < 2) return 'trip_too_short_domestic';
  if (!isDomestic && tripDays < 3) return 'trip_too_short_international';

  // Segment-based filters (only when data is available)
  if (input.totalStops != null) {
    if (isDomestic && input.totalStops > 1) return 'too_many_stops_domestic';
    if (!isDomestic && input.totalStops > 2) return 'too_many_stops_international';
  }

  if (input.maxLayoverMinutes != null && input.maxLayoverMinutes > 480) {
    return 'layover_too_long';
  }

  if (input.totalTravelTimeMinutes != null) {
    const directEst = estimateDirectMinutes(input.originIata, input.destinationIata, input.destinationCountry);
    if (directEst && input.totalTravelTimeMinutes > directEst * 3.5) {
      return 'travel_time_excessive';
    }
  }

  return null;
}

// ─── Quality score (trip quality, 0-100) ─────────────────────────────

function computeQualityScore(input: DealQualityInput): number {
  let score = 100;

  // Stop penalties
  if (input.totalStops != null) {
    score -= input.totalStops * 15;
    if (input.totalStops === 0) score += 15; // nonstop bonus
  }

  // Layover penalties (approximate — we only have max, not per-leg)
  if (input.maxLayoverMinutes != null) {
    if (input.maxLayoverMinutes >= 240) score -= 15; // 4-8h
    else if (input.maxLayoverMinutes >= 120) score -= 5; // 2-4h
  }

  // Red-eye penalty
  if (input.departureHour != null) {
    if (input.departureHour >= 23 || input.departureHour < 5) score -= 10;
    else if (input.departureHour >= 7 && input.departureHour <= 10) score += 5; // morning bonus
  }

  // Carrier quality
  if (input.airline) {
    const code = input.airline.toUpperCase().slice(0, 2);
    if (ULCC_CODES.has(code)) score -= 10;
    else if (MAJOR_CARRIER_CODES.has(code)) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Recency score ───────────────────────────────────────────────────

function computeRecencyScore(foundAt?: string): number {
  if (!foundAt) return 50; // Unknown recency — neutral
  const ageMs = Date.now() - new Date(foundAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) return 100;
  if (ageHours < 6) return 80;
  if (ageHours < 24) return 50;
  if (ageHours < 48) return 20;
  return 5;
}

// ─── Season score ────────────────────────────────────────────────────

function computeSeasonScore(bestMonths?: string[]): number {
  if (!bestMonths || bestMonths.length === 0) return 60; // No data — slightly above neutral

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const currentMonth = new Date().getMonth(); // 0-indexed
  const currentName = monthNames[currentMonth];
  const adjacentNames = [
    monthNames[(currentMonth + 11) % 12],
    monthNames[(currentMonth + 1) % 12],
  ];

  const bestLower = bestMonths.map(m => m.toLowerCase());

  if (bestLower.includes(currentName)) return 100;
  if (adjacentNames.some(m => bestLower.includes(m))) return 70;
  return 40;
}

// ─── Deal tier classification ────────────────────────────────────────

function classifyDealTier(dealScore: number): DealQualityResult['dealTier'] {
  // Tightened thresholds: "amazing" should be top ~10%, not top 50%
  if (dealScore >= 90) return 'amazing';
  if (dealScore >= 75) return 'great';
  if (dealScore >= 55) return 'good';
  if (dealScore >= 30) return 'fair';
  return 'rejected';
}

// ─── Main evaluation function ────────────────────────────────────────

export function evaluateDealQuality(input: DealQualityInput): DealQualityResult {
  // Hard filters
  const rejectReason = hardReject(input);
  if (rejectReason) {
    return {
      pass: false,
      rejectReason,
      qualityScore: 0,
      dealScore: 0,
      dealTier: 'rejected',
      pricePercentile: 0,
      savingsPercent: 0,
    };
  }

  const qualityScore = computeQualityScore(input);
  const pricePercentile = input.pricePercentile ?? 50; // Default to median if no history
  const recencyScore = computeRecencyScore(input.foundAt);
  const seasonScore = computeSeasonScore(input.bestMonths);
  const popularityScore = Math.round((input.popularityScore ?? 0.5) * 100);

  // Price score: inverse of percentile (lower percentile = better deal)
  const priceScore = Math.max(0, 100 - pricePercentile);

  // Composite deal score — quality weighted heavily to avoid painful flights
  const dealScore = Math.min(100, Math.max(0, Math.round(
    priceScore * 0.30 +
    qualityScore * 0.35 +
    popularityScore * 0.10 +
    recencyScore * 0.15 +
    seasonScore * 0.10
  )));

  // Savings percent: how far below median (percentile 50 = 0% savings)
  const savingsPercent = pricePercentile < 50
    ? Math.round((50 - pricePercentile) * 2) // 0th percentile = 100% savings
    : 0;

  const dealTier = classifyDealTier(dealScore);

  return {
    pass: dealTier !== 'rejected',
    rejectReason: null,
    qualityScore,
    dealScore,
    dealTier,
    pricePercentile,
    savingsPercent,
  };
}

// ─── Helpers for extracting segment data from Duffel offer JSON ──────

export interface SegmentData {
  totalStops: number;
  totalTravelTimeMinutes: number;
  maxLayoverMinutes: number;
  departureHour: number;
  airlineCode: string;
  isNonstop: boolean;
}

/**
 * Parse Duffel offer JSON (compact format from refresh.ts) to extract
 * segment-level data needed for deal quality scoring.
 */
export function extractSegmentData(offerJson: string): SegmentData | null {
  try {
    const offer = JSON.parse(offerJson);
    const slices = offer.slices;
    if (!slices || slices.length === 0) return null;

    // Outbound slice (first slice)
    const outbound = slices[0];
    const segments = outbound.segments;
    if (!segments || segments.length === 0) return null;

    const totalStops = segments.length - 1;
    const isNonstop = totalStops === 0;

    // Total travel time: first departure to last arrival
    const firstDep = new Date(segments[0].departing_at);
    const lastArr = new Date(segments[segments.length - 1].arriving_at);
    const totalTravelTimeMinutes = Math.round((lastArr.getTime() - firstDep.getTime()) / 60000);

    // Max layover between consecutive segments
    let maxLayoverMinutes = 0;
    for (let i = 1; i < segments.length; i++) {
      const prevArr = new Date(segments[i - 1].arriving_at);
      const nextDep = new Date(segments[i].departing_at);
      const layover = Math.round((nextDep.getTime() - prevArr.getTime()) / 60000);
      maxLayoverMinutes = Math.max(maxLayoverMinutes, layover);
    }

    const departureHour = firstDep.getHours();
    const airlineCode = segments[0].operating_carrier?.iata_code || '';

    return {
      totalStops,
      totalTravelTimeMinutes,
      maxLayoverMinutes,
      departureHour,
      airlineCode,
      isNonstop,
    };
  } catch {
    return null;
  }
}

export { US_AIRPORTS };
