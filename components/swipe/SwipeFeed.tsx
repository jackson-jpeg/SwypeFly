import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SwipeCard } from './SwipeCard';
import { SkeletonCard } from './SkeletonCard';
import { SearchOverlay } from './SearchOverlay';
import { WelcomeOverlay } from './WelcomeOverlay';
import { DealAlertBanner } from './DealAlertBanner';
import { useSwipeFeed, recordSwipe } from '../../hooks/useSwipeFeed';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { useFeedStore } from '../../stores/feedStore';
import { useUIStore } from '../../stores/uiStore';
import { mediumHaptic } from '../../utils/haptics';
import { PRELOAD_AHEAD, PRELOAD_BEHIND } from '../../constants/layout';
import { ErrorState } from '../common/ErrorState';
import { colors } from '../../constants/theme';

export function SwipeFeed() {
  const { height: screenHeight } = useWindowDimensions();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSwipeFeed();
  const { toggle, isSaved } = useSaveDestination();
  const setCurrentIndex = useFeedStore((s) => s.setCurrentIndex);
  const markViewed = useFeedStore((s) => s.markViewed);
  const refreshFeed = useFeedStore((s) => s.refreshFeed);
  const departureCode = useUIStore((s) => s.departureCode);
  const departureCity = useUIStore((s) => s.departureCity);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const webScrollRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const cardEnterTimeRef = useRef<number>(Date.now());

  const destinations = useMemo(
    () => data?.pages.flatMap((page) => page.destinations) ?? [],
    [data],
  );

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
      const img = new Image();
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
      <div
        ref={webScrollRef}
        className="sg-feed"
        style={{ height: '100vh', width: '100%', overflowY: 'scroll', scrollbarWidth: 'none', position: 'relative' }}
        onScroll={handleWebScroll}
      >
        {/* Floating header — logo + departure city */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}>
          <span style={{
            color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: -0.5,
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}>
            SoGo<span style={{ color: '#38BDF8' }}>Jet</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'auto' }}>
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
              onClick={() => setSearchOpen(true)}
              style={{
                color: 'rgba(255,255,255,0.8)', fontSize: 18, cursor: 'pointer',
                textShadow: '0 1px 8px rgba(0,0,0,0.5)',
              }}
            >🔍</span>
          </div>
        </div>

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

        {/* Card counter — bottom right */}
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 30,
          pointerEvents: 'none',
          color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600,
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}>
          {activeIndex + 1} / {destinations.length}
        </div>

        {/* Simple end-of-feed */}
        {!hasNextPage && destinations.length > 0 && (
          <div className="sg-card-snap" style={{
            height: '100vh', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.navy,
          }}>
            <div style={{ textAlign: 'center', padding: '0 32px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🌍</div>
              <p style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                You've explored {destinations.length} destinations!
              </p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                Shuffle for a fresh feed, or check your saved picks.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    refreshFeed();
                    webScrollRef.current?.scrollTo({ top: 0 });
                    setActiveIndex(0);
                    activeIndexRef.current = 0;
                  }}
                  style={{
                    background: colors.primary, color: '#fff', border: 'none', borderRadius: 9999,
                    padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  🔄 Shuffle Feed
                </button>
                <button
                  onClick={() => router.push('/saved')}
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
