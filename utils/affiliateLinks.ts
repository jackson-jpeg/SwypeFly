// Affiliate link builders — Travelpayouts integration
// Falls back to direct links when no marker is configured

const TP_BASE = 'https://tp.media/r';

/**
 * Build a flight search affiliate link.
 * Uses WayAway/Aviasales via Travelpayouts when marker is set,
 * otherwise falls back to Google Flights.
 */
export function flightLink(origin: string, destIata: string, marker: string): string {
  const date = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  if (marker) {
    const target = `https://www.aviasales.com/search/${origin}${date.replace(/-/g, '')}${destIata}1`;
    return `${TP_BASE}?marker=${marker}&p=4114&u=${encodeURIComponent(target)}&subid=${destIata}&subid2=detail_view`;
  }

  return `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destIata}&d=${date}&curr=USD`;
}

/**
 * Build a hotel search affiliate link.
 * Uses Booking.com via Travelpayouts when marker is set,
 * otherwise falls back to direct Booking.com link.
 */
export function hotelLink(city: string, country: string, marker: string): string {
  const checkin = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const checkout = new Date(Date.now() + 37 * 86400000).toISOString().split('T')[0];
  const query = encodeURIComponent(`${city}, ${country}`);

  const directUrl = `https://www.booking.com/searchresults.html?ss=${query}&checkin=${checkin}&checkout=${checkout}`;

  if (marker) {
    return `${TP_BASE}?marker=${marker}&p=501&u=${encodeURIComponent(directUrl)}&subid=${encodeURIComponent(city)}&subid2=detail_view`;
  }

  return directUrl;
}

/**
 * Build an activities/things-to-do affiliate link.
 * Uses Viator via Travelpayouts when marker is set,
 * otherwise falls back to TripAdvisor.
 */
export function activitiesLink(city: string, country: string, marker: string): string {
  const query = encodeURIComponent(`${city} ${country}`);

  if (marker) {
    const target = `https://www.viator.com/searchResults/all?text=${query}`;
    return `${TP_BASE}?marker=${marker}&p=3611&u=${encodeURIComponent(target)}&subid=${encodeURIComponent(city)}&subid2=detail_view`;
  }

  return `https://www.tripadvisor.com/Search?q=${query}&searchSessionId=things+to+do`;
}
