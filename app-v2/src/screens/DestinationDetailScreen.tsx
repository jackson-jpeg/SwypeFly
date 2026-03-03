import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { STUB_TRIP_PLAN, STUB_DESTINATIONS, getStubDestination } from '@/api/stubs';
import { useSavedStore } from '@/stores/savedStore';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';
import type { TripPlan, Destination } from '@/api/types';

/* ── detail enrichment (supplements stub Destination data) ────── */
const DETAIL_DATA: Record<string, {
  region: string;
  vibe: string;
  quote: string;
  flightStrikethrough?: number;
  flightRoute: string;
  flightDates: string;
  hotels: { name: string; price: string; image: string }[];
  weather: { month: string; temp: number; pct: number }[];
  aboutParas: string[];
  itinerary: { days: string; title: string; desc: string }[];
  similar: { city: string; price: number; image: string }[];
}> = {
  '2': {
    region: 'Aegean Islands',
    vibe: 'Romance',
    quote: 'Sun-bleached walls tumble toward the caldera, each sunset more impossible than the last.',
    flightStrikethrough: 542,
    flightRoute: 'JFK \u2192 JTR \u00b7 Round trip',
    flightDates: 'Jun 15 \u2013 Jun 22 \u00b7 Economy \u00b7 1 stop via ATH',
    hotels: [
      { name: 'Canaves Oia', price: '$289/nt', image: 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Astra Suites', price: '$196/nt', image: 'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
    weather: [
      { month: 'Jun', temp: 82, pct: 85 },
      { month: 'Jul', temp: 86, pct: 95 },
      { month: 'Aug', temp: 84, pct: 90 },
      { month: 'Sep', temp: 79, pct: 75 },
      { month: 'Oct', temp: 72, pct: 60 },
    ],
    aboutParas: [
      'A crescent-shaped island born from a volcanic eruption, Santorini is the jewel of the Cyclades. Whitewashed villages cascade down rust-colored cliffs, blue-domed churches punctuate every sightline, and the caldera views at golden hour are worth every penny of the flight.',
      "Beyond the postcard-perfect vistas, you\u2019ll find world-class wine from ancient Assyrtiko vines, black sand beaches, and some of the freshest seafood in the Mediterranean.",
    ],
    itinerary: [
      { days: 'Day 1\u20132', title: 'Oia & Caldera Views', desc: 'Explore the iconic blue domes, watch the legendary sunset from the castle ruins.' },
      { days: 'Day 3\u20134', title: 'Beaches & Wine', desc: "Red Beach, Kamari\u2019s black sands, then an afternoon wine tasting in Megalochori." },
      { days: 'Day 5\u20137', title: 'Hidden Gems & Departure', desc: 'Akrotiri archaeological site, catamaran cruise, farewell dinner at Ammoudi Bay.' },
    ],
    similar: [
      { city: 'Mykonos', price: 412, image: 'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Amalfi Coast', price: 523, image: 'https://images.pexels.com/photos/2440024/pexels-photo-2440024.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Dubrovnik', price: 389, image: 'https://images.pexels.com/photos/2044434/pexels-photo-2044434.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
  },
  '1': {
    region: 'Lesser Sunda Islands',
    vibe: 'Wellness',
    quote: 'Emerald rice terraces, ancient temples, and sunsets that redefine the color orange.',
    flightStrikethrough: 978,
    flightRoute: 'JFK \u2192 DPS \u00b7 Round trip',
    flightDates: 'Jul 10 \u2013 Jul 20 \u00b7 Economy \u00b7 1 stop via SIN',
    hotels: [
      { name: 'Four Seasons Sayan', price: '$450/nt', image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Alila Seminyak', price: '$185/nt', image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
    weather: [
      { month: 'May', temp: 84, pct: 60 },
      { month: 'Jun', temp: 82, pct: 50 },
      { month: 'Jul', temp: 81, pct: 45 },
      { month: 'Aug', temp: 82, pct: 40 },
      { month: 'Sep', temp: 83, pct: 55 },
    ],
    aboutParas: [
      'Bali is Indonesia\u2019s most famous island, a lush paradise of terraced rice paddies, volcanic mountains, and sacred water temples. Ubud\u2019s artistic heart beats alongside Seminyak\u2019s beach clubs and Uluwatu\u2019s dramatic clifftop temple.',
      'From sunrise yoga in the jungle to snorkeling with manta rays off Nusa Penida, Bali offers a rare blend of spiritual depth and natural wonder.',
    ],
    itinerary: [
      { days: 'Day 1\u20133', title: 'Ubud & Rice Terraces', desc: 'Tegallalang terraces, Sacred Monkey Forest, traditional Balinese cooking class.' },
      { days: 'Day 4\u20136', title: 'Beaches & Temples', desc: 'Uluwatu temple at sunset, surf lessons in Canggu, snorkeling at Blue Lagoon.' },
      { days: 'Day 7\u201310', title: 'Island Hopping', desc: 'Day trip to Nusa Penida, Kelingking Beach, manta ray snorkeling.' },
    ],
    similar: [
      { city: 'Maldives', price: 1089, image: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Kyoto', price: 823, image: 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Santorini', price: 387, image: 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
  },
  '9': {
    region: 'Kansai',
    vibe: 'Culture',
    quote: 'Where ancient tradition breathes through bamboo groves and vermilion torii gates.',
    flightStrikethrough: 1050,
    flightRoute: 'JFK \u2192 KIX \u00b7 Round trip',
    flightDates: 'Apr 1 \u2013 Apr 10 \u00b7 Economy \u00b7 1 stop via NRT',
    hotels: [
      { name: 'The Ritz-Carlton', price: '$380/nt', image: 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Hoshinoya Kyoto', price: '$520/nt', image: 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
    weather: [
      { month: 'Mar', temp: 54, pct: 55 },
      { month: 'Apr', temp: 63, pct: 90 },
      { month: 'May', temp: 72, pct: 75 },
      { month: 'Oct', temp: 66, pct: 80 },
      { month: 'Nov', temp: 55, pct: 85 },
    ],
    aboutParas: [
      'Kyoto served as Japan\u2019s imperial capital for over a millennium, and the city\u2019s 2,000+ temples, shrines, and gardens make it the cultural soul of the country. Cherry blossoms in spring and fiery maples in autumn paint the city in ethereal color.',
      'Wander through Arashiyama\u2019s towering bamboo forest, savor a multi-course kaiseki dinner, and catch a geisha gliding through Gion\u2019s lantern-lit streets.',
    ],
    itinerary: [
      { days: 'Day 1\u20132', title: 'Temples & Shrines', desc: 'Fushimi Inari\u2019s 10,000 torii gates, Kinkaku-ji golden pavilion, traditional tea ceremony.' },
      { days: 'Day 3\u20135', title: 'Culture & Cuisine', desc: 'Arashiyama bamboo grove, Nishiki Market, kaiseki dinner in Gion.' },
      { days: 'Day 6\u20138', title: 'Day Trips', desc: 'Nara deer park, Osaka street food tour, sake tasting in Fushimi.' },
    ],
    similar: [
      { city: 'Tokyo', price: 756, image: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Bali', price: 845, image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Marrakech', price: 612, image: 'https://images.pexels.com/photos/3889843/pexels-photo-3889843.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
  },
  '3': {
    region: 'Kanto',
    vibe: 'Adventure',
    quote: 'Neon-drenched streets, Michelin-starred ramen, and the pulse of 14 million dreamers.',
    flightStrikethrough: 980,
    flightRoute: 'JFK \u2192 NRT \u00b7 Round trip',
    flightDates: 'May 5 \u2013 May 14 \u00b7 Economy \u00b7 Nonstop',
    hotels: [
      { name: 'Park Hyatt Tokyo', price: '$410/nt', image: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'Aman Tokyo', price: '$680/nt', image: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
    weather: [
      { month: 'Mar', temp: 56, pct: 70 },
      { month: 'Apr', temp: 63, pct: 85 },
      { month: 'May', temp: 72, pct: 75 },
      { month: 'Oct', temp: 68, pct: 80 },
      { month: 'Nov', temp: 58, pct: 65 },
    ],
    aboutParas: [
      'Tokyo is a city of contrasts where ultra-modern skyscrapers stand beside centuries-old shrines. From the chaotic energy of Shibuya Crossing to the serene grounds of Meiji Shrine, every neighborhood tells a different story.',
      'With more Michelin stars than any city on Earth, a vending machine culture that borders on art, and neighborhoods like Akihabara and Harajuku that defy description, Tokyo delivers sensory overload in the best way possible.',
    ],
    itinerary: [
      { days: 'Day 1\u20133', title: 'City Highlights', desc: 'Shibuya Crossing, Meiji Shrine, Senso-ji temple, Tsukiji Outer Market.' },
      { days: 'Day 4\u20136', title: 'Culture & Pop Culture', desc: 'Akihabara electronics, Harajuku fashion, teamLab Borderless, Shinjuku nightlife.' },
      { days: 'Day 7\u20139', title: 'Day Trips', desc: 'Mt. Fuji viewing at Hakone, Kamakura Great Buddha, onsen experience.' },
    ],
    similar: [
      { city: 'Kyoto', price: 823, image: 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Bali', price: 845, image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Iceland', price: 534, image: 'https://images.pexels.com/photos/2113566/pexels-photo-2113566.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
  },
  '11': {
    region: 'Indian Ocean',
    vibe: 'Romance',
    quote: 'Overwater villas, bioluminescent shores, and a silence that resets your soul.',
    flightStrikethrough: 1320,
    flightRoute: 'JFK \u2192 MLE \u00b7 Round trip',
    flightDates: 'Dec 20 \u2013 Dec 28 \u00b7 Economy \u00b7 1 stop via DXB',
    hotels: [
      { name: 'Soneva Fushi', price: '$1,200/nt', image: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { name: 'W Maldives', price: '$680/nt', image: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
    weather: [
      { month: 'Dec', temp: 84, pct: 70 },
      { month: 'Jan', temp: 83, pct: 85 },
      { month: 'Feb', temp: 84, pct: 90 },
      { month: 'Mar', temp: 85, pct: 95 },
      { month: 'Apr', temp: 86, pct: 80 },
    ],
    aboutParas: [
      'The Maldives is a necklace of 1,192 coral islands scattered across the Indian Ocean. Impossibly turquoise lagoons, powder-white sandbanks, and some of the world\u2019s most spectacular marine life make this the ultimate barefoot-luxury escape.',
      'Snorkel with whale sharks, dine on a sandbank lit by torches, and drift to sleep in an overwater villa with the ocean glowing beneath you.',
    ],
    itinerary: [
      { days: 'Day 1\u20132', title: 'Arrival & Resort', desc: 'Seaplane transfer, overwater villa check-in, sunset dolphin cruise.' },
      { days: 'Day 3\u20135', title: 'Ocean Adventures', desc: 'Snorkeling with mantas, sandbank picnic, night diving with bioluminescence.' },
      { days: 'Day 6\u20138', title: 'Relaxation', desc: 'Spa treatments, private beach dinner, whale shark excursion.' },
    ],
    similar: [
      { city: 'Bali', price: 845, image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Santorini', price: 387, image: 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=600' },
      { city: 'Amalfi Coast', price: 523, image: 'https://images.pexels.com/photos/2440024/pexels-photo-2440024.jpeg?auto=compress&cs=tinysrgb&w=600' },
    ],
  },
};

function getDefaultDetail(dest: Destination) {
  // Build itinerary from destination data if available
  const itinerary = (dest.itinerary ?? []).map((item) => ({
    days: `Day ${item.day}`,
    title: item.activities[0] ?? 'Explore',
    desc: item.activities.slice(1).join('. ') || item.activities[0] || '',
  }));

  // Find similar destinations from the same country or vibe
  const similarDests = STUB_DESTINATIONS
    .filter((d) => d.id !== dest.id && (d.country === dest.country || d.vibeTags[0] === dest.vibeTags[0]))
    .slice(0, 3)
    .map((d) => ({ city: d.city, price: d.flightPrice, image: d.imageUrl }));

  return {
    region: dest.country,
    vibe: dest.vibeTags[0] ?? 'Adventure',
    quote: dest.tagline ?? `Discover the magic of ${dest.city}.`,
    flightStrikethrough: dest.previousPrice ?? undefined,
    flightRoute: `JFK → ${dest.iataCode ?? dest.city}`,
    flightDates: 'Flexible dates · Economy',
    hotels: (dest.imageUrls ?? []).slice(0, 2).map((img, i) => ({
      name: i === 0 ? `Top Stay in ${dest.city}` : `Hotel Pick ${i + 1}`,
      price: `$${Math.round(dest.flightPrice * 0.4 + i * 30)}/nt`,
      image: img,
    })),
    weather: [],
    aboutParas: [dest.tagline ?? `${dest.city} awaits with incredible experiences and unforgettable moments.`],
    itinerary,
    similar: similarDests,
  };
}

/* ── inline SVG helpers ────────────────────────────────────────── */
function ArrowLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function HeartOutline() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function HeartFilled() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

/* ── section label ─────────────────────────────────────────────── */
const sectionLabel: React.CSSProperties = {
  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: colors.sageDrift,
  margin: 0,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: `"${fonts.display}", system-ui, sans-serif`,
  fontSize: 24,
  fontWeight: 800,
  lineHeight: '28px',
  letterSpacing: '-0.01em',
  textTransform: 'uppercase',
  color: colors.deepDusk,
  margin: 0,
};

/* ── component ─────────────────────────────────────────────────── */
export default function DestinationDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const stubDest = getStubDestination(id ?? '');
  const { isSaved, toggle } = useSavedStore();
  const setBookingDestination = useBookingStore((s) => s.setDestination);
  const { departureCode } = useUIStore();
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [tripPlanLoading, setTripPlanLoading] = useState(false);

  if (!stubDest) {
    return (
      <div className="screen" style={{ background: colors.duskSand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, color: colors.mutedText }}>Destination not found</span>
      </div>
    );
  }

  const detail = DETAIL_DATA[id ?? ''] ?? getDefaultDetail(stubDest);

  const dest = {
    ...stubDest,
    heroImage: stubDest.imageUrl,
    ...detail,
    flightStrikethrough: detail.flightStrikethrough ?? Math.round(stubDest.flightPrice * 1.4),
  };

  const handleGeneratePlan = async () => {
    setTripPlanLoading(true);
    // Simulate API call delay, then use stub
    await new Promise((r) => setTimeout(r, 1500));
    setTripPlan(STUB_TRIP_PLAN);
    setTripPlanLoading(false);
  };

  return (
    <div
      className="screen"
      style={{
        background: colors.duskSand,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: '100%', height: 420, flexShrink: 0 }}>
        {/* Photo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${dest.heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: colors.deepDusk,
          }}
        />
        {/* Bottom gradient */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 250,
            background: `linear-gradient(to top, ${colors.duskSand} 0%, transparent 100%)`,
          }}
        />

        {/* Top nav */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '52px 20px 0',
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.25)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft />
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => toggle(stubDest.id)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(0,0,0,0.25)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSaved(stubDest.id) ? <HeartFilled /> : <HeartOutline />}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: `${dest.city} — SoGoJet`, text: dest.tagline, url: window.location.href }).catch(() => {});
                }
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(0,0,0,0.25)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShareIcon />
            </button>
          </div>
        </div>

        {/* Title area at bottom of hero */}
        <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24 }}>
          <h1
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontWeight: 800,
              fontSize: 34,
              lineHeight: '34px',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              color: colors.deepDusk,
              margin: 0,
            }}
          >
            {dest.city}
          </h1>
          <p
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 13,
              lineHeight: '16px',
              letterSpacing: '0.05em',
              color: colors.specText,
              margin: '4px 0 0',
            }}
          >
            {dest.country} &middot; {dest.region} &middot; {dest.vibe}
          </p>
        </div>
      </div>

      {/* ─── Editorial quote ──────────────────────────────────── */}
      <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p
          style={{
            fontFamily: `"${fonts.accent}", system-ui, sans-serif`,
            fontSize: 20,
            fontStyle: 'italic',
            fontWeight: 400,
            lineHeight: '30px',
            color: colors.bodyText,
            margin: 0,
          }}
        >
          {dest.quote}
        </p>
        <span
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: '16px',
            letterSpacing: '0.1em',
            color: colors.mutedText,
          }}
        >
          &mdash; SoGoJet Editors
        </span>
      </div>

      {/* ─── Flight Deal Card ─────────────────────────────────── */}
      <div style={{ padding: '0 24px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 16,
            padding: 20,
            gap: 16,
            backgroundColor: '#F2CEBC33',
            border: '1px solid #C9A99A40',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ ...sectionLabel, color: colors.sageDrift }}>Best Flight Deal</span>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 13,
                  lineHeight: '16px',
                  color: colors.borderTint,
                }}
              >
                {dest.flightRoute.replace('JFK', departureCode)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.seafoamMist,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 10,
                  lineHeight: '12px',
                  color: colors.darkerGreen,
                }}
              >
                Live price
              </span>
            </div>
          </div>

          {/* Price row */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 48,
                fontWeight: 800,
                lineHeight: '48px',
                color: colors.deepDusk,
              }}
            >
              ${dest.flightPrice}
            </span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 14,
                lineHeight: '18px',
                color: colors.borderTint,
                textDecoration: 'line-through',
              }}
            >
              ${dest.flightStrikethrough}
            </span>
          </div>

          {/* Date / class */}
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              lineHeight: '16px',
              color: colors.borderTint,
            }}
          >
            {dest.flightDates}
          </span>

          {/* Select button */}
          <button
            onClick={() => { setBookingDestination(stubDest.id); navigate('/booking/flights'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              borderRadius: 12,
              backgroundColor: colors.deepDusk,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: '20px',
                color: colors.paleHorizon,
              }}
            >
              Select This Flight
            </span>
          </button>
        </div>
      </div>

      {/* ─── Hotel Snapshot ───────────────────────────────────── */}
      {dest.hotels.length > 0 && <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={sectionLabel}>Hotel Snapshot</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {dest.hotels.map((hotel) => (
            <div
              key={hotel.name}
              style={{
                flex: '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                padding: 14,
                gap: 8,
                backgroundColor: '#111827',
                border: '1px solid #FFFFFF0F',
              }}
            >
              {/* Image placeholder */}
              <div
                style={{
                  width: '100%',
                  height: 60,
                  borderRadius: 8,
                  backgroundImage: `url(${hotel.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#1F2937',
                }}
              />
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 12,
                  lineHeight: '16px',
                  color: '#D1D5DB',
                }}
              >
                {hotel.name}
              </span>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: '18px',
                  color: '#F9FAFB',
                }}
              >
                {hotel.price}
              </span>
            </div>
          ))}
        </div>
      </div>}

      {/* ─── Best Time to Visit (Weather) ─────────────────────── */}
      {dest.weather.length > 0 && <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={sectionLabel}>Best Time to Visit</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dest.weather.map((w) => (
            <div key={w.month} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 28,
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: '14px',
                  color: colors.specText,
                  flexShrink: 0,
                }}
              >
                {w.month}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  overflow: 'hidden',
                  backgroundColor: '#F0EBE3',
                }}
              >
                <div
                  style={{
                    width: `${w.pct}%`,
                    height: 8,
                    borderRadius: 4,
                    background: `linear-gradient(90deg, #4A8B7A 0%, ${colors.warmDusk} 100%)`,
                  }}
                />
              </div>
              <span
                style={{
                  width: 32,
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: '14px',
                  color: colors.deepDusk,
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {w.temp}&deg;F
              </span>
            </div>
          ))}
        </div>
      </div>}

      {/* ─── About Section ────────────────────────────────────── */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={sectionTitle}>About {dest.city}</h2>
        {dest.aboutParas.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 15,
              fontWeight: 400,
              lineHeight: '24px',
              color: colors.bodyText,
              margin: 0,
            }}
          >
            {p}
          </p>
        ))}
      </div>

      {/* ─── Suggested Itinerary ──────────────────────────────── */}
      {dest.itinerary.length > 0 && <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={sectionTitle}>Suggested Itinerary</h2>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Timeline dots + line */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: 20,
              paddingTop: 6,
              flexShrink: 0,
              gap: 0,
            }}
          >
            {dest.itinerary.map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.seafoamMist,
                    flexShrink: 0,
                  }}
                />
                {i < dest.itinerary.length - 1 && (
                  <div style={{ width: 2, flex: 1, backgroundColor: '#E8E3D8', marginTop: 4, marginBottom: 4 }} />
                )}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 24 }}>
            {dest.itinerary.map((item, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 10,
                    fontWeight: 600,
                    lineHeight: '12px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: colors.sageDrift,
                  }}
                >
                  {item.days}
                </span>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 14,
                    fontWeight: 500,
                    lineHeight: '18px',
                    color: colors.deepDusk,
                  }}
                >
                  {item.title}
                </span>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 13,
                    lineHeight: '20px',
                    color: colors.borderTint,
                  }}
                >
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>}

      {/* ─── AI Trip Planner ──────────────────────────────────── */}
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 16,
            padding: 20,
            gap: 14,
            backgroundColor: '#7BAF8E15',
            backgroundImage: 'linear-gradient(135deg, rgba(168,196,184,0.25) 0%, rgba(168,196,184,0.12) 100%)',
            border: '1px solid #7BAF8E40',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: colors.confirmGreen,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: '18px',
                  color: colors.deepDusk,
                }}
              >
                AI Trip Planner
              </span>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 10,
                  lineHeight: '12px',
                  color: colors.confirmGreen,
                }}
              >
                Powered by Claude
              </span>
            </div>
          </div>

          <p
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 14,
              lineHeight: '21px',
              color: colors.bodyText,
              margin: 0,
            }}
          >
            Get a personalized day-by-day itinerary based on your travel style, budget, and interests.
          </p>

          <button
            onClick={handleGeneratePlan}
            disabled={tripPlanLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 44,
              borderRadius: 10,
              backgroundColor: colors.confirmGreen,
              flexShrink: 0,
              opacity: tripPlanLoading ? 0.7 : 1,
              cursor: tripPlanLoading ? 'wait' : 'pointer',
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: '18px',
                color: '#FFFFFF',
              }}
            >
              {tripPlanLoading ? 'Generating...' : tripPlan ? 'Regenerate Plan' : 'Generate My Trip Plan'}
            </span>
          </button>

          {/* Trip Plan Result */}
          {tripPlan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
              {tripPlan.days.map((day) => (
                <div key={day.day} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: colors.confirmGreen,
                    }}
                  >
                    Day {day.day} — {day.title}
                  </span>
                  {day.activities.map((act, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10 }}>
                      <span
                        style={{
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 11,
                          fontWeight: 500,
                          color: colors.sageDrift,
                          width: 60,
                          flexShrink: 0,
                        }}
                      >
                        {act.time}
                      </span>
                      <span
                        style={{
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 13,
                          lineHeight: '20px',
                          color: colors.bodyText,
                        }}
                      >
                        {act.activity}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#7BAF8E15',
                  borderRadius: 10,
                  padding: '10px 14px',
                }}
              >
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 12, color: colors.mutedText }}>
                  Est. budget
                </span>
                <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, fontWeight: 600, color: colors.deepDusk }}>
                  ${tripPlan.estimatedBudget.min}–${tripPlan.estimatedBudget.max}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Similar Destinations ─────────────────────────────── */}
      {dest.similar.length > 0 && <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={sectionTitle}>Similar Destinations</h2>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
          {dest.similar.map((s) => (
            <div
              key={s.city}
              onClick={() => {
                const found = STUB_DESTINATIONS.find((d) => d.city === s.city);
                if (found) navigate(`/destination/${found.id}`);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 140, flexShrink: 0, cursor: 'pointer' }}
            >
              <div
                style={{
                  width: 140,
                  height: 100,
                  borderRadius: 12,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${s.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: colors.deepDusk,
                  }}
                />
                {/* Gradient overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 50,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: '14px',
                    color: '#FFFFFF',
                  }}
                >
                  {s.city}
                </span>
              </div>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: '18px',
                  color: colors.deepDusk,
                }}
              >
                ${s.price}
              </span>
            </div>
          ))}
        </div>
      </div>}

      {/* ─── Sticky Book Bar (bottom CTA) ─────────────────────── */}
      <div
        style={{
          padding: '32px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: `linear-gradient(to top, ${colors.offWhite} 0%, ${colors.offWhite}F7 100%)`,
          marginTop: 24,
        }}
      >
        {/* Price reminder */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              lineHeight: '16px',
              color: colors.borderTint,
            }}
          >
            Round trip from {departureCode}
          </span>
          <span
            style={{
              fontFamily: `"${fonts.display}", system-ui, sans-serif`,
              fontSize: 20,
              fontWeight: 700,
              lineHeight: '24px',
              color: colors.deepDusk,
            }}
          >
            ${dest.flightPrice}
          </span>
        </div>

        <button
          onClick={() => { setBookingDestination(stubDest.id); navigate('/booking/flights'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.deepDusk,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 17,
              fontWeight: 600,
              lineHeight: '20px',
              color: colors.paleHorizon,
            }}
          >
            Book This Trip
          </span>
        </button>
      </div>
    </div>
  );
}
