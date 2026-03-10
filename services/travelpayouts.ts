const TRAVELPAYOUTS_TOKEN = process.env.TRAVELPAYOUTS_API_TOKEN || '';
const BASE_URL = 'https://api.travelpayouts.com';

interface CityDirectionResult {
  destination: string;
  price: number;
  airline: string;
  departureAt: string;
  returnAt: string;
}

interface CheapPriceResult {
  destination: string;
  price: number;
  airline: string;
  departureAt: string;
  returnAt: string;
  foundAt: string;
}

/**
 * Fetch most popular destinations from an origin with cheapest prices.
 * One call returns prices for many destinations — best for bulk pricing.
 */
export async function fetchCityDirections(
  origin: string,
  currency = 'USD',
): Promise<Map<string, CityDirectionResult>> {
  const results = new Map<string, CityDirectionResult>();
  if (!TRAVELPAYOUTS_TOKEN) return results;

  try {
    const res = await fetch(
      `${BASE_URL}/v1/city-directions?origin=${origin}&currency=${currency}&market=us`,
      { headers: { 'X-Access-Token': TRAVELPAYOUTS_TOKEN } },
    );
    if (!res.ok) {
      console.warn(`[travelpayouts] city-directions ${origin}: ${res.status}`);
      return results;
    }
    const json = (await res.json()) as {
      success: boolean;
      data: Record<string, {
        price: number;
        destination: string;
        airline: string;
        departure_at: string;
        return_at: string;
      }>;
    };
    if (json.success && json.data) {
      for (const [iata, item] of Object.entries(json.data)) {
        results.set(iata, {
          destination: item.destination,
          price: Math.round(item.price),
          airline: item.airline || '',
          departureAt: item.departure_at || '',
          returnAt: item.return_at || '',
        });
      }
    }
  } catch (err) {
    console.error('[travelpayouts] city-directions error:', err);
  }
  return results;
}

/**
 * Fetch cheapest tickets for a specific origin → destination route.
 * Use as fallback when city-directions doesn't cover a destination.
 */
