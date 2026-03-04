import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { API_BASE } from '@/api/client';
import { STUB_DESTINATIONS } from '@/api/stubs';
import { useDestination } from '@/hooks/useDestination';
import { useSavedStore } from '@/stores/savedStore';
import { useBookingStore } from '@/stores/bookingStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthContext } from '@/hooks/AuthContext';
import PriceAlertButton from '@/components/PriceAlertButton';
import type { TripPlan, Destination } from '@/api/types';

function getDefaultDetail(dest: Destination) {
  // Build itinerary from destination data if available
  const itinerary = (dest.itinerary ?? []).map((item) => ({
    days: `Day ${item.day}`,
    title: item.activities[0] ?? 'Explore',
    desc: item.activities.slice(1).join('. ') || item.activities[0] || '',
  }));

  // Use API-provided similar destinations, fall back to stub lookup
  const similarDests = (dest.similarDestinations ?? []).length > 0
    ? dest.similarDestinations!.map((d) => ({ id: d.id, city: d.city, price: d.flightPrice, image: d.imageUrl }))
    : STUB_DESTINATIONS
        .filter((d) => d.id !== dest.id && (d.country === dest.country || d.vibeTags[0] === dest.vibeTags[0]))
        .slice(0, 3)
        .map((d) => ({ id: d.id, city: d.city, price: d.flightPrice, image: d.imageUrl }));

  return {
    region: dest.country,
    vibe: dest.vibeTags[0] ?? 'Adventure',
    quote: dest.tagline ?? `Discover the magic of ${dest.city}.`,
    flightStrikethrough: dest.previousPrice ?? undefined,
    flightRoute: `${dest.iataCode ?? dest.city} · Round trip`,
    flightDates: dest.departureDate && dest.returnDate
      ? `${dest.departureDate} – ${dest.returnDate} · Economy`
      : 'Flexible dates · Economy',
    hotels: (dest.imageUrls ?? []).slice(0, 2).map((img, i) => ({
      name: i === 0 ? `Top Stay in ${dest.city}` : `Hotel Pick ${i + 1}`,
      price: dest.liveHotelPrice ? `$${dest.liveHotelPrice}/nt` : `$${dest.hotelPricePerNight}/nt`,
      image: img,
    })),
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
  const { data: stubDest, isLoading } = useDestination(id);
  const { isSaved, toggle } = useSavedStore();
  const { session } = useAuthContext();
  const setBookingDestination = useBookingStore((s) => s.setDestination);
  const { departureCode } = useUIStore();
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [tripPlanText, setTripPlanText] = useState('');
  const [tripPlanLoading, setTripPlanLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="screen" style={{ background: colors.duskSand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: colors.mutedText }}>Loading...</span>
      </div>
    );
  }

  if (!stubDest) {
    return (
      <div className="screen" style={{ background: colors.duskSand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, color: colors.mutedText }}>Destination not found</span>
      </div>
    );
  }

  const detail = getDefaultDetail(stubDest);

  const dest = {
    ...stubDest,
    heroImage: stubDest.imageUrl,
    ...detail,
    flightStrikethrough: detail.flightStrikethrough ?? Math.round(stubDest.flightPrice * 1.4),
  };

  const generateLocalPlan = (): TripPlan => {
    const itinerary = stubDest.itinerary ?? [];
    const restaurants = stubDest.restaurants ?? [];
    return {
      days: itinerary.length > 0
        ? itinerary.map((item) => ({
            day: item.day,
            title: item.activities[0] ?? `Day ${item.day}`,
            activities: item.activities.map((a, i) => ({
              time: i === 0 ? 'Morning' : i === 1 ? 'Afternoon' : 'Evening',
              activity: a,
            })),
          }))
        : [
            { day: 1, title: `Arrive in ${stubDest.city}`, activities: [{ time: 'Morning', activity: 'Arrive and settle in' }, { time: 'Afternoon', activity: 'Explore the city center' }, { time: 'Evening', activity: restaurants[0] ? `Dinner at ${restaurants[0].name}` : 'Local dinner' }] },
            { day: 2, title: 'Local Highlights', activities: [{ time: 'Morning', activity: 'Visit top attractions' }, { time: 'Afternoon', activity: stubDest.vibeTags.includes('beach') ? 'Beach afternoon' : 'Cultural exploration' }, { time: 'Evening', activity: restaurants[1] ? `Try ${restaurants[1].name}` : 'Evening stroll' }] },
            { day: 3, title: 'Hidden Gems & Departure', activities: [{ time: 'Morning', activity: 'Off-the-beaten-path exploration' }, { time: 'Afternoon', activity: 'Souvenir shopping & last bites' }, { time: 'Evening', activity: `Depart ${stubDest.city}` }] },
          ],
      estimatedBudget: {
        min: Math.round(stubDest.flightPrice * 1.5),
        max: Math.round(stubDest.flightPrice * 3),
        currency: 'USD',
      },
    };
  };

  const handleGeneratePlan = async () => {
    setTripPlanLoading(true);
    setTripPlanText('');
    setTripPlan(null);

    try {
      const res = await fetch(`${API_BASE}/api/ai/trip-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: stubDest.city,
          country: stubDest.country,
          duration: 3,
          style: 'comfort',
          interests: stubDest.vibeTags.slice(0, 3).join(', '),
        }),
      });

      if (!res.ok || !res.body) throw new Error('API unavailable');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setTripPlanText(text);
      }
    } catch {
      // Fallback to local plan generation
      setTripPlanText('');
      setTripPlan(generateLocalPlan());
    }

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
              onClick={() => toggle(stubDest.id, session?.userId)}
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
                {departureCode} → {dest.flightRoute}
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

          {/* Price alert */}
          <PriceAlertButton destinationId={stubDest.id} currentPrice={dest.flightPrice} />

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
                backgroundColor: colors.offWhite,
                border: `1px solid ${colors.borderTint}40`,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: 60,
                  borderRadius: 8,
                  backgroundImage: `url(${hotel.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: colors.duskSand,
                }}
              />
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 12,
                  lineHeight: '16px',
                  color: colors.specText,
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
                  color: colors.deepDusk,
                }}
              >
                {hotel.price}
              </span>
            </div>
          ))}
        </div>
      </div>}

      {/* ─── Best Time to Visit ──────────────────────────────── */}
      {stubDest.bestMonths?.length > 0 && <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={sectionLabel}>Best Time to Visit</span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 14,
            lineHeight: '20px',
            color: colors.bodyText,
          }}
        >
          {stubDest.bestMonths.join(', ')}
        </span>
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
              {tripPlanLoading ? 'Generating...' : (tripPlan || tripPlanText) ? 'Regenerate Plan' : 'Generate My Trip Plan'}
            </span>
          </button>

          {/* AI-Streamed Trip Plan */}
          {tripPlanText && (
            <div
              style={{
                marginTop: 4,
                padding: '16px',
                backgroundColor: colors.offWhite,
                borderRadius: 12,
                border: `1px solid ${colors.borderTint}`,
              }}
            >
              <pre
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 13,
                  lineHeight: '21px',
                  color: colors.bodyText,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  margin: 0,
                }}
              >
                {tripPlanText}
              </pre>
            </div>
          )}

          {/* Structured Trip Plan Fallback */}
          {tripPlan && !tripPlanText && (
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
                const targetId = s.id || STUB_DESTINATIONS.find((d) => d.city === s.city)?.id;
                if (targetId) navigate(`/destination/${targetId}`);
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
