import { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts } from '@/tokens';
import { useFeed } from '@/hooks/useFeed';
import { useSavedStore } from '@/stores/savedStore';
import type { Destination } from '@/api/types';
import BottomNav from '@/components/BottomNav';

function FeedCard({ destination }: { destination: Destination }) {
  const navigate = useNavigate();
  const { isSaved, toggle } = useSavedStore();
  const saved = isSaved(destination.id);

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
        height: '100dvh',
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
          style={glassButton}
          onClick={(e) => { e.stopPropagation(); toggle(destination.id); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? '#FFFFFF' : 'none'} stroke="#FFFFFF" strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <button
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
        style={{ position: 'absolute', bottom: 140, left: 20, right: 80, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
      >
        <div
          style={{
            fontFamily: `"${fonts.display}", system-ui, sans-serif`,
            fontWeight: 800,
            fontSize: 'clamp(36px, 10vw, 56px)',
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
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
          bottom: 88,
          left: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBlock: 10,
          paddingInline: 18,
          borderRadius: 20,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: '#2C1F1AE6',
          border: '1px solid #FFFFFF1A',
        }}
      >
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 11, lineHeight: '14px', color: colors.borderTint }}>
          From
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: '24px',
            color: colors.sunriseButter,
          }}
        >
          ${destination.flightPrice}
        </span>
        <span
          style={{
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.1em',
            lineHeight: '12px',
            color: destination.priceSource === 'estimate' ? '#FFFFFF60' : colors.confirmGreen,
          }}
        >
          {destination.priceSource === 'travelpayouts' || destination.priceSource === 'amadeus' || destination.priceSource === 'duffel' ? 'LIVE PRICE' : 'EST.'}
        </span>
      </div>
    </div>
  );
}

export default function FeedScreen() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed();

  const destinations = useMemo(
    () => data?.pages.flatMap((p) => p.destinations) ?? [],
    [data],
  );

  // Track scroll position + prefetch next page when near end
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight);
      setCurrentIndex(idx);
      // Prefetch when within 3 items of the end
      if (idx >= destinations.length - 3 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [destinations.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="screen-fixed" style={{ background: '#0A0F1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif`, fontSize: 14, color: '#FFFFFF60' }}>Loading destinations...</span>
      </div>
    );
  }

  return (
    <div className="screen-fixed" style={{ background: '#0A0F1E', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
          <FeedCard key={dest.id} destination={dest} />
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
    </div>
  );
}
