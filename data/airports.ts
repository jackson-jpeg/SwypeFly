/**
 * Major airports for geolocation → nearest airport lookup.
 * ~60 major US airports + international hubs.
 */
export interface Airport {
  code: string;
  city: string;
  lat: number;
  lng: number;
}

/**
 * Nearby airports — used for fallback when user's home airport has sparse deals.
 * Maps airport code → nearby alternatives with approximate drive times.
 */
export const nearbyAirports: Record<string, { code: string; label: string }[]> = {
  TPA: [
    { code: 'MCO', label: 'Orlando (1h drive)' },
    { code: 'PIE', label: 'St. Pete (20 min)' },
    { code: 'SRQ', label: 'Sarasota (1h drive)' },
    { code: 'FLL', label: 'Fort Lauderdale (4h drive)' },
  ],
  MCO: [
    { code: 'TPA', label: 'Tampa (1h drive)' },
    { code: 'FLL', label: 'Fort Lauderdale (3h drive)' },
    { code: 'JAX', label: 'Jacksonville (2h drive)' },
  ],
  MIA: [
    { code: 'FLL', label: 'Fort Lauderdale (30 min)' },
    { code: 'PBI', label: 'West Palm Beach (1.5h drive)' },
  ],
  FLL: [
    { code: 'MIA', label: 'Miami (30 min)' },
    { code: 'PBI', label: 'West Palm Beach (1h drive)' },
  ],
  JFK: [
    { code: 'EWR', label: 'Newark (45 min)' },
    { code: 'LGA', label: 'LaGuardia (30 min)' },
  ],
  EWR: [
    { code: 'JFK', label: 'JFK (45 min)' },
    { code: 'LGA', label: 'LaGuardia (30 min)' },
    { code: 'PHL', label: 'Philadelphia (1.5h drive)' },
  ],
  LGA: [
    { code: 'JFK', label: 'JFK (30 min)' },
    { code: 'EWR', label: 'Newark (30 min)' },
  ],
  ORD: [
    { code: 'MDW', label: 'Midway (30 min)' },
    { code: 'MKE', label: 'Milwaukee (1.5h drive)' },
  ],
  MDW: [
    { code: 'ORD', label: "O'Hare (30 min)" },
  ],
  LAX: [
    { code: 'SNA', label: 'Santa Ana (45 min)' },
    { code: 'BUR', label: 'Burbank (30 min)' },
    { code: 'ONT', label: 'Ontario (1h drive)' },
    { code: 'LGB', label: 'Long Beach (30 min)' },
  ],
  SFO: [
    { code: 'OAK', label: 'Oakland (30 min)' },
    { code: 'SJC', label: 'San Jose (45 min)' },
  ],
  OAK: [
    { code: 'SFO', label: 'SFO (30 min)' },
    { code: 'SJC', label: 'San Jose (30 min)' },
  ],
  DFW: [
    { code: 'DAL', label: 'Love Field (20 min)' },
  ],
  IAH: [
    { code: 'HOU', label: 'Hobby (45 min)' },
  ],
  DCA: [
    { code: 'IAD', label: 'Dulles (45 min)' },
    { code: 'BWI', label: 'Baltimore (1h drive)' },
  ],
  IAD: [
    { code: 'DCA', label: 'Reagan (45 min)' },
    { code: 'BWI', label: 'Baltimore (1h drive)' },
  ],
  BWI: [
    { code: 'DCA', label: 'Reagan (1h drive)' },
    { code: 'IAD', label: 'Dulles (1h drive)' },
    { code: 'PHL', label: 'Philadelphia (1.5h drive)' },
  ],
  BOS: [
    { code: 'PVD', label: 'Providence (1h drive)' },
    { code: 'MHT', label: 'Manchester (1h drive)' },
  ],
  SEA: [
    { code: 'PDX', label: 'Portland (3h drive)' },
  ],
  ATL: [
    { code: 'BNA', label: 'Nashville (4h drive)' },
    { code: 'CLT', label: 'Charlotte (4h drive)' },
  ],
  DEN: [
    { code: 'COS', label: 'Colorado Springs (1h drive)' },
    { code: 'ABQ', label: 'Albuquerque (6h drive)' },
  ],
  PHX: [
    { code: 'TUS', label: 'Tucson (2h drive)' },
    { code: 'LAS', label: 'Las Vegas (5h drive)' },
  ],
  LAS: [
    { code: 'PHX', label: 'Phoenix (5h drive)' },
    { code: 'LAX', label: 'Los Angeles (4h drive)' },
    { code: 'SAN', label: 'San Diego (5h drive)' },
  ],
  MSP: [
    { code: 'MSN', label: 'Madison (4h drive)' },
    { code: 'MKE', label: 'Milwaukee (5h drive)' },
  ],
  DTW: [
    { code: 'CLE', label: 'Cleveland (3h drive)' },
    { code: 'ORD', label: 'Chicago (4h drive)' },
  ],
  CLT: [
    { code: 'RDU', label: 'Raleigh-Durham (2.5h drive)' },
    { code: 'ATL', label: 'Atlanta (4h drive)' },
    { code: 'GSP', label: 'Greenville (2h drive)' },
  ],
  PHL: [
    { code: 'EWR', label: 'Newark (1.5h drive)' },
    { code: 'BWI', label: 'Baltimore (1.5h drive)' },
    { code: 'JFK', label: 'New York JFK (2h drive)' },
  ],
  MSY: [
    { code: 'IAH', label: 'Houston (5h drive)' },
    { code: 'BTR', label: 'Baton Rouge (1.5h drive)' },
  ],
  SAN: [
    { code: 'LAX', label: 'Los Angeles (2h drive)' },
    { code: 'LAS', label: 'Las Vegas (5h drive)' },
  ],
  PDX: [
    { code: 'SEA', label: 'Seattle (3h drive)' },
  ],
  SLC: [
    { code: 'BOI', label: 'Boise (5h drive)' },
  ],
  RDU: [
    { code: 'CLT', label: 'Charlotte (2.5h drive)' },
    { code: 'RIC', label: 'Richmond (3h drive)' },
  ],
  BNA: [
    { code: 'ATL', label: 'Atlanta (4h drive)' },
    { code: 'CLT', label: 'Charlotte (5h drive)' },
  ],
  AUS: [
    { code: 'SAT', label: 'San Antonio (1.5h drive)' },
    { code: 'DFW', label: 'Dallas (3h drive)' },
    { code: 'IAH', label: 'Houston (2.5h drive)' },
  ],
  STL: [
    { code: 'ORD', label: 'Chicago (5h drive)' },
    { code: 'MCI', label: 'Kansas City (4h drive)' },
  ],
  PIT: [
    { code: 'CLE', label: 'Cleveland (2h drive)' },
    { code: 'BWI', label: 'Baltimore (4h drive)' },
  ],
  CLE: [
    { code: 'PIT', label: 'Pittsburgh (2h drive)' },
    { code: 'DTW', label: 'Detroit (3h drive)' },
  ],
  MCI: [
    { code: 'STL', label: 'St. Louis (4h drive)' },
  ],
  IND: [
    { code: 'ORD', label: 'Chicago (3h drive)' },
    { code: 'CVG', label: 'Cincinnati (2h drive)' },
  ],
  SJC: [
    { code: 'SFO', label: 'San Francisco (45 min)' },
    { code: 'OAK', label: 'Oakland (30 min)' },
  ],
};

