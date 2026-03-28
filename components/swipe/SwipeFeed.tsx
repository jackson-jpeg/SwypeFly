import { useCallback, useRef, useState, useEffect } from 'react';
import { View, FlatList, Text, Dimensions, StyleSheet, Platform, ViewToken, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDealStore } from '../../stores/dealStore';
import { useSavedStore } from '../../stores/savedStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBookingFlowStore } from '../../stores/bookingFlowStore';
import { useFilterStore } from '../../stores/filterStore';
import SwipeCard from './SwipeCard';
import type { BoardDeal } from '../../types/deal';
import { colors, fonts, spacing } from '../../theme/tokens';
const { height: SCREEN_H } = Dimensions.get('window');

interface SwipeFeedProps {
  onVisibleIndexChange?: (index: number) => void;
}

export default function SwipeFeed({ onVisibleIndexChange }: SwipeFeedProps) {
  const deals = useDealStore((s) => s.deals);
  const fetchMore = useDealStore((s) => s.fetchMore);
  const fetchDeals = useDealStore((s) => s.fetchDeals);
  const departureCode = useSettingsStore((s) => s.departureCode);
  const toQueryParams = useFilterStore((s) => s.toQueryParams);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const savedIds = useSavedStore((s) => s.savedIds);
  const toggle = useSavedStore((s) => s.toggle);
  const listRef = useRef<FlatList<BoardDeal>>(null);
  const router = useRouter();

  // Track which card is currently visible for split-flap animation
  const [visibleIndex, setVisibleIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      const idx = viewableItems[0].index;
      setVisibleIndex(idx);
      onVisibleIndexChange?.(idx);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Keyboard shortcuts for web: ↑/↓ to navigate, S to save, Enter to open detail
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const deal = deals[visibleIndex];
      if (!deal) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          e.preventDefault();
          const next = Math.min(visibleIndex + 1, deals.length - 1);
          listRef.current?.scrollToIndex({ index: next, animated: true });
          break;
        }
        case 'ArrowUp':
        case 'k': {
          e.preventDefault();
          const prev = Math.max(visibleIndex - 1, 0);
          listRef.current?.scrollToIndex({ index: prev, animated: true });
          break;
        }
        case 's':
        case 'S':
          toggle(deal);
          break;
        case 'Enter':
          router.push(`/destination/${deal.id}`);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleIndex, deals, toggle, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeals(departureCode, toQueryParams());
    setRefreshing(false);
    setVisibleIndex(0);
  }, [fetchDeals, departureCode, toQueryParams]);

  const handleSave = useCallback(
    (deal: BoardDeal) => {
      toggle(deal);
    },
    [toggle],
  );

  const handleBook = useCallback((deal: BoardDeal) => {
    const store = useBookingFlowStore.getState();
    store.reset();
    store.setTripContext(
      departureCode || 'TPA',
      deal.iataCode,
      deal.destinationFull || deal.destination,
      deal.price ?? null,
    );
    if (deal.cheapestDate && deal.cheapestReturnDate) {
      store.setDates(deal.cheapestDate, deal.cheapestReturnDate);
    }
    router.push(`/booking/${deal.id}/trip`);
  }, [router, departureCode]);

  const handleEndReached = useCallback(async () => {
    if (loadingMore) return; // Prevent double-fetch
    setLoadingMore(true);
    await fetchMore(departureCode, toQueryParams());
    setLoadingMore(false);
  }, [fetchMore, departureCode, toQueryParams, loadingMore]);

  // Prefetch next page proactively when user reaches 60% of current page
  // This eliminates the "wall" — content is ready before they get there
  useEffect(() => {
    if (deals.length === 0 || loadingMore) return;
    const prefetchThreshold = Math.floor(deals.length * 0.6);
    if (visibleIndex >= prefetchThreshold) {
      setLoadingMore(true);
      fetchMore(departureCode, toQueryParams()).finally(() => setLoadingMore(false));
    }
  }, [visibleIndex, deals.length]);

  const handleStartOver = useCallback(() => {
    listRef.current?.scrollToIndex({ index: 0, animated: true });
    setVisibleIndex(0);
  }, []);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    await fetchMore(departureCode, toQueryParams());
    setLoadingMore(false);
  }, [fetchMore, departureCode, toQueryParams]);

  const renderItem = useCallback(
    ({ item, index }: { item: BoardDeal; index: number }) => (
      <SwipeCard
        deal={item}
        isSaved={savedIds.includes(item.id)}
        isFirst={index === 0}
        animate={index === visibleIndex}
        onSave={() => handleSave(item)}
        onBook={() => handleBook(item)}
        onTap={() => router.push(`/destination/${item.id}`)}
      />
    ),
    [savedIds, handleSave, handleBook, router, visibleIndex],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_H,
      offset: SCREEN_H * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback((item: BoardDeal) => item.id, []);

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={deals}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        pagingEnabled
        snapToInterval={SCREEN_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.yellow}
            colors={[colors.yellow]}
            progressBackgroundColor={colors.surface}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={5}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingSkeleton}>
              <View style={styles.loadingPulse}>
                <ActivityIndicator color={colors.yellow} size="large" />
                <Text style={styles.loadingText}>Finding more deals...</Text>
              </View>
            </View>
          ) : deals.length > 0 ? (
            <View style={styles.endOfDeck}>
              <Text style={styles.endIcon}>✈</Text>
              <Text style={styles.endTitle}>ALL CAUGHT UP</Text>
              <Text style={styles.endSubtitle}>
                You've seen all {deals.length} deals from your origin
              </Text>
              <View style={styles.endActions}>
                <Pressable
                  style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleLoadMore}
                >
                  <Ionicons name="refresh" size={16} color={colors.yellow} />
                  <Text style={styles.endBtnText}>Load More</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.endBtnFilled, pressed && { opacity: 0.85 }]}
                  onPress={handleStartOver}
                >
                  <Ionicons name="arrow-up" size={16} color={colors.bg} />
                  <Text style={styles.endBtnFilledText}>Start Over</Text>
                </Pressable>
              </View>
            </View>
          ) : null
        }
      />

      {/* Card counter + keyboard hints */}
      {deals.length > 1 && (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>
            {visibleIndex + 1} / {deals.length}
          </Text>
          {Platform.OS === 'web' && (
            <Text style={styles.kbHint}>↑↓ navigate · S save · Enter details</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  footer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSkeleton: {
    height: SCREEN_H,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingPulse: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    letterSpacing: 0.5,
  },

  // Card counter
  counter: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 14 : 34,
    alignSelf: 'center',
    backgroundColor: 'rgba(10,8,6,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 1,
  },
  kbHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.faint,
    marginTop: 2,
  },

  // End of deck
  endOfDeck: {
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  endIcon: {
    fontSize: 56,
    marginBottom: spacing.lg,
    opacity: 0.3,
  },
  endTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.yellow,
    letterSpacing: 3,
    textAlign: 'center',
  },
  endSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  endActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow + '40',
    backgroundColor: colors.yellow + '10',
  },
  endBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.yellow,
  },
  endBtnFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.yellow,
  },
  endBtnFilledText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.bg,
  },
});
