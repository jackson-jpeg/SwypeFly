import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts, useThemeColors } from '@/tokens';
import { useFeed } from '@/hooks/useFeed';
import { useSavedStore } from '@/stores/savedStore';
import { useFeedStore } from '@/stores/feedStore';
import { useAuthContext } from '@/hooks/AuthContext';
import { useSwipeTracking } from '@/hooks/useSwipeTracking';
import type { Destination } from '@/api/types';
import BottomNav from '@/components/BottomNav';
import FilterBar from '@/components/feed/FilterBar';
import SearchOverlay from '@/components/feed/SearchOverlay';
import SkeletonCard from '@/components/feed/SkeletonCard';
import MapView from '@/components/feed/MapView';
import TrendingStories from '@/components/feed/TrendingStories';
import AirlineLogo from '@/components/AirlineLogo';
import { getAirlineName } from '@/utils/airlines';
import { formatFreshness } from '@/utils/formatFreshness';

function FeedCard({ destination, onSave }: { destination: Destination; onSave?: (id: string) => void }) {
  const navigate = useNavigate();
  const { isSaved, toggle } = useSavedStore();
  const { session } = useAuthContext();
  const t = useThemeColors();
  const saved = isSaved(destination.id);
  const [imageLoaded, setImageLoaded] = useState(false);

  const hasImage = !!destination.imageUrl;

  useEffect(() => {
    if (!hasImage) { setImageLoaded(true); return; }
    setImageLoaded(false);
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = destination.imageUrl;
  }, [destination.imageUrl]);

  const glassButton: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    backgroundColor: t.actionBtnBg,
    border: `1px solid ${t.border}`,
    cursor: 'pointer',
    padding: 0,
  };

  return (
    <div
      style={{
        height: '100%',
        minHeight: '100%',
        width: '100%',
        position: 'relative',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        overflow: 'hidden',
      }}
    >
      {/* Full-bleed photo or gradient fallback */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...(hasImage
            ? { backgroundImage: `url(${destination.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: `linear-gradient(135deg, #1a2a3a 0%, #2d1b3d 40%, #1a3a2a 70%, ${t.canvas} 100%)` }),
          backgroundColor: t.canvas,
          filter: imageLoaded ? 'none' : 'blur(20px)',
          transform: imageLoaded ? 'scale(1)' : 'scale(1.1)',
          transition: 'filter 0.5s ease, transform 0.5s ease',
        }}
      />
      {/* Bottom gradient overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '65%',
          background: t.heroGradient,
        }}
      />

      {/* Right side action buttons */}
      <div style={{ position: 'absolute', right: 16, bottom: 220, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <button
          aria-label={saved ? 'Remove from saved' : 'Save destination'}
          style={glassButton}
          onClick={(e) => { e.stopPropagation(); toggle(destination.id, session?.userId); if (!saved) onSave?.(destination.id); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? '#FFFFFF' : 'none'} stroke="#FFFFFF" strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <button
          aria-label="Share destination"
          style={glassButton}
          onClick={(e) => {
            e.stopPropagation();
            const url = `${window.location.origin}/destination/${destination.id}`;
            if (navigator.share) {
              navigator.share({ title: `${destination.city} — SoGoJet`, text: destination.tagline, url }).catch(() => {});
            } else {
              navigator.clipboard.writeText(url).catch(() => {});
            }
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
        <button
          aria-label="View destination details"
          style={glassButton}
          onClick={(e) => { e.stopPropagation(); navigate(`/destination/${destination.id}`); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>

      {/* Destination info */}
      <div
        onClick={() => navigate(`/destination/${destination.id}`)}
        style={{ position: 'absolute', bottom: 160, left: 20, right: 72, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
      >
        <div
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 'clamp(26px, 8vw, 32px)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: t.primary,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {destination.city}
        </div>
        <div
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 15,
            lineHeight: '20px',
            color: t.body,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {destination.tagline}
        </div>
        {/* Tags row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, letterSpacing: '0.08em', lineHeight: '14px', textTransform: 'uppercase', color: t.muted }}>
            {destination.country}
          </span>
          {destination.vibeTags.slice(0, 2).map((tag) => (
            <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: t.muted, flexShrink: 0 }} />
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, letterSpacing: '0.08em', lineHeight: '14px', textTransform: 'uppercase', color: t.muted }}>
                {tag}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Price pill */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          paddingBlock: 10,
          paddingInline: 16,
          borderRadius: 16,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: t.priceBadge,
          border: `1px solid ${t.border}`,
        }}
      >
        {/* Row 1: Price + dates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {destination.priceSource === 'estimate' && (
            <span style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 11, lineHeight: '14px', color: t.muted,
            }}>
              From
            </span>
          )}
          <span style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
            lineHeight: '26px', color: t.priceText,
          }}>
            ${destination.flightPrice}
          </span>
          {destination.priceDirection === 'down' && destination.priceDropPercent != null && destination.priceDropPercent > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              paddingBlock: 2,
              paddingInline: 4,
              borderRadius: 6,
              backgroundColor: `${colors.confirmGreen}25`,
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '14px',
              color: colors.confirmGreen,
            }}>
              {'\u2193'}{destination.priceDropPercent}%
            </span>
          )}
          {destination.priceDirection === 'up' && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              paddingBlock: 2,
              paddingInline: 4,
              borderRadius: 6,
              backgroundColor: '#D4736C25',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '14px',
              color: '#D4736C',
            }}>
              {'\u2191'}
            </span>
          )}
          {destination.departureDate && destination.returnDate && new Date(destination.departureDate + 'T00:00:00') > new Date() && (
            <span style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 11, lineHeight: '14px', color: t.body,
            }}>
              {new Date(destination.departureDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' \u2013 '}
              {new Date(destination.returnDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {/* Row 2: Airline + live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {destination.airline && destination.priceSource !== 'estimate' && (
            <>
              <AirlineLogo code={destination.airline} size={14} />
              <span style={{
                fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                fontSize: 10, lineHeight: '12px', color: t.muted,
              }}>
                {getAirlineName(destination.airline!)}
              </span>
            </>
          )}
          <span style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', lineHeight: '12px',
            color: destination.priceSource === 'estimate' ? t.muted : t.priceBadgeText,
          }}>
            {destination.priceSource !== 'estimate' ? 'LIVE' : 'EST.'}
          </span>
          {destination.tpFoundAt && (() => {
            const freshness = formatFreshness(destination.tpFoundAt!);
            return freshness ? (
              <>
                <span style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: t.muted, flexShrink: 0 }} />
                <span style={{
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 10, lineHeight: '12px', color: t.muted,
                }}>
                  Seen {freshness}
                </span>
              </>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}

export default function FeedScreen() {
  const t = useThemeColors();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards');
  const { scrollIndex: currentIndex, setScrollIndex: setCurrentIndex, filters, isSearchOpen, setSearchOpen, clearFilters, hasActiveFilters } = useFeedStore();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } = useFeed();
  const { trackView, trackSave, trackSkip } = useSwipeTracking();
  const { isSaved } = useSavedStore();

  const destinations = useMemo(
    () => data?.pages.flatMap((p) => p.destinations) ?? [],
    [data],
  );

  // Reset scroll to top when filters change
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed =
      prev.vibes.join(',') !== filters.vibes.join(',') ||
      prev.region.join(',') !== filters.region.join(',') ||
      prev.minPrice !== filters.minPrice ||
      prev.maxPrice !== filters.maxPrice;
    prevFiltersRef.current = filters;
    if (changed && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      setCurrentIndex(0);
    }
  }, [filters, setCurrentIndex]);

  // Track scroll position + prefetch next page when near end
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let prevIdx = currentIndex;
    const handleScroll = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight);
      if (idx === prevIdx) return;
      // Track skip when scrolling forward past an unsaved card
      if (idx > prevIdx) {
        const prevDest = destinations[prevIdx];
        if (prevDest && !isSaved(prevDest.id)) {
          trackSkip(prevDest.id, prevDest.flightPrice);
        }
      }
      prevIdx = idx;
      setCurrentIndex(idx);
      // Track view when card comes into focus
      const dest = destinations[idx];
      if (dest) trackView(dest.id, dest.flightPrice);
      // Prefetch when within 3 items of the end
      if (idx >= destinations.length - 3 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    // Track first card on mount
    if (destinations[0]) trackView(destinations[0].id, destinations[0].flightPrice);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [destinations.length, hasNextPage, isFetchingNextPage, fetchNextPage, trackView, trackSkip, isSaved, currentIndex]);

  const restoredRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !destinations.length || restoredRef.current) return;
    restoredRef.current = true;
    if (currentIndex > 0) {
      el.scrollTo({ top: currentIndex * el.clientHeight, behavior: 'instant' as ScrollBehavior });
    }
  }, [destinations.length]);

  const glassButton: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    backgroundColor: t.actionBtnBg,
    border: `1px solid ${t.border}`,
    cursor: 'pointer',
    padding: 0,
  };

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="screen-fixed" style={{ background: t.canvas, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <FilterBar />
        <div style={{ flex: 1 }}>
          <SkeletonCard />
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
          <BottomNav />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="screen-fixed" style={{ background: t.canvas, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, color: t.body }}>Could not load destinations</span>
        <button
          onClick={() => refetch()}
          style={{
            paddingBlock: 10,
            paddingInline: 24,
            borderRadius: 10,
            backgroundColor: t.actionBtnBg,
            border: `1px solid ${t.border}`,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: t.body }}>Try Again</span>
        </button>
      </div>
    );
  }

  // Empty state (filters active but no results)
  if (destinations.length === 0) {
    return (
      <div className="screen-fixed" style={{ background: t.canvas, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <FilterBar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, color: t.muted, textAlign: 'center' }}>
            No destinations match your filters
          </span>
          {hasActiveFilters() && (
            <button
              onClick={() => clearFilters()}
              style={{
                paddingBlock: 10,
                paddingInline: 24,
                borderRadius: 10,
                backgroundColor: t.actionBtnBg,
                border: `1px solid ${t.border}`,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: t.body }}>Clear Filters</span>
            </button>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
          <BottomNav />
        </div>
      </div>
    );
  }

  return (
    <div className="screen-fixed" style={{ background: t.canvas, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Filter bar at top */}
      <FilterBar />

      {/* Trending stories row */}
      <TrendingStories
        destinations={destinations}
        onSelect={(dest) => navigate(`/destination/${dest.id}`)}
      />

      {/* Top-right controls: view toggle + search */}
      <div style={{ position: 'absolute', top: 50, right: 12, zIndex: 11, display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* View mode toggle */}
        <div
          style={{
            display: 'flex',
            borderRadius: 20,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            backgroundColor: t.actionBtnBg,
            border: `1px solid ${t.border}`,
            overflow: 'hidden',
          }}
        >
          <button
            aria-label="Card view"
            onClick={() => setViewMode('cards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              padding: 0,
              border: 'none',
              background: viewMode === 'cards' ? '#FFFFFF20' : 'transparent',
              borderRadius: '18px 0 0 18px',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={viewMode === 'cards' ? colors.sageDrift : '#FFFFFF80'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            aria-label="Map view"
            onClick={() => setViewMode('map')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              padding: 0,
              border: 'none',
              background: viewMode === 'map' ? '#FFFFFF20' : 'transparent',
              borderRadius: '0 18px 18px 0',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={viewMode === 'map' ? colors.sageDrift : '#FFFFFF80'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        </div>

        {/* Search button */}
        <button
          aria-label="Search destinations"
          onClick={() => setSearchOpen(true)}
          style={glassButton}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFFCC" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {/* Content area: cards or map */}
      {viewMode === 'cards' ? (
        <>
          {/* Vertical scroll container */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              scrollSnapType: 'y mandatory',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {destinations.map((dest) => (
              <FeedCard key={dest.id} destination={dest} onSave={(id) => trackSave(id, dest.flightPrice)} />
            ))}
          </div>

          {/* Scroll progress bar */}
          {destinations.length > 1 && (
            <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 3, height: 80, borderRadius: 2, backgroundColor: t.border, zIndex: 20, overflow: 'hidden' }}>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(10, 100 / destinations.length)}%`,
                  borderRadius: 2,
                  backgroundColor: t.primary,
                  transform: `translateY(${(currentIndex / Math.max(1, destinations.length - 1)) * (80 - 80 * Math.max(10, 100 / destinations.length) / 100)}px)`,
                  transition: 'transform 0.2s',
                }}
              />
            </div>
          )}
        </>
      ) : (
        <MapView
          destinations={destinations}
          onSelect={(dest) => navigate(`/destination/${dest.id}`)}
        />
      )}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
        <BottomNav />
      </div>

      {/* Search overlay */}
      {isSearchOpen && <SearchOverlay />}
    </div>
  );
}
