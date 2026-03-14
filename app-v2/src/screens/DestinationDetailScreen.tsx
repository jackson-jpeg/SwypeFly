import { useCallback, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fonts, useThemeColors } from '@/tokens';
import { STUB_DESTINATIONS } from '@/api/stubs';
import { useDestination } from '@/hooks/useDestination';
import { useSavedStore } from '@/stores/savedStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthContext } from '@/hooks/AuthContext';
import PhotoGallery from '@/components/PhotoGallery';
import type { Destination } from '@/api/types';

function getDefaultDetail(dest: Destination) {
  // Build itinerary from destination data if available
  const itinerary = (dest.itinerary ?? []).map((item) => ({
    days: `Day ${item.day}`,
    title: item.activities[0] ?? 'Explore',
    desc: item.activities.slice(1).join('. ') || item.activities[0] || '',
  }));

  // Use API-provided similar destinations, fall back to overlap-scored matching
  const similarDests = (dest.similarDestinations ?? []).length > 0
    ? dest.similarDestinations!.map((d) => ({ id: d.id, city: d.city, price: d.flightPrice, image: d.imageUrl }))
    : (() => {
        const candidates = STUB_DESTINATIONS
          .filter((d) => d.id !== dest.id)
          .map((d) => {
            const sharedVibes = d.vibeTags.filter((t) => dest.vibeTags.includes(t)).length;
            const sameRegion = d.country === dest.country ? 2 : 0;
            return { d, score: sharedVibes + sameRegion };
          })
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        return candidates.map((c) => ({ id: c.d.id, city: c.d.city, price: c.d.flightPrice, image: c.d.imageUrl }));
      })();

  return {
    region: dest.country,
    vibes: dest.vibeTags.length > 0 ? dest.vibeTags : ['Adventure'],
    quote: dest.tagline ?? `Discover the magic of ${dest.city}.`,
    flightStrikethrough: dest.previousPrice || undefined,
    flightRoute: `${dest.iataCode ?? dest.city} · Round trip`,
    flightDates: dest.departureDate && dest.returnDate && dest.departureDate >= new Date().toISOString().slice(0, 10)
      ? `${new Date(dest.departureDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(dest.returnDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · Economy`
      : 'Flexible dates · Economy',
    hotels: (dest.imageUrls ?? []).slice(0, 2).map((img, i) => ({
      name: i === 0 ? 'Best Value Stay' : 'Top Rated Stay',
      price: dest.liveHotelPrice
        ? `$${Math.round(dest.liveHotelPrice * (i === 0 ? 1 : 1.3))}/nt`
        : `$${Math.round(dest.hotelPricePerNight * (i === 0 ? 1 : 1.3))}/nt`,
      image: img,
    })),
    aboutParas: [dest.description || `${dest.city} awaits with incredible experiences and unforgettable moments.`],
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

/* ── section styles (now using theme) ─────────────────────────── */

/* ── component ─────────────────────────────────────────────────── */
export default function DestinationDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: stubDest, isLoading } = useDestination(id);
  const { isSaved, toggle } = useSavedStore();
  const { session } = useAuthContext();
  const { departureCode } = useUIStore();
  const t = useThemeColors();
  const [itineraryExpanded, setItineraryExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  /* ── Parallax scroll tracking ────────────────────────────────── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setScrollY(el.scrollTop);
  }, []);

  if (isLoading) {
    return (
      <div className="screen" style={{ background: t.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: t.muted }}>Loading...</span>
      </div>
    );
  }

  if (!stubDest) {
    return (
      <div className="screen" style={{ background: t.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, color: t.muted }}>Destination not found</span>
      </div>
    );
  }

  const detail = getDefaultDetail(stubDest);

  const dest = {
    ...stubDest,
    heroImage: stubDest.imageUrl,
    ...detail,
    flightStrikethrough: detail.flightStrikethrough ?? 0,
  };

  const handleBooking = () => {
    const affiliateUrl = stubDest.affiliateUrl
      || `https://www.aviasales.com/search/${departureCode}${stubDest.iataCode}1`;
    window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  // Theme-aware section styles
  const sectionLabel: React.CSSProperties = {
    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
    fontSize: 10,
    fontWeight: 600,
    lineHeight: '12px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: t.labelText,
    margin: 0,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
    fontSize: 18,
    fontWeight: 700,
    lineHeight: '22px',
    color: t.primary,
    margin: 0,
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="screen"
      style={{
        background: t.canvas,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: '100%', height: 420, flexShrink: 0, overflow: 'hidden' }}>
        {/* Parallax photo / gallery */}
        {(() => {
          const heroImages =
            stubDest.imageUrls && stubDest.imageUrls.length > 0
              ? stubDest.imageUrls
              : [dest.heroImage];
          const parallaxStyle: React.CSSProperties = {
            position: 'absolute' as const,
            inset: 0,
            top: -40, /* extra room for parallax travel */
            bottom: -40,
            transform: `translateY(${scrollY * 0.3}px) scale(1.1)`,
            transformOrigin: 'center center',
            willChange: 'transform',
          };

          return heroImages.length > 1 ? (
            <div style={parallaxStyle}>
              <PhotoGallery
                images={heroImages}
                height={420 + 80} /* account for extra parallax room */
              />
            </div>
          ) : (
            <div
              style={{
                ...parallaxStyle,
                backgroundImage: `url(${heroImages[0]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: t.ctaBg,
              }}
            />
          );
        })()}
        {/* Bottom gradient overlay — transparent to page background */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 250,
            background: `linear-gradient(to top, ${t.canvas} 0%, ${t.canvas}99 30%, transparent 100%)`,
            pointerEvents: 'none',
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
              onClick={async () => {
                const shareUrl = `https://sogojet.com/destination/${stubDest.id}`;
                const shareText = `Check out ${stubDest.city}, ${stubDest.country} on SoGoJet — flights from $${stubDest.flightPrice}!`;
                if (navigator.share) {
                  try {
                    await navigator.share({ title: `${stubDest.city} — SoGoJet`, text: shareText, url: shareUrl });
                  } catch {
                    // User cancelled or share failed — ignore
                  }
                } else {
                  try {
                    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  } catch {
                    // Clipboard unavailable
                  }
                }
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: shareCopied ? 'rgba(75,139,122,0.6)' : 'rgba(0,0,0,0.25)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s ease',
              }}
              title={shareCopied ? 'Link copied!' : 'Share destination'}
            >
              {shareCopied ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <ShareIcon />
              )}
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
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              color: t.primary,
              margin: 0,
              wordBreak: 'break-word',
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
              color: t.muted,
              margin: '4px 0 0',
            }}
          >
            {dest.country}{dest.region !== dest.country ? ` \u00B7 ${dest.region}` : ''} &middot; {dest.vibes.join(' \u00B7 ')}
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
            color: t.body,
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
            color: t.muted,
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
              <span style={{ ...sectionLabel, color: t.accent }}>Best Flight Deal</span>
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 13,
                  lineHeight: '16px',
                  color: t.muted,
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
                  backgroundColor: stubDest.priceSource === 'estimate' ? t.border : t.accentSoft,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 10,
                  lineHeight: '12px',
                  color: stubDest.priceSource === 'estimate' ? t.border : t.accent,
                }}
              >
                {stubDest.priceSource === 'travelpayouts' || stubDest.priceSource === 'amadeus' || stubDest.priceSource === 'duffel' ? 'Live price' : 'Estimated'}
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
                color: t.primary,
              }}
            >
              ${dest.flightPrice}
            </span>
            {dest.flightStrikethrough > 0 && dest.flightStrikethrough !== dest.flightPrice && (
              <span
                style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 14,
                  lineHeight: '18px',
                  color: t.muted,
                  textDecoration: 'line-through',
                }}
              >
                ${dest.flightStrikethrough}
              </span>
            )}
          </div>

          {/* Date / class */}
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 12,
              lineHeight: '16px',
              color: t.muted,
            }}
          >
            {dest.flightDates}
          </span>

          {/* CTA button */}
          <button
            onClick={handleBooking}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              borderRadius: 12,
              backgroundColor: t.ctaBg,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: '20px',
                color: t.ctaText,
              }}
            >
              Find Flights
            </span>
          </button>
        </div>
      </div>

      {/* Price charts hidden for v1 — enable with VITE_SHOW_ADVANCED_DETAIL=true */}

      {/* ─── Affiliate Compare Button ─────────────────────────── */}
      {stubDest.affiliateUrl && (
        <div style={{ padding: '0 24px 16px' }}>
          <a
            href={stubDest.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 44,
              borderRadius: 12,
              border: `1.5px solid ${t.border}`,
              backgroundColor: 'transparent',
              textDecoration: 'none',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>🔍</span>
            <span
              style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 13,
                fontWeight: 500,
                color: t.body,
              }}
            >
              Compare prices on Aviasales
            </span>
          </a>
        </div>
      )}

      {/* Hotel snapshot hidden for v1 */}

      {/* ─── Best Time to Visit ──────────────────────────────── */}
      {stubDest.bestMonths?.length > 0 && <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={sectionLabel}>Best Time to Visit</span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 14,
            lineHeight: '20px',
            color: t.body,
          }}
        >
          {stubDest.bestMonths.join(', ')}
        </span>
      </div>}

      {/* Weather widget hidden for v1 */}

      {/* ─── About Section ────────────────────────────────────── */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={sectionTitleStyle}>About {dest.city}</h2>
        {dest.aboutParas.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 15,
              fontWeight: 400,
              lineHeight: '24px',
              color: t.body,
              margin: 0,
            }}
          >
            {p}
          </p>
        ))}
      </div>

      {/* ─── Suggested Itinerary ─────────────────────────────── */}
      {stubDest.itinerary && stubDest.itinerary.length > 0 && (
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => setItineraryExpanded((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <h2 style={sectionTitleStyle}>Suggested Itinerary</h2>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: itineraryExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {itineraryExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stubDest.itinerary.map((item) => (
                <div
                  key={item.day}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: t.surface,
                    border: `1px solid ${t.border}20`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: t.accent,
                    }}
                  >
                    Day {item.day}
                  </span>
                  {item.activities.map((activity, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span
                        style={{
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 13,
                          lineHeight: '14px',
                          color: t.accent,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        &bull;
                      </span>
                      <span
                        style={{
                          fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                          fontSize: 14,
                          lineHeight: '21px',
                          color: t.body,
                        }}
                      >
                        {activity}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Top Restaurants ──────────────────────────────────── */}
      {stubDest.restaurants && stubDest.restaurants.length > 0 && (
        <div style={{ padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={sectionLabel}>Top Restaurants</span>
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 4,
            }}
          >
            {stubDest.restaurants.map((restaurant) => (
              <div
                key={restaurant.name}
                style={{
                  minWidth: 160,
                  maxWidth: 200,
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: t.surface,
                  border: `1px solid ${t.border}20`,
                }}
              >
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: '18px',
                    color: t.primary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {restaurant.name}
                </span>
                <span
                  style={{
                    fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                    fontSize: 11,
                    lineHeight: '14px',
                    color: t.muted,
                    textTransform: 'capitalize',
                  }}
                >
                  {restaurant.type}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 12,
                      fontWeight: 700,
                      color: t.accent,
                    }}
                  >
                    {restaurant.rating.toFixed(1)}
                  </span>
                  <span
                    style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontSize: 11,
                      color: t.muted,
                    }}
                  >
                    {Array.from({ length: Math.round(restaurant.rating) }, () => '\u2605').join('')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI trip planner hidden for v1 */}

      {/* ─── Similar Destinations ─────────────────────────────── */}
      {dest.similar.length > 0 && <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={sectionTitleStyle}>Similar Destinations</h2>
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
                    backgroundImage: s.image ? `url(${s.image})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    background: s.image ? undefined : `linear-gradient(135deg, ${t.accent} 0%, ${t.primary} 100%)`,
                    display: !s.image ? 'flex' : undefined,
                    alignItems: !s.image ? 'center' : undefined,
                    justifyContent: !s.image ? 'center' : undefined,
                    fontSize: !s.image ? 28 : undefined,
                  }}
                >
                  {!s.image && '✈️'}
                </div>
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
                  color: t.primary,
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
          background: `linear-gradient(to top, ${t.surface} 0%, ${t.surface}F7 100%)`,
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
              color: t.muted,
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
              color: t.primary,
            }}
          >
            ${dest.flightPrice}
          </span>
        </div>

        <button
          onClick={handleBooking}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            borderRadius: 14,
            backgroundColor: t.primary,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 17,
              fontWeight: 600,
              lineHeight: '20px',
              color: t.ctaText,
            }}
          >
            Find Flights
          </span>
        </button>
      </div>
    </div>
  );
}
