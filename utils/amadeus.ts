// Amadeus Self-Service API client
// Uses flight-offers endpoint (flight-destinations is unreliable on test sandbox)

const BASE_URL = 'https://test.api.amadeus.com';

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(apiKey: string, apiSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
  });

  if (!res.ok) throw new Error(`Amadeus auth failed: ${res.status}`);

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface FlightOffer {
  destination: string;
  price: number;
  currency: string;
  airline: string;
  duration: string;
  departureDate: string;
}

export async function getFlightPrice(
  token: string,
  origin: string,
  destination: string,
  departureDate: string,
): Promise<FlightOffer | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=1&max=1&currencyCode=USD`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const offer = data.data?.[0];
    if (!offer) return null;

    const price = parseFloat(offer.price.grandTotal);
    const currency = offer.price.currency;
    const segment = offer.itineraries?.[0]?.segments?.[0];
    const airline = data.dictionaries?.carriers?.[segment?.carrierCode] || segment?.carrierCode || '';
    const duration = offer.itineraries?.[0]?.duration || '';

    return {
      destination,
      price: Math.round(price),
      currency,
      airline,
      duration: formatDuration(duration),
      departureDate,
    };
  } catch {
    return null;
  }
}

function formatDuration(iso: string): string {
  // PT21H25M → 21h 25m
  const match = iso.match(/PT(\d+H)?(\d+M)?/);
  if (!match) return '';
  const hours = match[1] ? match[1].replace('H', 'h') : '';
  const mins = match[2] ? ` ${match[2].replace('M', 'm')}` : '';
  return `${hours}${mins}`.trim();
}

// Batch fetch prices for multiple destinations with concurrency limit
export async function batchGetPrices(
  token: string,
  origin: string,
  destinations: string[],
  departureDate: string,
  concurrency = 3,
): Promise<Map<string, FlightOffer>> {
  const results = new Map<string, FlightOffer>();
  const queue = [...destinations];

  async function worker() {
    while (queue.length > 0) {
      const dest = queue.shift();
      if (!dest) break;
      const offer = await getFlightPrice(token, origin, dest, departureDate);
      if (offer) results.set(dest, offer);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
