import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SwipeCard } from './SwipeCard';
import { SkeletonCard } from './SkeletonCard';
import { SearchOverlay } from './SearchOverlay';
import { WelcomeOverlay } from './WelcomeOverlay';
import { DealAlertBanner } from './DealAlertBanner';
import { DealsTicker } from './DealsTicker';
import { TrendingSection } from './TrendingSection';
import { useSwipeFeed, recordSwipe } from '../../hooks/useSwipeFeed';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { useFeedStore, SortPreset, REGION_OPTIONS, RegionFilter } from '../../stores/feedStore';
import { useUIStore } from '../../stores/uiStore';
import { mediumHaptic } from '../../utils/haptics';
import { PRELOAD_AHEAD, PRELOAD_BEHIND } from '../../constants/layout';
import { ErrorState } from '../common/ErrorState';
import { colors } from '../../constants/theme';
import { MapView } from './MapView';
import type { VibeTag } from '../../types/destination';

// ── Approximate city coords for mini-map (normalized 0-1 on a world projection) ──
const CITY_COORDS: Record<string, [number, number]> = {
  'Paris': [0.51, 0.28], 'London': [0.50, 0.25], 'Tokyo': [0.86, 0.33],
  'Bangkok': [0.77, 0.45], 'Rome': [0.53, 0.31], 'Barcelona': [0.51, 0.31],
  'Bali': [0.81, 0.55], 'Dubai': [0.63, 0.38], 'New York': [0.28, 0.30],
  'Sydney': [0.88, 0.70], 'Istanbul': [0.58, 0.31], 'Lisbon': [0.48, 0.32],
  'Mexico City': [0.20, 0.42], 'Buenos Aires': [0.30, 0.72], 'Cairo': [0.58, 0.37],
  'Marrakech': [0.49, 0.35], 'Cape Town': [0.55, 0.72], 'Seoul': [0.84, 0.33],
  'Singapore': [0.78, 0.51], 'Amsterdam': [0.52, 0.26], 'Prague': [0.54, 0.27],
  'Cancún': [0.21, 0.41], 'Rio de Janeiro': [0.33, 0.64], 'Reykjavik': [0.46, 0.17],
  'Athens': [0.56, 0.33], 'Havana': [0.22, 0.39], 'Lima': [0.24, 0.57],
  'Nairobi': [0.60, 0.51], 'Mumbai': [0.70, 0.42], 'Hanoi': [0.79, 0.41],
};

const VIBE_CHIPS: { tag: VibeTag; label: string; emoji: string }[] = [
  { tag: 'beach', label: 'Beach', emoji: '🏖️' },
  { tag: 'city', label: 'City', emoji: '🏙️' },
  { tag: 'adventure', label: 'Adventure', emoji: '⛰️' },
  { tag: 'culture', label: 'Culture', emoji: '🏛️' },
  { tag: 'romantic', label: 'Romantic', emoji: '💕' },
  { tag: 'budget', label: 'Budget', emoji: '💰' },
];

