import { destinations } from '../data/destinations';
import { getAirlineName } from './airlines';
import { generateAviasalesLink } from './affiliateLinks';
import type { BoardDeal } from '../types/deal';

const AIRLINE_CODES = ['AA', 'DL', 'UA', 'B6', 'NK', 'AS', 'WN', 'F9', 'BA', 'LH', 'AF', 'KL'];
const STATUSES: BoardDeal['status'][] = ['DEAL', 'HOT', 'NEW'];

function randomTime(): string {
  const h = String(Math.floor(Math.random() * 14) + 6).padStart(2, '0');
  const m = String(Math.floor(Math.random() * 12) * 5).padStart(2, '0');
  return `${h}:${m}`;
}

function randomFlightCode(): { code: string; airline: string; iata: string } {
  const iata = AIRLINE_CODES[Math.floor(Math.random() * AIRLINE_CODES.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return { code: `${iata}${num}`, airline: getAirlineName(iata), iata };
}

function futureDatePair(): { dep: string; ret: string; days: number } {
  const now = Date.now();
  const offset = Math.floor(Math.random() * 120 + 14) * 86400000;
  const dep = new Date(now + offset);
  const days = Math.floor(Math.random() * 6) + 3;
  const ret = new Date(dep.getTime() + days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dep: fmt(dep), ret: fmt(ret), days };
}

/**
 * Convert static destination data into BoardDeal[] for stub/offline mode.
 */
export function generateStubDeals(originCode: string = 'TPA'): BoardDeal[] {
  return destinations.map((dest) => {
    const flight = randomFlightCode();
    const dates = futureDatePair();
    const price = dest.flightPrice || Math.floor(Math.random() * 800) + 150;

    return {
      id: dest.id,
      departureTime: randomTime(),
      destination: dest.city.toUpperCase().slice(0, 12),
      destinationFull: dest.city,
      country: dest.country,
      iataCode: dest.iataCode,
      flightCode: flight.code,
      price,
      priceFormatted: `$${price}`,
      status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
      airline: flight.airline,
      departureDate: dates.dep,
      returnDate: dates.ret,
      tripDays: dates.days,
      flightDuration: dest.flightDuration || '8h 30m',
      vibeTags: dest.vibeTags || [],
      imageUrl: dest.imageUrl,
      tagline: dest.tagline,
      description: dest.description,
      affiliateUrl: generateAviasalesLink(originCode, dest.iataCode, dates.dep, dates.ret),
      itinerary: dest.itinerary,
      restaurants: dest.restaurants,
    };
  });
}
