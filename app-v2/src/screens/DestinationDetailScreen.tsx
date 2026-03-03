import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { STUB_TRIP_PLAN } from '@/api/stubs';
import type { TripPlan } from '@/api/types';

/* ── stub data ─────────────────────────────────────────────────── */
const DEST = {
  id: 'santorini',
  city: 'Santorini',
  country: 'Greece',
  region: 'Aegean Islands',
  vibe: 'Romance',
  heroImage: '/images/santorini.jpg',
  quote:
    'Sun-bleached walls tumble toward the caldera, each sunset more impossible than the last.',
  flightPrice: 387,
  flightStrikethrough: 542,
  flightRoute: 'JFK \u2192 JTR \u00b7 Round trip',
  flightDates: 'Jun 15 \u2013 Jun 22 \u00b7 Economy \u00b7 1 stop via ATH',
  hotels: [
    { name: 'Canaves Oia', price: '$289/nt', image: '/images/canaves.jpg' },
    { name: 'Astra Suites', price: '$196/nt', image: '/images/astra.jpg' },
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
    {
      days: 'Day 1\u20132',
      title: 'Oia & Caldera Views',
      desc: 'Explore the iconic blue domes, watch the legendary sunset from the castle ruins.',
    },
    {
      days: 'Day 3\u20134',
      title: 'Beaches & Wine',
      desc: "Red Beach, Kamari\u2019s black sands, then an afternoon wine tasting in Megalochori.",
    },
    {
      days: 'Day 5\u20137',
      title: 'Hidden Gems & Departure',
      desc: 'Akrotiri archaeological site, catamaran cruise, farewell dinner at Ammoudi Bay.',
    },
  ],
  similar: [
    { city: 'Mykonos', price: 412, image: '/images/mykonos.jpg' },
    { city: 'Amalfi Coast', price: 523, image: '/images/amalfi.jpg' },
    { city: 'Dubrovnik', price: 389, image: '/images/dubrovnik.jpg' },
  ],
};

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
  const { id: _id } = useParams<{ id: string }>();
  const dest = DEST; // later: look up by id
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [tripPlanLoading, setTripPlanLoading] = useState(false);

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
              <HeartOutline />
            </button>
            <button
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
                {dest.flightRoute}
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
            onClick={() => navigate('/booking/flights')}
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
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
      </div>

      {/* ─── Best Time to Visit (Weather) ─────────────────────── */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
      </div>

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
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
      </div>

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
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={sectionTitle}>Similar Destinations</h2>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
          {dest.similar.map((s) => (
            <div key={s.city} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 140, flexShrink: 0 }}>
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
      </div>

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
            Round trip from JFK
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
          onClick={() => navigate('/booking/flights')}
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