// ── Animated counter hook ──
function useAnimatedCounter(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

function MiniMap({ cities, onClose }: { cities: string[]; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'sg-fade-in 0.3s ease-out',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: '90%', maxWidth: 600, aspectRatio: '2/1', position: 'relative',
        borderRadius: 20, overflow: 'hidden',
        background: 'linear-gradient(135deg, #0c1929 0%, #1a2744 100%)',
        border: '1px solid rgba(56,189,248,0.2)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Simple world outline hint */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 180 }}>🌍</span>
        </div>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(y => (
          <div key={`h${y}`} style={{ position: 'absolute', top: `${y*100}%`, left: 0, right: 0, height: 1, backgroundColor: 'rgba(56,189,248,0.06)' }} />
        ))}
        {[0.25, 0.5, 0.75].map(x => (
          <div key={`v${x}`} style={{ position: 'absolute', left: `${x*100}%`, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(56,189,248,0.06)' }} />
        ))}
        {/* City dots */}
        {cities.map(city => {
          const coords = CITY_COORDS[city];
          if (!coords) return null;
          return (
            <div key={city} style={{
              position: 'absolute', left: `${coords[0]*100}%`, top: `${coords[1]*100}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4, backgroundColor: '#38BDF8',
                boxShadow: '0 0 8px rgba(56,189,248,0.6), 0 0 16px rgba(56,189,248,0.3)',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: 600, whiteSpace: 'nowrap' }}>{city}</span>
            </div>
          );
        })}
        {/* Label */}
        <div style={{ position: 'absolute', top: 12, left: 16 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>
            Your destinations
          </span>
        </div>
        <div style={{ position: 'absolute', bottom: 12, right: 16, color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
          {cities.length} cities · tap anywhere to close
        </div>
      </div>
    </div>
  );
}

function EndOfFeedCard({ destCount, countries, onShuffle, onSaved }: {
  destCount: number; countries: string[]; onShuffle: () => void; onSaved: () => void;
}) {
  const animatedDest = useAnimatedCounter(destCount);
  const animatedCountries = useAnimatedCounter(countries.length);

  return (
    <div className="sg-card-snap" style={{
      height: '100vh', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${colors.navy} 0%, #1a1a3e 50%, ${colors.navy} 100%)`,
    }}>
      <style>{`
        @keyframes sg-stats-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes sg-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 56, marginBottom: 20, animation: 'sg-float 3s ease-in-out infinite' }}>🌍</div>
        <p style={{ margin: 0, color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 24 }}>
          Journey Complete!
        </p>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 16, padding: '20px 28px', textAlign: 'center',
            animation: 'sg-stats-pulse 2s ease-in-out infinite',
          }}>
            <div style={{ color: '#38BDF8', fontSize: 36, fontWeight: 800 }}>{animatedDest}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Destinations</div>
          </div>
          <div style={{
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
            borderRadius: 16, padding: '20px 28px', textAlign: 'center',
            animation: 'sg-stats-pulse 2s 0.3s ease-in-out infinite',
          }}>
            <div style={{ color: '#C084FC', fontSize: 36, fontWeight: 800 }}>{animatedCountries}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Countries</div>
          </div>
        </div>
        <p style={{ margin: '0 0 28px 0', color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.5 }}>
          Shuffle for a fresh feed, or check your saved picks.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onShuffle}
            style={{
              background: 'linear-gradient(135deg, #38BDF8, #818CF8)', color: '#fff',
              border: 'none', borderRadius: 9999,
              padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(56,189,248,0.3)',
            }}
          >
            🔄 Shuffle Feed
          </button>
          <button
            onClick={onSaved}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.7)',
              border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 9999,
              padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ❤️ Saved
          </button>
        </div>
      </div>
    </div>
  );
}

export function SwipeFeed() {
  const { height: screenHeight } = useWindowDimensions();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSwipeFeed();
  const { toggle, isSaved } = useSaveDestination();
  const setCurrentIndex = useFeedStore((s) => s.setCurrentIndex);
  const markViewed = useFeedStore((s) => s.markViewed);
  const refreshFeed = useFeedStore((s) => s.refreshFeed);
  const sortPreset = useFeedStore((s) => s.sortPreset);
  const setSortPreset = useFeedStore((s) => s.setSortPreset);
  const departureCode = useUIStore((s) => s.departureCode);
  const departureCity = useUIStore((s) => s.departureCity);
  const regionFilter = useFeedStore((s) => s.regionFilter);
  const setRegionFilter = useFeedStore((s) => s.setRegionFilter);
  const [searchOpen, setSearchOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [vibeFilter, setVibeFilter] = useState<VibeTag | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const webScrollRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const cardEnterTimeRef = useRef<number>(Date.now());

  const allDestinations = useMemo(
    () => data?.pages.flatMap((page) => page.destinations) ?? [],
    [data],
  );

  // Apply vibe filter
  const destinations = useMemo(() => {
    if (!vibeFilter) return allDestinations;
    return allDestinations.filter(d => d.vibeTags.includes(vibeFilter));
  }, [allDestinations, vibeFilter]);

  // Unique countries for end card
  const uniqueCountries = useMemo(
    () => [...new Set(destinations.map(d => d.country))],
    [destinations],
  );

  // Cities for mini-map
  const cityNames = useMemo(() => destinations.map(d => d.city), [destinations]);

  const handleToggleSave = useCallback(
    (destId: string) => {
      const dest = destinations.find((d) => d.id === destId);
      if (dest && !isSaved(destId)) {
        const timeSpent = Date.now() - cardEnterTimeRef.current;
        recordSwipe(destId, 'saved', timeSpent, dest.livePrice ?? dest.flightPrice);
      }
      toggle(destId);
    },
    [destinations, isSaved, toggle],
  );

  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      if (!localStorage.getItem('sg-swiped')) setShowHint(true);
    } catch {}
  }, []);

  // Scroll-snap CSS for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'sogojet-snap-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .sg-feed {
        scroll-snap-type: y mandatory;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
      }
      .sg-feed::-webkit-scrollbar { display: none; }
      .sg-card-snap {
        scroll-snap-align: start;
        scroll-snap-stop: always;
      }
      @keyframes sg-bounce {
        0%, 100% { transform: translateY(0); opacity: 0.6; }
        50% { transform: translateY(-12px); opacity: 1; }
      }
      @keyframes sg-fade-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .sg-card-snap:first-child { animation: sg-fade-in 0.6s ease-out; }
      .sg-swipe-hint {
        position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        animation: sg-bounce 1.8s ease-in-out infinite;
        pointer-events: none; z-index: 20;
        transition: opacity 0.4s;
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // Image preloading for web
  useEffect(() => {
    if (Platform.OS !== 'web' || !destinations.length) return;
    for (let i = activeIndex + 1; i <= activeIndex + 3 && i < destinations.length; i++) {
      const img = new window.Image();
      img.src = destinations[i].imageUrl;
    }
  }, [activeIndex, destinations]);

  // Keyboard nav
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const container = webScrollRef.current;
      if (!container) return;
      const h = window.innerHeight;
      const total = destinations.length + (hasNextPage ? 0 : 1);
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        container.scrollTo({ top: Math.min(activeIndexRef.current + 1, total - 1) * h, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        container.scrollTo({ top: Math.max(activeIndexRef.current - 1, 0) * h, behavior: 'smooth' });
      } else if (e.key === 's' || e.key === 'S') {
        const current = destinations[activeIndexRef.current];
        if (current) handleToggleSave(current.id);
      } else if (e.key === 'Enter') {
        const current = destinations[activeIndexRef.current];
        if (current) router.push(`/destination/${current.id}`);
      } else if (e.key === '/' || e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [destinations, hasNextPage, handleToggleSave]);

  const handleWebScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const index = Math.round(target.scrollTop / window.innerHeight);
      if (index !== activeIndexRef.current && index >= 0) {
        const prevIndex = activeIndexRef.current;
        if (prevIndex < destinations.length) {
          const timeSpent = Date.now() - cardEnterTimeRef.current;
          const prevDest = destinations[prevIndex];
          recordSwipe(prevDest.id, timeSpent < 1500 ? 'skipped' : 'viewed', timeSpent, prevDest.livePrice ?? prevDest.flightPrice);
        }
        cardEnterTimeRef.current = Date.now();
        activeIndexRef.current = index;
        setActiveIndex(index);
        setCurrentIndex(index);
        if (index < destinations.length) markViewed(destinations[index].id);
        mediumHaptic();
        if (showHint && index > 0) {
          setShowHint(false);
          try { localStorage.setItem('sg-swiped', '1'); } catch {}
        }
        if (index >= destinations.length - 5 && hasNextPage && !isFetchingNextPage) fetchNextPage();
      }
    },
    [destinations, setCurrentIndex, markViewed, hasNextPage, isFetchingNextPage, fetchNextPage, showHint],
  );

  const handleNativeScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const index = Math.round(event.nativeEvent.contentOffset.y / screenHeight);
      if (index !== activeIndexRef.current && index >= 0 && index < destinations.length) {
        const prevIndex = activeIndexRef.current;
        if (prevIndex < destinations.length) {
          const timeSpent = Date.now() - cardEnterTimeRef.current;
          const prevDest = destinations[prevIndex];
          recordSwipe(prevDest.id, timeSpent < 1500 ? 'skipped' : 'viewed', timeSpent, prevDest.livePrice ?? prevDest.flightPrice);
        }
        cardEnterTimeRef.current = Date.now();
        activeIndexRef.current = index;
        setActiveIndex(index);
        setCurrentIndex(index);
        markViewed(destinations[index].id);
        mediumHaptic();
        if (index >= destinations.length - 5 && hasNextPage && !isFetchingNextPage) fetchNextPage();
      }
    },
    [destinations, screenHeight, setCurrentIndex, markViewed, hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  const resetToTop = useCallback(() => {
    webScrollRef.current?.scrollTo({ top: 0 });
    setActiveIndex(0);
    activeIndexRef.current = 0;
  }, []);

  if (isLoading) return <SkeletonCard />;

  if (isError) {
    if (Platform.OS === 'web') {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', backgroundColor: colors.navy, flexDirection: 'column', gap: 16,
        }}>
          <span style={{ fontSize: 48 }}>😵</span>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Failed to load destinations</span>
          <button onClick={() => refetch()} style={{
            background: colors.primary, color: '#fff', border: 'none', borderRadius: 12,
            padding: '12px 32px', fontSize: 16, fontWeight: '700', cursor: 'pointer',
          }}>Try Again</button>
        </div>
      );
    }
    return <ErrorState message="Failed to load destinations" onRetry={() => refetch()} />;
  }

  // ── Web ──
  if (Platform.OS === 'web') {
    return (
      <>
      <WelcomeOverlay />
      {showFullMap && <MapView destinations={destinations} onClose={() => setShowFullMap(false)} />}
      {showMiniMap && <MiniMap cities={cityNames} onClose={() => setShowMiniMap(false)} />}
      <div
        ref={webScrollRef}
        className="sg-feed"
        style={{ height: '100vh', width: '100%', overflowY: 'scroll', scrollbarWidth: 'none', position: 'relative' }}
        onScroll={handleWebScroll}
      >
        {/* Scroll progress bar */}
        <div style={{
          position: 'fixed', top: 0, left: 0, zIndex: 31,
          height: 2, backgroundColor: '#38BDF8',
          width: `${destinations.length > 0 ? ((activeIndex + 1) / destinations.length) * 100 : 0}%`,
          transition: 'width 0.3s ease',
        }} />

        {/* Floating header — logo + departure city */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
          pointerEvents: 'none',
          paddingBottom: 56,
        }}>
          <span style={{
            color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: -0.5,
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}>
            SoGo<span style={{ color: '#38BDF8' }}>Jet</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
            {/* Region filter */}
            <div style={{ position: 'relative' }}>
              <span
                onClick={() => setRegionOpen(!regionOpen)}
                style={{
                  color: regionFilter !== 'all' ? '#38BDF8' : 'rgba(255,255,255,0.7)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  padding: '4px 10px', borderRadius: 9999,
                  backgroundColor: regionFilter !== 'all' ? 'rgba(56,189,248,0.2)' : 'rgba(0,0,0,0.3)',
                  border: regionFilter !== 'all' ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {REGION_OPTIONS.find(r => r.key === regionFilter)?.emoji || '🌍'}{' '}
                {REGION_OPTIONS.find(r => r.key === regionFilter)?.label || 'Everywhere'}
                <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
              </span>
              {regionOpen && (
                <>
                  <div
                    onClick={() => setRegionOpen(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 98 }}
                  />
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 99,
                    backgroundColor: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
                    minWidth: 200,
                  }}>
                    <div style={{ padding: '10px 14px 6px', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5 }}>
                      Destination Region
                    </div>
                    {REGION_OPTIONS.map(({ key, label, emoji }) => (
                      <div
                        key={key}
                        onClick={() => {
                          setRegionFilter(key);
                          setRegionOpen(false);
                          webScrollRef.current?.scrollTo({ top: 0 });
                          setActiveIndex(0);
                          activeIndexRef.current = 0;
                        }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 10,
                          backgroundColor: regionFilter === key ? 'rgba(56,189,248,0.1)' : 'transparent',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => { if (regionFilter !== key) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={(e) => { if (regionFilter !== key) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                      >
                        <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{emoji}</span>
                        <span style={{
                          color: regionFilter === key ? '#38BDF8' : 'rgba(255,255,255,0.8)',
                          fontSize: 14, fontWeight: regionFilter === key ? 700 : 500,
                        }}>{label}</span>
                        {regionFilter === key && <span style={{ marginLeft: 'auto', color: '#38BDF8', fontSize: 14 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <span style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600,
              textShadow: '0 1px 8px rgba(0,0,0,0.5)',
              cursor: 'pointer',
            }}
              onClick={() => router.push('/settings')}
            >
              ✈️ {departureCode}
            </span>
            <span
              onClick={() => setShowFullMap(true)}
              style={{
                color: 'rgba(255,255,255,0.8)', fontSize: 16, cursor: 'pointer',
                textShadow: '0 1px 8px rgba(0,0,0,0.5)',
              }}
              title="Map view"
            >🗺️</span>
            <span
              onClick={() => setSearchOpen(true)}
              style={{
                color: 'rgba(255,255,255,0.8)', fontSize: 18, cursor: 'pointer',
                textShadow: '0 1px 8px rgba(0,0,0,0.5)',
              }}
            >🔍</span>
          </div>
        </div>

        {/* Category quick-filter chips */}
        <div style={{
          position: 'fixed', top: 48, left: 0, right: 0, zIndex: 29,
          display: 'flex', justifyContent: 'center', gap: 4,
          pointerEvents: 'auto', padding: '0 12px', flexWrap: 'nowrap',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {VIBE_CHIPS.map(({ tag, label, emoji }) => (
            <button
              key={tag}
              onClick={() => {
                setVibeFilter(vibeFilter === tag ? null : tag);
                resetToTop();
              }}
              style={{
                padding: '4px 10px', borderRadius: 9999,
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                backgroundColor: vibeFilter === tag ? 'rgba(56,189,248,0.3)' : 'rgba(0,0,0,0.25)',
                color: vibeFilter === tag ? '#38BDF8' : 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                transition: 'all 0.2s',
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                border: vibeFilter === tag ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
              }}
            >{emoji} {label}</button>
          ))}
        </div>

        {/* Sort pills */}
        <div style={{
          position: 'fixed', top: 74, left: 0, right: 0, zIndex: 29,
          display: 'flex', justifyContent: 'center', gap: 6,
          pointerEvents: 'auto', padding: '0 20px',
        }}>
          {([
            { key: 'default' as SortPreset, label: '✨ For You' },
            { key: 'cheapest' as SortPreset, label: '💰 Cheapest' },
            { key: 'topRated' as SortPreset, label: '⭐ Top Rated' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setSortPreset(key);
                resetToTop();
              }}
              style={{
                padding: '5px 12px', borderRadius: 9999, border: 'none',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                backgroundColor: sortPreset === key ? 'rgba(56,189,248,0.25)' : 'rgba(0,0,0,0.3)',
                color: sortPreset === key ? '#38BDF8' : 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                transition: 'all 0.2s',
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            >{label}</button>
          ))}
        </div>

        <DealsTicker />
        <SearchOverlay visible={searchOpen} onClose={() => setSearchOpen(false)} />

        {destinations.map((destination, index) => (
          <div key={destination.id} className="sg-card-snap" style={{ height: '100vh', width: '100%', position: 'relative' }}>
            <SwipeCard
              destination={destination}
              isActive={index === activeIndex}
              isPreloaded={index >= activeIndex - PRELOAD_BEHIND && index <= activeIndex + PRELOAD_AHEAD}
              isSaved={isSaved(destination.id)}
              onToggleSave={() => handleToggleSave(destination.id)}
              index={index}
            />
            {index === 0 && showHint && (
              <div className="sg-swipe-hint">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 19V5M5 12l7-7 7 7" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>Swipe to explore</span>
              </div>
            )}
          </div>
        ))}

        {/* Deal alert banner — shows after 5 cards */}
        {activeIndex >= 5 && <DealAlertBanner />}

        {/* Trending overlay */}
        {showTrending && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }} onClick={() => setShowTrending(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 680, maxHeight: '80vh',
                overflowY: 'auto', borderRadius: '24px 24px 0 0',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
              }}
            >
              <TrendingSection onClose={() => setShowTrending(false)} />
            </div>
          </div>
        )}

        {/* Floating left-side buttons — stacked vertically with safe spacing */}
        <div style={{
          position: 'fixed', bottom: 24, left: 12, zIndex: 30,
          display: 'flex', flexDirection: 'column', gap: 8,
          alignItems: 'center',
        }}>
          {activeIndex >= 10 && (
            <button
              onClick={resetToTop}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Back to top"
            >↑</button>
          )}
          <button
            onClick={() => setShowTrending(true)}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              color: '#fff', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Discover trending"
          >✨</button>
          <button
            onClick={() => setShowMiniMap(true)}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              color: '#fff', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Explore map"
          >🌐</button>
        </div>

        {/* Card counter — bottom right */}
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 30,
          pointerEvents: 'none',
          color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 600,
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
        }}>
          <span>{activeIndex + 1} / {destinations.length}</span>
        </div>

        {/* End-of-feed card with stats */}
        {!hasNextPage && destinations.length > 0 && (
          <EndOfFeedCard
            destCount={destinations.length}
            countries={uniqueCountries}
            onShuffle={() => { refreshFeed(); resetToTop(); }}
            onSaved={() => router.push('/saved')}
          />
        )}
      </div>
      </>
    );
  }

  // ── Native ──
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={screenHeight}
        snapToAlignment="start"
        onMomentumScrollEnd={handleNativeScroll}
      >
        {destinations.map((destination, index) => (
          <View key={destination.id} style={{ height: screenHeight }}>
            <SwipeCard
              destination={destination}
              isActive={index === activeIndex}
              isPreloaded={index >= activeIndex - PRELOAD_BEHIND && index <= activeIndex + PRELOAD_AHEAD}
              isSaved={isSaved(destination.id)}
              onToggleSave={() => handleToggleSave(destination.id)}
              index={index}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
