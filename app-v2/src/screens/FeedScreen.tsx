import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
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
import AirlineLogo from '@/components/AirlineLogo';

function FeedCard({ destination, onSave }: { destination: Destination; onSave?: (id: string) => void }) {
  const navigate = useNavigate();
  const { isSaved, toggle } = useSavedStore();
  const { session } = useAuthContext();
  const saved = isSaved(destination.id);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
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
    backgroundColor: '#FFFFFF14',
    border: '1px solid #FFFFFF1F',
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
      {/* Full-bleed photo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${destination.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#0A0F1E',
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
          background: 'linear-gradient(to top, rgba(10,15,30,1) 0%, rgba(10,15,30,0.95) 20%, rgba(10,15,30,0.7) 45%, transparent 100%)',
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
            fontSize: 'clamp(26px, 8vw, 36px)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {destination.city}
        </div>
        <div
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 15,
            lineHeight: '20px',
            color: '#FFFFFFB3',
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
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, letterSpacing: '0.08em', lineHeight: '14px', textTransform: 'uppercase', color: '#FFFFFF73' }}>
            {destination.country}
          </span>
          {destination.vibeTags.slice(0, 2).map((tag) => (
            <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF40', flexShrink: 0 }} />
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, letterSpacing: '0.08em', lineHeight: '14px', textTransform: 'uppercase', color: '#FFFFFF73' }}>
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
          backgroundColor: '#2C1F1AE6',
          border: '1px solid #FFFFFF1A',
        }}
      >
        {/* Row 1: Price + dates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {destination.priceSource === 'estimate' && (
            <span style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 11, lineHeight: '14px', color: colors.borderTint,
            }}>
              From
            </span>
          )}
          <span style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
            lineHeight: '26px', color: colors.sunriseButter,
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
          {destination.departureDate && destination.returnDate && (
            <span style={{
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 11, lineHeight: '14px', color: '#FFFFFFAA',
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
                fontSize: 10, lineHeight: '12px', color: '#FFFFFF80',
              }}>
                {destination.airline}
              </span>
            </>
          )}
          <span style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', lineHeight: '12px',
            color: destination.priceSource === 'estimate' ? '#FFFFFF60' : colors.confirmGreen,
          }}>
            {destination.priceSource !== 'estimate' ? 'LIVE' : 'EST.'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function FeedScreen() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollIndex: currentIndex, setScrollIndex: setCurrentIndex, filters, isSearchOpen, setSearchOpen, clearFilters, hasActiveFilters } = useFeedStore();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } = useFeed();
  const { trackView, trackSave } = useSwipeTracking();

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
    const handleScroll = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight);
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
  }, [destinations.length, hasNextPage, isFetchingNextPage, fetchNextPage, trackView]);

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
    backgroundColor: '#FFFFFF14',
    border: '1px solid #FFFFFF1F',
    cursor: 'pointer',
    padding: 0,
  };

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="screen-fixed" style={{ background: '#0A0F1E', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <FilterBar />
        <div style={{ flex: 1 }}>
          <SkeletonCard />
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
          <BottomNav dark />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="screen-fixed" style={{ background: '#0A0F1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, color: '#FFFFFF90' }}>Could not load destinations</span>
        <button
          onClick={() => refetch()}
          style={{
            paddingBlock: 10,
            paddingInline: 24,
            borderRadius: 10,
            backgroundColor: '#FFFFFF14',
            border: '1px solid #FFFFFF1F',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: '#FFFFFFB3' }}>Try Again</span>
        </button>
      </div>
    );
  }

  // Empty state (filters active but no results)
  if (destinations.length === 0) {
    return (
      <div className="screen-fixed" style={{ background: '#0A0F1E', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <FilterBar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF30" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 16, color: '#FFFFFF80', textAlign: 'center' }}>
            No destinations match your filters
          </span>
          {hasActiveFilters() && (
            <button
              onClick={() => clearFilters()}
              style={{
                paddingBlock: 10,
                paddingInline: 24,
                borderRadius: 10,
                backgroundColor: '#FFFFFF14',
                border: '1px solid #FFFFFF1F',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: '#FFFFFFB3' }}>Clear Filters</span>
            </button>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
          <BottomNav dark />
        </div>
      </div>
    );
  }

  return (
    <div className="screen-fixed" style={{ background: '#0A0F1E', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Filter bar at top */}
      <FilterBar />

      {/* Search button (top-right) */}
      <button
        aria-label="Search destinations"
        onClick={() => setSearchOpen(true)}
        style={{
          ...glassButton,
          position: 'absolute',
          top: 52,
          right: 12,
          zIndex: 10,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFFCC" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

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
        <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 3, height: 80, borderRadius: 2, backgroundColor: '#FFFFFF20', zIndex: 20, overflow: 'hidden' }}>
          <div
            style={{
              width: '100%',
              height: `${Math.max(10, 100 / destinations.length)}%`,
              borderRadius: 2,
              backgroundColor: '#FFFFFF',
              transform: `translateY(${(currentIndex / Math.max(1, destinations.length - 1)) * (80 - 80 * Math.max(10, 100 / destinations.length) / 100)}px)`,
              transition: 'transform 0.2s',
            }}
          />
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
        <BottomNav dark />
      </div>

      {/* Search overlay */}
      {isSearchOpen && <SearchOverlay />}
    </div>
  );
}
