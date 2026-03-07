/**
 * One-time seed script: populate latitude/longitude on destination documents in Appwrite.
 * Duffel Stays API requires geographic coordinates for hotel searches.
 *
 * Usage: npx tsx scripts/seed-destination-coords.ts
 *
 * Prerequisites:
 *   - APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY in .env
 *   - `latitude` (float) and `longitude` (float) attributes must exist on the
 *     `destinations` collection in Appwrite. Create them via console first.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Client, Databases, Query } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '';
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '';
const apiKey = process.env.APPWRITE_API_KEY ?? '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new Databases(client);

const DATABASE_ID = 'sogojet';
const COLLECTION_ID = 'destinations';

// IATA code → [latitude, longitude] (city-center coordinates)
const COORDS: Record<string, [number, number]> = {
  // ─── Original destinations ──────────────────────────────
  DPS: [-8.6500, 115.2167],  // Bali
  JTR: [36.4166, 25.4325],   // Santorini
  NRT: [35.6762, 139.6503],  // Tokyo
  CUZ: [-13.5319, -71.9675], // Cusco
  RAK: [31.6295, -7.9811],   // Marrakech
  KEF: [64.1466, -21.9426],  // Reykjavik
  NAP: [40.8518, 14.2681],   // Naples / Amalfi
  CPT: [-33.9249, 18.4241],  // Cape Town
  KIX: [34.6937, 135.5023],  // Osaka
  DBV: [42.6507, 18.0944],   // Dubrovnik
  MLE: [4.1755, 73.5093],    // Maldives
  BCN: [41.3874, 2.1686],    // Barcelona
  YYC: [51.0447, -114.0719], // Calgary / Banff
  LIS: [38.7223, -9.1393],   // Lisbon
  ZQN: [-45.0312, 168.6626], // Queenstown
  DXB: [25.2048, 55.2708],   // Dubai
  EZE: [-34.6037, -58.3816], // Buenos Aires
  CNX: [18.7883, 98.9853],   // Chiang Mai
  ZRH: [47.3769, 8.5417],    // Zurich
  HAV: [23.1136, -82.3666],  // Havana
  CUN: [21.1619, -86.8515],  // Cancún
  PUJ: [18.5601, -68.3725],  // Punta Cana
  MBJ: [18.4762, -77.8939],  // Montego Bay
  SJU: [18.4655, -66.1057],  // San Juan
  AUA: [12.5093, -69.9688],  // Aruba
  NAS: [25.0480, -77.3554],  // Nassau
  CZM: [20.4230, -86.9223],  // Cozumel
  UVF: [13.9094, -60.9789],  // St. Lucia
  SJO: [9.9281, -84.0907],   // San José / Costa Rica
  BOG: [4.7110, -74.0721],   // Bogotá
  MDE: [6.2518, -75.5636],   // Medellín
  LIM: [-12.0464, -77.0428], // Lima
  CTG: [10.3910, -75.5144],  // Cartagena
  PTY: [8.9824, -79.5199],   // Panama City
  LHR: [51.5074, -0.1278],   // London
  CDG: [48.8566, 2.3522],    // Paris
  AMS: [52.3676, 4.9041],    // Amsterdam
  FCO: [41.9028, 12.4964],   // Rome
  DUB: [53.3498, -6.2603],   // Dublin
  PRG: [50.0755, 14.4378],   // Prague
  CPH: [55.6761, 12.5683],   // Copenhagen
  TXL: [52.5200, 13.4050],   // Berlin
  BKK: [13.7563, 100.5018],  // Bangkok
  SIN: [1.3521, 103.8198],   // Singapore
  ICN: [37.5665, 126.9780],  // Seoul
  HAN: [21.0285, 105.8542],  // Hanoi
  HNL: [21.3069, -157.8583], // Honolulu
  MSY: [29.9511, -90.0715],  // New Orleans
  BNA: [36.1627, -86.7816],  // Nashville
  JFK: [40.7128, -74.0060],  // New York

  // ─── destinations-new (51–100) ─────────────────────────
  AUS: [30.2672, -97.7431],  // Austin
  DEN: [39.7392, -104.9903], // Denver
  CHS: [32.7765, -79.9311],  // Charleston
  SFO: [37.7749, -122.4194], // San Francisco
  LAS: [36.1699, -115.1398], // Las Vegas
  SEA: [47.6062, -122.3321], // Seattle
  MIA: [25.7617, -80.1918],  // Miami
  PHX: [33.4484, -111.9260], // Scottsdale / Phoenix
  SAV: [32.0809, -81.0912],  // Savannah
  SAN: [32.7157, -117.1611], // San Diego
  PDX: [45.5152, -122.6784], // Portland
  ATL: [33.7490, -84.3880],  // Atlanta
  BGI: [13.1132, -59.5988],  // Barbados
  GCM: [19.2951, -81.3819],  // Grand Cayman
  POS: [10.6549, -61.5019],  // Trinidad
  CUR: [12.1696, -68.9900],  // Curaçao
  SXM: [18.0425, -63.0548],  // St. Maarten
  REP: [13.3671, 103.8448],  // Siem Reap
  LPQ: [19.8563, 102.1347],  // Luang Prabang
  RGN: [16.8661, 96.1951],   // Yangon
  CEB: [10.3157, 123.8854],  // Cebu
  DAD: [16.0544, 108.2022],  // Da Nang
  KUL: [3.1390, 101.6869],   // Kuala Lumpur
  GIG: [-22.9068, -43.1729], // Rio de Janeiro
  SCL: [-33.4489, -70.6693], // Santiago
  UIO: [-0.1807, -78.4678],  // Quito
  MVD: [-34.9011, -56.1645], // Montevideo
  NBO: [-1.2921, 36.8219],   // Nairobi
  ZNZ: [-6.1659, 39.2026],   // Zanzibar
  CMN: [33.5731, -7.5898],   // Casablanca
  ACC: [5.6037, -0.1870],    // Accra
  DOH: [25.2854, 51.5310],   // Doha
  AMM: [31.9454, 35.9284],   // Amman
  TLV: [32.0853, 34.7818],   // Tel Aviv
  VIE: [48.2082, 16.3738],   // Vienna
  ATH: [37.9838, 23.7275],   // Athens
  BUD: [47.4979, 19.0402],   // Budapest
  WAW: [52.2297, 21.0122],   // Warsaw
  EDI: [55.9533, -3.1883],   // Edinburgh
  VCE: [45.4408, 12.3155],   // Venice
  IST: [41.0082, 28.9784],   // Istanbul
  MXP: [45.4642, 9.1900],    // Milan
  OPO: [41.1579, -8.6291],   // Porto
  SVQ: [37.3891, -5.9845],   // Seville
  FLR: [43.7696, 11.2558],   // Florence
  SYD: [-33.8688, 151.2093], // Sydney
  MEL: [-37.8136, 144.9631], // Melbourne
  HKG: [22.3193, 114.1694],  // Hong Kong
  TPE: [25.0330, 121.5654],  // Taipei
  DEL: [28.6139, 77.2090],   // New Delhi

  // ─── destinations-extra (101–146) ──────────────────────
  OGG: [20.7984, -156.3319], // Maui
  EYW: [24.5551, -81.7800],  // Key West
  ABQ: [35.6870, -105.9378], // Santa Fe
  ASE: [39.1911, -106.8175], // Aspen
  RNO: [39.0968, -120.0324], // Lake Tahoe
  AVL: [35.5951, -82.5515],  // Asheville
  ANC: [61.2181, -149.9003], // Anchorage
  MVY: [41.3925, -70.6139],  // Martha's Vineyard
  JAC: [43.4799, -110.7624], // Jackson Hole
  CNY: [38.5733, -109.5498], // Moab
  FCA: [48.4106, -114.3528], // Whitefish
  PLS: [21.7958, -72.2056],  // Turks & Caicos
  STT: [18.3358, -64.9309],  // St. Thomas
  ANU: [17.1175, -61.8456],  // Antigua
  GND: [12.0564, -61.7485],  // Grenada
  SKB: [17.3026, -62.7177],  // St. Kitts
  BON: [12.1501, -68.2655],  // Bonaire
  BDA: [32.2950, -64.7799],  // Bermuda
  BZE: [17.2510, -88.7590],  // Belize City
  RTB: [16.3167, -86.5230],  // Roatán
  GUA: [14.6349, -90.5069],  // Guatemala City
  MGA: [11.9344, -85.9560],  // Granada, Nicaragua
  SAL: [13.6929, -89.2182],  // San Salvador
  TGU: [14.0723, -87.1921],  // Tegucigalpa
  LPB: [-16.4897, -68.1193], // La Paz
  GRU: [-23.5505, -46.6333], // São Paulo
  GPS: [-0.7432, -90.3135],  // Galápagos
  FTE: [-50.3403, -72.2648], // El Calafate
  MLA: [35.8989, 14.5146],   // Malta
  BRU: [50.8503, 4.3517],    // Brussels
  BGO: [60.3913, 5.3221],    // Bergen
  SPU: [43.5081, 16.4402],   // Split
  TLL: [59.4370, 24.7536],   // Tallinn
  RIX: [56.9496, 24.1052],   // Riga
  TBS: [41.7151, 44.8271],   // Tbilisi
  DSS: [14.7167, -17.4677],  // Dakar
  LVI: [-17.8216, 25.8609],  // Victoria Falls
  JRO: [-3.3869, 37.3434],   // Kilimanjaro
  LOS: [6.5244, 3.3792],     // Lagos
  ADD: [9.0250, 38.7469],    // Addis Ababa
  MCT: [23.5880, 58.3829],   // Muscat
  GOI: [15.2993, 74.1240],   // Goa
  KTM: [27.7172, 85.3240],   // Kathmandu
  CMB: [6.9271, 79.8612],    // Colombo
  NAN: [-17.7765, 177.9631], // Fiji
  PPT: [-17.5516, -149.5585],// Tahiti

  // ─── destinations-batch3 ───────────────────────────────
  // US domestic
  STS: [38.5025, -122.8653], // Sonoma (Santa Rosa)
  PSP: [33.8303, -116.5453], // Palm Springs
  TEX: [30.2200, -97.6700],  // Telluride (approx, uses TEX code)
  OAJ: [34.7104, -77.4483],  // Outer Banks (Jacksonville NC)
  LIH: [22.0964, -159.3380], // Kauai
  KOA: [19.7388, -156.0458], // Kona / Big Island
  BZN: [45.6770, -111.0429], // Bozeman
  GRB: [44.5133, -88.0133],  // Door County (Green Bay)
  HHH: [32.2163, -80.7526],  // Hilton Head
  VPS: [30.3935, -86.4958],  // Destin / Emerald Coast
  RSW: [26.4615, -81.7798],  // Fort Myers
  PIE: [27.7676, -82.6793],  // St. Petersburg FL
  MYR: [33.6891, -78.8867],  // Myrtle Beach
  BKG: [36.5323, -93.2121],  // Branson
  TVC: [44.7631, -85.6206],  // Traverse City
  PVD: [41.8240, -71.4128],  // Providence / Newport
  BGR: [44.8016, -68.7712],  // Acadia / Bar Harbor
  ACK: [41.2540, -70.0600],  // Nantucket

  // Caribbean batch3
  AXA: [18.2048, -63.0501],  // Anguilla
  DOM: [15.4150, -61.3710],  // Dominica
  SBH: [17.9042, -62.8498],  // St. Barthélemy
  FDF: [14.6160, -61.0588],  // Martinique
  PTP: [16.2411, -61.5428],  // Guadeloupe
  MNI: [16.7914, -62.1873],  // Montserrat
  EIS: [18.4449, -64.5430],  // British Virgin Islands
  TAB: [11.1499, -60.8320],  // Tobago
  CYB: [19.6870, -79.8827],  // Cayman Brac

  // Europe batch3
  GOA: [41.1496, 8.6110],    // Genoa (proxy for Cinque Terre)
  JMK: [37.4467, 25.3289],   // Mykonos
  NCE: [43.7102, 7.2620],    // Nice
  PSA: [43.7228, 10.4017],   // Pisa (Tuscany)
  TIV: [42.4348, 18.7144],   // Tivat (Kotor)
  LJU: [46.0569, 14.5058],   // Ljubljana
  SZG: [47.8095, 13.0550],   // Salzburg
  AJA: [41.9270, 8.7370],    // Ajaccio (Corsica)
  CAG: [39.2238, 9.1217],    // Cagliari (Sardinia)
  FNC: [32.6669, -16.9241],  // Funchal (Madeira)
  PDL: [37.7483, -25.6666],  // Ponta Delgada (Azores)
  VRN: [45.4384, 10.9917],   // Verona
  SXB: [48.5734, 7.7521],    // Strasbourg

  // Asia-Pacific batch3
  LGK: [6.3200, 99.8430],    // Langkawi
  PPS: [9.7421, 118.7351],   // Palawan
  LOP: [-8.7570, 116.2765],  // Lombok
  SOQ: [-0.8700, 131.2550],  // Raja Ampat (Sorong)
  USM: [9.5479, 100.0622],   // Koh Samui
  PBH: [27.4728, 89.6390],   // Paro (Bhutan)
  OKA: [26.3344, 127.7667],  // Okinawa
  CJU: [33.5104, 126.5319],  // Jeju

  // Africa/ME batch3
  SEZ: [-4.6796, 55.4920],   // Seychelles (Mahé)
  MRU: [-20.1609, 57.5012],  // Mauritius
  TNR: [-18.8792, 47.5079],  // Antananarivo
  LXR: [25.6872, 32.6396],   // Luxor
  FEZ: [34.0181, -5.0078],   // Fez
  AUH: [24.4539, 54.3773],   // Abu Dhabi

  // South America batch3
  BRC: [-41.1335, -71.3103], // Bariloche
  IGR: [-25.6953, -54.4367], // Iguazú Falls
  FEN: [-3.8533, -32.4283],  // Fernando de Noronha
  MDZ: [-32.8895, -68.8458], // Mendoza
  SRE: [-19.0196, -65.2619], // Sucre
};

async function main() {
  console.log('Fetching all active destinations...');
  const result = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
    Query.equal('is_active', true),
    Query.limit(500),
  ]);

  console.log(`Found ${result.documents.length} active destinations`);

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const doc of result.documents) {
    const iata = doc.iata_code as string;

    // Skip if already has coordinates
    if (doc.latitude != null && doc.longitude != null) {
      skipped++;
      continue;
    }

    const coords = COORDS[iata];
    if (!coords) {
      console.warn(`  No coordinates for ${iata} (${doc.city})`);
      missing++;
      continue;
    }

    try {
      await db.updateDocument(DATABASE_ID, COLLECTION_ID, doc.$id, {
        latitude: coords[0],
        longitude: coords[1],
      });
      updated++;
      console.log(`  ✓ ${iata} (${doc.city}): ${coords[0]}, ${coords[1]}`);
    } catch (err) {
      console.error(`  ✗ ${iata}: ${err}`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} already had coords, ${missing} missing mapping`);
}

main().catch(console.error);
