const LITEAPI_KEY = process.env.LITEAPI_API_KEY || '';
const BASE_URL = 'https://api.liteapi.travel/v3.0';

interface HotelRateResult {
  cityCode: string;
  minPrice: number;
  currency: string;
  hotelCount: number;
}

/**
 * Fetch minimum hotel rates for a city from LiteAPI.
 * Returns the cheapest nightly rate found across available hotels.
 */
export async function fetchHotelRates(
  cityCode: string,
  checkinDate: string,
  checkoutDate: string,
): Promise<HotelRateResult | null> {
  if (!LITEAPI_KEY) return null;

  try {
    const params = new URLSearchParams({
      cityCode,
      checkin: checkinDate,
      checkout: checkoutDate,
      adults: '2',
      currency: 'USD',
      limit: '20',
    });

    const res = await fetch(`${BASE_URL}/hotels?${params}`, {
      headers: { 'X-API-Key': LITEAPI_KEY },
    });

    if (!res.ok) {
      console.warn(`[liteapi] hotels ${cityCode}: ${res.status}`);
      return null;
    }

    const json = (await res.json()) as {
      data?: Array<{
        minRate?: number;
        currency?: string;
      }>;
    };

    if (!json.data || json.data.length === 0) return null;

    // Find minimum rate across all returned hotels
    let minPrice = Infinity;
    let currency = 'USD';
    let count = 0;

    for (const hotel of json.data) {
      if (hotel.minRate != null && hotel.minRate > 0) {
        count++;
        if (hotel.minRate < minPrice) {
          minPrice = hotel.minRate;
          currency = hotel.currency || 'USD';
        }
      }
    }

    if (count === 0) return null;

    return {
      cityCode,
      minPrice: Math.round(minPrice),
      currency,
      hotelCount: count,
    };
  } catch (err) {
    console.error(`[liteapi] hotels ${cityCode} error:`, err);
    return null;
  }
}
