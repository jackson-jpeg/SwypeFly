import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SwipeCard } from './SwipeCard';
import { SkeletonCard } from './SkeletonCard';
import { useSwipeFeed, recordSwipe } from '../../hooks/useSwipeFeed';
import { useSaveDestination } from '../../hooks/useSaveDestination';
import { useFeedStore } from '../../stores/feedStore';
import { mediumHaptic } from '../../utils/haptics';
import { PRELOAD_AHEAD, PRELOAD_BEHIND } from '../../constants/layout';
import { FeedFilterBar } from './FeedFilterBar';
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
  const vibeFilter = useFeedStore((s) => s.vibeFilter);
  const setVibeFilter = useFeedStore((s) => s.setVibeFilter);
  const sortPreset = useFeedStore((s) => s.sortPreset);
  const setSortPreset = useFeedStore((s) => s.setSortPreset);
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
        // Record save action when saving (not when un-saving)
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

  // Inject scroll-snap CSS for web
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
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  // Image preloading for web — preload next 3 cards
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!destinations.length) return;
    for (let i = activeIndex + 1; i <= activeIndex + 3 && i < destinations.length; i++) {
      const img = new Image();
      img.src = destinations[i].imageUrl;
    }
  }, [activeIndex, destinations]);

  // Keyboard navigation for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const container = webScrollRef.current;
      if (!container) return;

      const h = window.innerHeight;
      const totalCards = destinations.length + (hasNextPage ? 0 : 1); // +1 for end card

      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        const next = Math.min(activeIndexRef.current + 1, totalCards - 1);
        container.scrollTo({ top: next * h, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(activeIndexRef.current - 1, 0);
        container.scrollTo({ top: prev * h, behavior: 'smooth' });
      } else if (e.key === 's' || e.key === 'S') {
        const current = destinations[activeIndexRef.current];
        if (current) handleToggleSave(current.id);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [destinations, hasNextPage, handleToggleSave]);

  const handleWebScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const offsetY = target.scrollTop;
      const h = window.innerHeight;
      const index = Math.round(offsetY / h);
      if (index !== activeIndexRef.current && index >= 0) {
        // Track time on previous card and record swipe
        const prevIndex = activeIndexRef.current;
        if (prevIndex < destinations.length) {
          const timeSpent = Date.now() - cardEnterTimeRef.current;
          const prevDest = destinations[prevIndex];
          const action = timeSpent < 1500 ? 'skipped' : 'viewed';
          recordSwipe(prevDest.id, action, timeSpent, prevDest.livePrice ?? prevDest.flightPrice);
        }
        cardEnterTimeRef.current = Date.now();

        activeIndexRef.current = index;
        setActiveIndex(index);
        setCurrentIndex(index);
        if (index < destinations.length) {
          markViewed(destinations[index].id);
        }
        mediumHaptic();

        if (showHint && index > 0) {
          setShowHint(false);
          try { localStorage.setItem('sg-swiped', '1'); } catch {}
        }

        if (index >= destinations.length - 3 && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    },
    [destinations, setCurrentIndex, markViewed, hasNextPage, isFetchingNextPage, fetchNextPage, showHint],
  );

  const handleNativeScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / screenHeight);
      if (index !== activeIndexRef.current && index >= 0 && index < destinations.length) {
        // Track time on previous card and record swipe
        const prevIndex = activeIndexRef.current;
        if (prevIndex < destinations.length) {
          const timeSpent = Date.now() - cardEnterTimeRef.current;
          const prevDest = destinations[prevIndex];
          const action = timeSpent < 1500 ? 'skipped' : 'viewed';
          recordSwipe(prevDest.id, action, timeSpent, prevDest.livePrice ?? prevDest.flightPrice);
        }
        cardEnterTimeRef.current = Date.now();

        activeIndexRef.current = index;
        setActiveIndex(index);
        setCurrentIndex(index);
        markViewed(destinations[index].id);
        mediumHaptic();

        if (index >= destinations.length - 3 && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    },
    [destinations, screenHeight, setCurrentIndex, markViewed, hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (isError) {
    if (Platform.OS === 'web') {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', backgroundColor: colors.navy, flexDirection: 'column', gap: 16,
        }}>
          <span style={{ fontSize: 48 }}>😵</span>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Failed to load destinations</span>
          <button
            onClick={() => refetch()}
            style={{
              background: colors.primary, color: '#fff', border: 'none', borderRadius: 12,
              padding: '12px 32px', fontSize: 16, fontWeight: '700', cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return (
      <ErrorState
        message="Failed to load destinations"
        onRetry={() => refetch()}
      />
    );
  }

  if (Platform.OS === 'web') {
    return (
      <div
        ref={webScrollRef}
        className="sg-feed"
        style={{
          height: '100vh',
          width: '100%',
          overflowY: 'scroll',
          scrollbarWidth: 'none',
          position: 'relative',
        }}
        onScroll={handleWebScroll}
      >
        {/* Filter chips overlay */}
        <FeedFilterBar
          activeFilter={vibeFilter}
          onFilterChange={(vibe) => {
            setVibeFilter(vibe);
            webScrollRef.current?.scrollTo({ top: 0 });
            setActiveIndex(0);
            activeIndexRef.current = 0;
          }}
          activeSortPreset={sortPreset}
          onSortPresetChange={(preset) => {
            setSortPreset(preset);
            webScrollRef.current?.scrollTo({ top: 0 });
            setActiveIndex(0);
            activeIndexRef.current = 0;
          }}
        />
        {destinations.map((destination, index) => (
          <div
            key={destination.id}
            className="sg-card-snap"
            style={{ height: '100vh', width: '100%', position: 'relative' }}
          >
            <SwipeCard
              destination={destination}
              isActive={index === activeIndex}
              isPreloaded={
                index >= activeIndex - PRELOAD_BEHIND &&
                index <= activeIndex + PRELOAD_AHEAD
              }
              isSaved={isSaved(destination.id)}
              onToggleSave={() => handleToggleSave(destination.id)}
            />
            {index === 0 && showHint && (
              <div className="sg-swipe-hint">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5l0 14M5 12l7-7 7 7" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500, letterSpacing: 1 }}>
                  SWIPE UP
                </span>
              </div>
            )}
          </div>
        ))}
        {/* End-of-feed card */}
        {!hasNextPage && destinations.length > 0 && (
          <div
            className="sg-card-snap"
            style={{
              height: '100vh', width: '100%', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#0F172A',
            }}
          >
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 16, padding: '0 32px', textAlign: 'center',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="rgba(255,255,255,0.3)" />
              </svg>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 800 }}>
                You've explored everywhere!
              </h2>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.5, maxWidth: 300 }}>
                You've swiped through all available destinations. Try changing your departure city or check your saved list.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    refreshFeed();
                    webScrollRef.current?.scrollTo({ top: 0 });
                    setActiveIndex(0);
                    activeIndexRef.current = 0;
                  }}
                  style={{
                    background: '#38BDF8', color: '#fff', border: 'none', borderRadius: 14,
                    padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Shuffle Feed
                </button>
                <button
                  onClick={() => router.push('/settings')}
                  style={{
                    background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14, padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Change City
                </button>
                <button
                  onClick={() => router.push('/saved')}
                  style={{
                    background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14, padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  View Saved
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Native: use ScrollView with paging
  return (
    <View style={{ flex: 1 }}>
      <FeedFilterBar
        activeFilter={vibeFilter}
        onFilterChange={(vibe) => {
          setVibeFilter(vibe);
          scrollRef.current?.scrollTo({ y: 0, animated: false });
          setActiveIndex(0);
          activeIndexRef.current = 0;
        }}
        activeSortPreset={sortPreset}
        onSortPresetChange={(preset) => {
          setSortPreset(preset);
          scrollRef.current?.scrollTo({ y: 0, animated: false });
          setActiveIndex(0);
          activeIndexRef.current = 0;
        }}
      />
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
              isPreloaded={
                index >= activeIndex - PRELOAD_BEHIND &&
                index <= activeIndex + PRELOAD_AHEAD
              }
              isSaved={isSaved(destination.id)}
              onToggleSave={() => handleToggleSave(destination.id)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
