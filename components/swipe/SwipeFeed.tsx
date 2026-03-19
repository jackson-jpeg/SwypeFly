import { useCallback, useRef, useState } from 'react';
import { View, FlatList, Dimensions, StyleSheet, Platform, ViewToken, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useDealStore } from '../../stores/dealStore';
import { useSavedStore } from '../../stores/savedStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBookingFlowStore } from '../../stores/bookingFlowStore';
import { useFilterStore } from '../../stores/filterStore';
import SwipeCard from './SwipeCard';
import type { BoardDeal } from '../../types/deal';
import { colors, spacing } from '../../theme/tokens';
const { height: SCREEN_H } = Dimensions.get('window');

export default function SwipeFeed() {
  const deals = useDealStore((s) => s.deals);
  const fetchMore = useDealStore((s) => s.fetchMore);
  const departureCode = useSettingsStore((s) => s.departureCode);
  const toQueryParams = useFilterStore((s) => s.toQueryParams);
  const [loadingMore, setLoadingMore] = useState(false);
  const savedIds = useSavedStore((s) => s.savedIds);
  const toggle = useSavedStore((s) => s.toggle);
  const listRef = useRef<FlatList<BoardDeal>>(null);
  const router = useRouter();

  // Track which card is currently visible for split-flap animation
  const [visibleIndex, setVisibleIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setVisibleIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

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
    router.push(`/booking/${deal.id}/dates`);
  }, [router, departureCode]);

  const handleEndReached = useCallback(async () => {
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
        onEndReached={handleEndReached}
        onEndReachedThreshold={2}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.yellow} size="small" />
            </View>
          ) : null
        }
      />
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
});
