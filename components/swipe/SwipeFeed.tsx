import { useCallback, useRef } from 'react';
import { View, FlatList, Dimensions, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useDealStore } from '../../stores/dealStore';
import { useSavedStore } from '../../stores/savedStore';
import { useSettingsStore } from '../../stores/settingsStore';
import SwipeCard from './SwipeCard';
import type { BoardDeal } from '../../types/deal';
import { colors } from '../../theme/tokens';
import * as Linking from 'expo-linking';

const { height: SCREEN_H } = Dimensions.get('window');

export default function SwipeFeed() {
  const deals = useDealStore((s) => s.deals);
  const fetchMore = useDealStore((s) => s.fetchMore);
  const departureCode = useSettingsStore((s) => s.departureCode);
  const savedIds = useSavedStore((s) => s.savedIds);
  const toggle = useSavedStore((s) => s.toggle);
  const listRef = useRef<FlatList<BoardDeal>>(null);
  const router = useRouter();

  const handleSave = useCallback(
    (deal: BoardDeal) => {
      toggle(deal);
    },
    [toggle],
  );

  const handleBook = useCallback((deal: BoardDeal) => {
    if (deal.affiliateUrl) {
      if (Platform.OS === 'web') {
        window.open(deal.affiliateUrl, '_blank', 'noopener');
      } else {
        Linking.openURL(deal.affiliateUrl);
      }
    }
  }, []);

  const handleEndReached = useCallback(() => {
    fetchMore(departureCode);
  }, [fetchMore, departureCode]);

  const renderItem = useCallback(
    ({ item, index }: { item: BoardDeal; index: number }) => (
      <SwipeCard
        deal={item}
        isSaved={savedIds.includes(item.id)}
        isFirst={index === 0}
        onSave={() => handleSave(item)}
        onBook={() => handleBook(item)}
        onTap={() => router.push(`/destination/${item.id}`)}
      />
    ),
    [savedIds, handleSave, handleBook, router],
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
