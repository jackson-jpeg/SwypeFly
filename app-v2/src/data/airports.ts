// Top ~80 departure airports covering major US + international hubs
// Sorted by typical passenger volume for better default ordering

export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
}

export const AIRPORTS: Airport[] = [
  // US Major Hubs
  { code: 'ATL', city: 'Atlanta', name: 'Hartsfield-Jackson', country: 'US' },
  { code: 'DFW', city: 'Dallas', name: 'Dallas/Fort Worth', country: 'US' },
  { code: 'DEN', city: 'Denver', name: 'Denver International', country: 'US' },
  { code: 'ORD', city: 'Chicago', name: "O'Hare International", country: 'US' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International', country: 'US' },
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy', country: 'US' },
  { code: 'EWR', city: 'Newark', name: 'Newark Liberty', country: 'US' },
  { code: 'LGA', city: 'New York', name: 'LaGuardia', country: 'US' },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco International', country: 'US' },
  { code: 'SEA', city: 'Seattle', name: 'Seattle-Tacoma', country: 'US' },
  { code: 'MIA', city: 'Miami', name: 'Miami International', country: 'US' },
  { code: 'MCO', city: 'Orlando', name: 'Orlando International', country: 'US' },
  { code: 'CLT', city: 'Charlotte', name: 'Charlotte Douglas', country: 'US' },
  { code: 'PHX', city: 'Phoenix', name: 'Phoenix Sky Harbor', country: 'US' },
  { code: 'IAH', city: 'Houston', name: 'George Bush Intercontinental', country: 'US' },
  { code: 'BOS', city: 'Boston', name: 'Logan International', country: 'US' },
  { code: 'MSP', city: 'Minneapolis', name: 'Minneapolis-Saint Paul', country: 'US' },
  { code: 'DTW', city: 'Detroit', name: 'Detroit Metropolitan', country: 'US' },
  { code: 'FLL', city: 'Fort Lauderdale', name: 'Fort Lauderdale-Hollywood', country: 'US' },
  { code: 'PHL', city: 'Philadelphia', name: 'Philadelphia International', country: 'US' },
  { code: 'IAD', city: 'Washington', name: 'Dulles International', country: 'US' },
  { code: 'DCA', city: 'Washington', name: 'Reagan National', country: 'US' },
  { code: 'BWI', city: 'Baltimore', name: 'Baltimore/Washington', country: 'US' },
  { code: 'SLC', city: 'Salt Lake City', name: 'Salt Lake City International', country: 'US' },
  { code: 'SAN', city: 'San Diego', name: 'San Diego International', country: 'US' },
  { code: 'TPA', city: 'Tampa', name: 'Tampa International', country: 'US' },
  { code: 'PDX', city: 'Portland', name: 'Portland International', country: 'US' },
  { code: 'AUS', city: 'Austin', name: 'Austin-Bergstrom', country: 'US' },
  { code: 'BNA', city: 'Nashville', name: 'Nashville International', country: 'US' },
  { code: 'RDU', city: 'Raleigh', name: 'Raleigh-Durham', country: 'US' },
  { code: 'STL', city: 'St. Louis', name: 'St. Louis Lambert', country: 'US' },
  { code: 'HNL', city: 'Honolulu', name: 'Daniel K. Inouye', country: 'US' },
  { code: 'OAK', city: 'Oakland', name: 'Oakland International', country: 'US' },
  { code: 'SJC', city: 'San Jose', name: 'San Jose International', country: 'US' },
  { code: 'MKE', city: 'Milwaukee', name: 'Mitchell International', country: 'US' },
  { code: 'PIT', city: 'Pittsburgh', name: 'Pittsburgh International', country: 'US' },
  { code: 'CLE', city: 'Cleveland', name: 'Cleveland Hopkins', country: 'US' },
  { code: 'IND', city: 'Indianapolis', name: 'Indianapolis International', country: 'US' },
  { code: 'CMH', city: 'Columbus', name: 'John Glenn International', country: 'US' },
  { code: 'SAT', city: 'San Antonio', name: 'San Antonio International', country: 'US' },
  { code: 'MSY', city: 'New Orleans', name: 'Louis Armstrong', country: 'US' },
  { code: 'JAX', city: 'Jacksonville', name: 'Jacksonville International', country: 'US' },
  { code: 'RSW', city: 'Fort Myers', name: 'Southwest Florida', country: 'US' },
  { code: 'SNA', city: 'Orange County', name: 'John Wayne', country: 'US' },
  { code: 'BUR', city: 'Burbank', name: 'Hollywood Burbank', country: 'US' },

  // Canada
  { code: 'YYZ', city: 'Toronto', name: 'Pearson International', country: 'CA' },
  { code: 'YVR', city: 'Vancouver', name: 'Vancouver International', country: 'CA' },
  { code: 'YUL', city: 'Montreal', name: 'Trudeau International', country: 'CA' },
  { code: 'YYC', city: 'Calgary', name: 'Calgary International', country: 'CA' },

  // Europe
  { code: 'LHR', city: 'London', name: 'Heathrow', country: 'GB' },
  { code: 'LGW', city: 'London', name: 'Gatwick', country: 'GB' },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'FR' },
  { code: 'AMS', city: 'Amsterdam', name: 'Schiphol', country: 'NL' },
  { code: 'FRA', city: 'Frankfurt', name: 'Frankfurt Airport', country: 'DE' },
  { code: 'MAD', city: 'Madrid', name: 'Barajas', country: 'ES' },
  { code: 'BCN', city: 'Barcelona', name: 'El Prat', country: 'ES' },
  { code: 'FCO', city: 'Rome', name: 'Fiumicino', country: 'IT' },
  { code: 'MUC', city: 'Munich', name: 'Munich Airport', country: 'DE' },
  { code: 'IST', city: 'Istanbul', name: 'Istanbul Airport', country: 'TR' },
  { code: 'DUB', city: 'Dublin', name: 'Dublin Airport', country: 'IE' },
  { code: 'ZRH', city: 'Zurich', name: 'Zurich Airport', country: 'CH' },
  { code: 'LIS', city: 'Lisbon', name: 'Humberto Delgado', country: 'PT' },

  // Asia-Pacific
  { code: 'NRT', city: 'Tokyo', name: 'Narita International', country: 'JP' },
  { code: 'HND', city: 'Tokyo', name: 'Haneda', country: 'JP' },
  { code: 'ICN', city: 'Seoul', name: 'Incheon International', country: 'KR' },
  { code: 'SIN', city: 'Singapore', name: 'Changi', country: 'SG' },
  { code: 'HKG', city: 'Hong Kong', name: 'Hong Kong International', country: 'HK' },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', country: 'TH' },
  { code: 'SYD', city: 'Sydney', name: 'Kingsford Smith', country: 'AU' },
  { code: 'MEL', city: 'Melbourne', name: 'Tullamarine', country: 'AU' },

  // Middle East
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'AE' },
  { code: 'DOH', city: 'Doha', name: 'Hamad International', country: 'QA' },

  // Latin America
  { code: 'MEX', city: 'Mexico City', name: 'Benito Juárez', country: 'MX' },
  { code: 'CUN', city: 'Cancún', name: 'Cancún International', country: 'MX' },
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos', country: 'BR' },
  { code: 'BOG', city: 'Bogotá', name: 'El Dorado', country: 'CO' },
  { code: 'PTY', city: 'Panama City', name: 'Tocumen International', country: 'PA' },
  { code: 'LIM', city: 'Lima', name: 'Jorge Chávez', country: 'PE' },
  { code: 'SCL', city: 'Santiago', name: 'Arturo Merino Benítez', country: 'CL' },
  { code: 'EZE', city: 'Buenos Aires', name: 'Ezeiza', country: 'AR' },
];

/** Search airports by query string — matches code, city, or name */
export function searchAirports(query: string, limit = 10): Airport[] {
  if (!query.trim()) return AIRPORTS.slice(0, limit);
  const q = query.toLowerCase().trim();
  const scored = AIRPORTS.map((a) => {
    let score = 0;
    if (a.code.toLowerCase() === q) score = 100; // exact code match
    else if (a.code.toLowerCase().startsWith(q)) score = 80;
    else if (a.city.toLowerCase() === q) score = 70;
    else if (a.city.toLowerCase().startsWith(q)) score = 60;
    else if (a.name.toLowerCase().includes(q)) score = 40;
    else if (a.city.toLowerCase().includes(q)) score = 30;
    else if (a.country.toLowerCase() === q) score = 20;
    return { airport: a, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.airport);
}