export async function fetchCheapPrices(
  origin: string,
  destination: string,
  currency = 'USD',
): Promise<CheapPriceResult | null> {
  if (!TRAVELPAYOUTS_TOKEN) return null;

  try {
    const res = await fetch(
      `${BASE_URL}/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=${currency}&market=us`,
      { headers: { 'X-Access-Token': TRAVELPAYOUTS_TOKEN } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success: boolean;
      data: Record<string, Record<string, {
        price: number;
        airline: string;
        departure_at: string;
        return_at: string;
        found_at: string;
      }>>;
    };
    if (!json.success || !json.data?.[destination]) return null;

    const routes = json.data[destination];
    // Get the cheapest entry across all date keys
    let cheapest: CheapPriceResult | null = null;
    for (const entry of Object.values(routes)) {
      if (!cheapest || entry.price < cheapest.price) {
        cheapest = {
          destination,
          price: Math.round(entry.price),
          airline: entry.airline || '',
          departureAt: entry.departure_at || '',
          returnAt: entry.return_at || '',
          foundAt: entry.found_at || '',
        };
      }
    }
    return cheapest;
  } catch (err) {
    console.error(`[travelpayouts] cheap-prices ${origin}->${destination} error:`, err);
    return null;
  }
}

/**
 * Fetch latest 48h cached prices from an origin.
 * Good supplementary data source for broad coverage.
 */
export async function fetchLatestPrices(
  origin: string,
  currency = 'USD',
): Promise<Map<string, { destination: string; price: number; airline: string }>> {
  const results = new Map<string, { destination: string; price: number; airline: string }>();
  if (!TRAVELPAYOUTS_TOKEN) return results;

  try {
    const res = await fetch(
      `${BASE_URL}/v2/prices/latest?origin=${origin}&period_type=year&limit=50&show_to_affiliates=true&sorting=price&currency=${currency}&market=us`,
      { headers: { 'X-Access-Token': TRAVELPAYOUTS_TOKEN } },
    );
    if (!res.ok) return results;
    const json = (await res.json()) as {
      success: boolean;
      data: Array<{
        destination: string;
        value: number;
        airline: string;
      }>;
    };
    if (json.success && json.data) {
      for (const item of json.data) {
        if (!results.has(item.destination)) {
          results.set(item.destination, {
            destination: item.destination,
            price: Math.round(item.value),
            airline: item.airline || '',
          });
        }
      }
    }
  } catch (err) {
    console.error('[travelpayouts] latest-prices error:', err);
  }
  return results;
}

/**
 * Fetch cheapest flights from an origin to ALL destinations in one call.
 * Uses destination=- wildcard — returns 100+ routes per origin.
 */
export async function fetchAllCheapPrices(
  origin: string,
  currency = 'USD',
): Promise<Map<string, CheapPriceResult>> {
  const results = new Map<string, CheapPriceResult>();
  if (!TRAVELPAYOUTS_TOKEN) return results;

  try {
    const res = await fetch(
      `${BASE_URL}/v1/prices/cheap?origin=${origin}&destination=-&currency=${currency}&market=us`,
      { headers: { 'X-Access-Token': TRAVELPAYOUTS_TOKEN } },
    );
    if (!res.ok) {
      console.warn(`[travelpayouts] all-cheap-prices ${origin}: ${res.status}`);
      return results;
    }
    const json = (await res.json()) as {
      success: boolean;
      data: Record<string, Record<string, {
        price: number;
        airline: string;
        departure_at: string;
        return_at: string;
        found_at: string;
      }>>;
    };
    if (!json.success || !json.data) return results;

    for (const [iata, routes] of Object.entries(json.data)) {
      let cheapest: CheapPriceResult | null = null;
      for (const entry of Object.values(routes)) {
        if (!cheapest || entry.price < cheapest.price) {
          cheapest = {
            destination: iata,
            price: Math.round(entry.price),
            airline: entry.airline || '',
            departureAt: entry.departure_at || '',
            returnAt: entry.return_at || '',
            foundAt: entry.found_at || '',
          };
        }
      }
      if (cheapest) results.set(iata, cheapest);
    }
    console.log(`[travelpayouts] bulk discovery ${origin}: ${results.size} destinations`);
  } catch (err) {
    console.error('[travelpayouts] all-cheap-prices error:', err);
  }
  return results;
}

export interface MonthlyPriceEntry {
  month: string;
  price: number;
  airline: string;
  transferCount: number;
}

/**
 * Fetch cheapest price per month for a route over the next year.
 */
export async function fetchMonthlyPrices(
  origin: string,
  destination: string,
  currency = 'USD',
): Promise<MonthlyPriceEntry[]> {
  if (!TRAVELPAYOUTS_TOKEN) return [];

  try {
    const res = await fetch(
      `${BASE_URL}/v1/prices/monthly?origin=${origin}&destination=${destination}&currency=${currency}&market=us`,
      { headers: { 'X-Access-Token': TRAVELPAYOUTS_TOKEN } },
    );
    if (!res.ok) {
      console.warn(`[travelpayouts] monthly-prices ${origin}->${destination}: ${res.status}`);
      return [];
    }
    const json = (await res.json()) as {
      success: boolean;
      data: Record<string, {
        price: number;
        airline: string;
        transfers: number;
        departure_at: string;
      }>;
    };
    if (!json.success || !json.data) return [];

    return Object.values(json.data).map((entry) => ({
      month: entry.departure_at?.slice(0, 7) || '',
      price: Math.round(entry.price),
      airline: entry.airline || '',
      transferCount: entry.transfers ?? 0,
    })).sort((a, b) => a.month.localeCompare(b.month));
  } catch (err) {
    console.error(`[travelpayouts] monthly-prices ${origin}->${destination} error:`, err);
    return [];
  }
}

export interface BudgetFlightResult {
  destination: string;
  origin: string;
  price: number;
  airline: string;
  departureDate: string;
  returnDate: string;
  transfers: number;
  tripDuration: number;
  gate: string;
}

/**
 * Fetch flights within a price range from origin to all destinations.
 * Uses the v3 search_by_price_range endpoint — great for "flights under $200".
 */
export async function fetchByPriceRange(
  origin: string,
  minPrice: number,
  maxPrice: number,
  currency = 'usd',
): Promise<BudgetFlightResult[]> {
  if (!TRAVELPAYOUTS_TOKEN) return [];

  try {
    const res = await fetch(
      `${BASE_URL}/aviasales/v3/search_by_price_range?origin=${origin}&destination=-&value_min=${minPrice}&value_max=${maxPrice}&currency=${currency}&market=us&limit=50&sorting=price`,
      { headers: { 'X-Access-Token': TRAVELPAYOUTS_TOKEN } },
    );
    if (!res.ok) {
      console.warn(`[travelpayouts] price-range ${origin} $${minPrice}-$${maxPrice}: ${res.status}`);
      return [];
    }
    const json = (await res.json()) as {
      success: boolean;
      data: Array<{
        destination: string;
        origin: string;
        value: number;
        gate: string;
        depart_date: string;
        return_date: string;
        number_of_changes: number;
        trip_duration: number;
        airline: string;
      }>;
    };
    if (!json.success || !json.data) return [];

    return json.data.map((d) => ({
      destination: d.destination,
      origin: d.origin,
      price: d.value,
      airline: d.airline || '',
      departureDate: d.depart_date || '',
      returnDate: d.return_date || '',
      transfers: d.number_of_changes ?? 0,
      tripDuration: d.trip_duration ?? 0,
      gate: d.gate || '',
    }));
  } catch (err) {
    console.error(`[travelpayouts] price-range error:`, err);
    return [];
  }
}

export interface WeekMatrixEntry {
  departDate: string;
  returnDate: string;
  price: number;
  airline: string;
  transfers: number;
}

/**
 * Fetch week flexibility matrix: prices for ±3 days around chosen dates.
 * Returns sorted by price (cheapest first).
 */
export async function fetchWeekMatrix(
  origin: string,
  destination: string,
  departDate: string,
  returnDate: string,
  currency = 'USD',
): Promise<WeekMatrixEntry[]> {
  if (!TRAVELPAYOUTS_TOKEN) return [];

  try {
    const res = await fetch(
      `${BASE_URL}/v2/prices/week-matrix?origin=${origin}&destination=${destination}&depart_date=${departDate}&return_date=${returnDate}&currency=${currency}&market=us`,
      { headers: { 'X-Access-Token': TRAVELPAYOUTS_TOKEN } },
    );
    if (!res.ok) {
      console.warn(`[travelpayouts] week-matrix ${origin}->${destination}: ${res.status}`);
      return [];
    }
    const json = (await res.json()) as {
      success: boolean;
      data: Array<{
        depart_date: string;
        return_date: string;
        value: number;
        airline: string;
        number_of_changes: number;
      }>;
    };
    if (!json.success || !json.data) return [];

    return json.data
      .map((entry) => ({
        departDate: entry.depart_date || '',
        returnDate: entry.return_date || '',
        price: Math.round(entry.value),
        airline: entry.airline || '',
        transfers: entry.number_of_changes ?? 0,
      }))
      .sort((a, b) => a.price - b.price);
  } catch (err) {
    console.error(`[travelpayouts] week-matrix ${origin}->${destination} error:`, err);
    return [];
  }
}

/**
 * Detect nearest airport from user's IP address using Travelpayouts geolocation.
 * Returns null on failure (graceful fallback).
 */
export async function detectOriginAirport(
  ip: string,
): Promise<{ iata: string; name: string; country: string } | null> {
  try {
    const res = await fetch(
      `http://www.travelpayouts.com/whereami?locale=en&ip=${encodeURIComponent(ip)}`,
    );
    if (!res.ok) {
      console.warn(`[travelpayouts] whereami ${ip}: ${res.status}`);
      return null;
    }
    const json = (await res.json()) as {
      iata?: string;
      name?: string;
      country_name?: string;
    };
    if (!json.iata) return null;

    return {
      iata: json.iata,
      name: json.name || '',
      country: json.country_name || '',
    };
  } catch (err) {
    console.error('[travelpayouts] whereami error:', err);
    return null;
  }
}

export interface PriceCalendarEntry {
  date: string;
  price: number;
  airline: string;
  transferCount: number;
}

/**
 * Fetch daily price calendar for a specific route.
 * Returns prices by departure date for the given (or current) month.
 */
export async function fetchPriceCalendar(
  origin: string,
  destination: string,
  currency = 'USD',
  month?: string,
): Promise<PriceCalendarEntry[]> {
  if (!TRAVELPAYOUTS_TOKEN) return [];

  try {
    let url = `${BASE_URL}/v1/prices/calendar?origin=${origin}&destination=${destination}&calendar_type=departure_date&currency=${currency}&market=us`;
    if (month) url += `&depart_date=${month}`;

    const res = await fetch(url, {
      headers: { 'X-Access-Token': TRAVELPAYOUTS_TOKEN },
    });
    if (!res.ok) {
      console.warn(`[travelpayouts] price-calendar ${origin}->${destination}: ${res.status}`);
      return [];
    }
    const json = (await res.json()) as {
      success: boolean;
      data: Record<string, {
        price: number;
        airline: string;
        transfers: number;
        departure_at: string;
      }>;
    };
    if (!json.success || !json.data) return [];

    return Object.values(json.data).map((entry) => ({
      date: entry.departure_at?.split('T')[0] || '',
      price: Math.round(entry.price),
      airline: entry.airline || '',
      transferCount: entry.transfers ?? 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error(`[travelpayouts] price-calendar ${origin}->${destination} error:`, err);
    return [];
  }
}
