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
      `${BASE_URL}/v1/city-directions?origin=${origin}&currency=${currency}`,
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
      `${BASE_URL}/v1/prices/cheap?origin=${origin}&destination=${destination}&currency=${currency}`,
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
      `${BASE_URL}/v2/prices/latest?origin=${origin}&period_type=year&limit=50&show_to_affiliates=true&sorting=price&currency=${currency}`,
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