export const airports: Airport[] = [
  // ─── Major US Airports ─────────────────────────────────────
  { code: 'ATL', city: 'Atlanta', lat: 33.6407, lng: -84.4277 },
  { code: 'LAX', city: 'Los Angeles', lat: 33.9425, lng: -118.4081 },
  { code: 'ORD', city: 'Chicago', lat: 41.9742, lng: -87.9073 },
  { code: 'DFW', city: 'Dallas', lat: 32.8998, lng: -97.0403 },
  { code: 'DEN', city: 'Denver', lat: 39.8561, lng: -104.6737 },
  { code: 'JFK', city: 'New York', lat: 40.6413, lng: -73.7781 },
  { code: 'SFO', city: 'San Francisco', lat: 37.6213, lng: -122.3790 },
  { code: 'SEA', city: 'Seattle', lat: 47.4502, lng: -122.3088 },
  { code: 'LAS', city: 'Las Vegas', lat: 36.0840, lng: -115.1537 },
  { code: 'MCO', city: 'Orlando', lat: 28.4312, lng: -81.3081 },
  { code: 'MIA', city: 'Miami', lat: 25.7959, lng: -80.2870 },
  { code: 'CLT', city: 'Charlotte', lat: 35.2140, lng: -80.9431 },
  { code: 'EWR', city: 'Newark', lat: 40.6895, lng: -74.1745 },
  { code: 'PHX', city: 'Phoenix', lat: 33.4373, lng: -112.0078 },
  { code: 'IAH', city: 'Houston', lat: 29.9902, lng: -95.3368 },
  { code: 'MSP', city: 'Minneapolis', lat: 44.8848, lng: -93.2223 },
  { code: 'DTW', city: 'Detroit', lat: 42.2162, lng: -83.3554 },
  { code: 'BOS', city: 'Boston', lat: 42.3656, lng: -71.0096 },
  { code: 'TPA', city: 'Tampa', lat: 27.9756, lng: -82.5333 },
  { code: 'FLL', city: 'Fort Lauderdale', lat: 26.0742, lng: -80.1506 },
  { code: 'BWI', city: 'Baltimore', lat: 39.1754, lng: -76.6684 },
  { code: 'SLC', city: 'Salt Lake City', lat: 40.7899, lng: -111.9791 },
  { code: 'DCA', city: 'Washington DC', lat: 38.8512, lng: -77.0402 },
  { code: 'SAN', city: 'San Diego', lat: 32.7338, lng: -117.1933 },
  { code: 'IAD', city: 'Dulles', lat: 38.9531, lng: -77.4565 },
  { code: 'MDW', city: 'Chicago Midway', lat: 41.7868, lng: -87.7522 },
  { code: 'HNL', city: 'Honolulu', lat: 21.3187, lng: -157.9225 },
  { code: 'PDX', city: 'Portland', lat: 45.5898, lng: -122.5951 },
  { code: 'STL', city: 'St. Louis', lat: 38.7487, lng: -90.3700 },
  { code: 'BNA', city: 'Nashville', lat: 36.1263, lng: -86.6774 },
  { code: 'MSY', city: 'New Orleans', lat: 29.9934, lng: -90.2580 },
  { code: 'AUS', city: 'Austin', lat: 30.1975, lng: -97.6664 },
  { code: 'RDU', city: 'Raleigh', lat: 35.8801, lng: -78.7880 },
  { code: 'SJC', city: 'San Jose', lat: 37.3626, lng: -121.9291 },
  { code: 'SMF', city: 'Sacramento', lat: 38.6954, lng: -121.5908 },
  { code: 'PIT', city: 'Pittsburgh', lat: 40.4957, lng: -80.2413 },
  { code: 'IND', city: 'Indianapolis', lat: 39.7173, lng: -86.2944 },
  { code: 'CLE', city: 'Cleveland', lat: 41.4058, lng: -81.8539 },
  { code: 'CMH', city: 'Columbus', lat: 39.9981, lng: -82.8919 },
  { code: 'PHL', city: 'Philadelphia', lat: 39.8744, lng: -75.2424 },
  { code: 'JAX', city: 'Jacksonville', lat: 30.4941, lng: -81.6879 },
  { code: 'MCI', city: 'Kansas City', lat: 39.2976, lng: -94.7139 },
  { code: 'OAK', city: 'Oakland', lat: 37.7213, lng: -122.2208 },
  { code: 'RSW', city: 'Fort Myers', lat: 26.5362, lng: -81.7553 },
  { code: 'MKE', city: 'Milwaukee', lat: 42.9472, lng: -87.8966 },
  { code: 'ABQ', city: 'Albuquerque', lat: 35.0402, lng: -106.6094 },
  { code: 'OMA', city: 'Omaha', lat: 41.3032, lng: -95.8941 },
  { code: 'RNO', city: 'Reno', lat: 39.4991, lng: -119.7681 },
  { code: 'CHS', city: 'Charleston', lat: 32.8986, lng: -80.0405 },
  // ─── International Hubs ────────────────────────────────────
  { code: 'YYZ', city: 'Toronto', lat: 43.6777, lng: -79.6248 },
  { code: 'YVR', city: 'Vancouver', lat: 49.1967, lng: -123.1815 },
  { code: 'YUL', city: 'Montreal', lat: 45.4706, lng: -73.7408 },
  { code: 'MEX', city: 'Mexico City', lat: 19.4363, lng: -99.0721 },
  { code: 'CUN', city: 'Cancún', lat: 21.0365, lng: -86.8771 },
  { code: 'LHR', city: 'London', lat: 51.4700, lng: -0.4543 },
  { code: 'CDG', city: 'Paris', lat: 49.0097, lng: 2.5479 },
  { code: 'FRA', city: 'Frankfurt', lat: 50.0379, lng: 8.5622 },
  { code: 'AMS', city: 'Amsterdam', lat: 52.3105, lng: 4.7683 },
  { code: 'DXB', city: 'Dubai', lat: 25.2532, lng: 55.3657 },
  { code: 'NRT', city: 'Tokyo', lat: 35.7720, lng: 140.3929 },
  { code: 'SIN', city: 'Singapore', lat: 1.3644, lng: 103.9915 },
];

/**
 * Find the nearest airport to a given lat/lng using the Haversine formula.
 */
export function findNearestAirport(lat: number, lng: number): Airport {
  let best = airports[0];
  let bestDist = Infinity;

  for (const ap of airports) {
    const dLat = ((ap.lat - lat) * Math.PI) / 180;
    const dLng = ((ap.lng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((ap.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist < bestDist) {
      bestDist = dist;
      best = ap;
    }
  }

  return best;
}
