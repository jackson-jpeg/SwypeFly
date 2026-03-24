import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSavedStore } from '../../stores/savedStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBookingFlowStore } from '../../stores/bookingFlowStore';
import SavedCard from '../../components/saved/SavedCard';
import { colors, fonts, spacing } from '../../theme/tokens';
import type { BoardDeal } from '../../types/deal';

type SortOption = 'recent' | 'price-asc' | 'price-desc';

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Recent',
  'price-asc': 'Price ↑',
  'price-desc': 'Price ↓',
};

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { savedDeals, toggle } = useSavedStore();
  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const sortedDeals = useMemo(() => {
    const deals = [...savedDeals];
    switch (sortBy) {
      case 'price-asc':
        return deals.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      case 'price-desc':
        return deals.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      default:
        return deals; // Already in recently-saved order
    }
  }, [savedDeals, sortBy]);

  const handlePress = useCallback((deal: BoardDeal) => {
    router.push(`/destination/${deal.id}`);
  }, [router]);

  const handleBook = useCallback((deal: BoardDeal) => {
    const store = useBookingFlowStore.getState();
    store.reset();
    store.setTripContext(departureCode, deal.iataCode, deal.destinationFull || deal.destination, deal.price ?? null);
    if (deal.cheapestDate && deal.cheapestReturnDate) {
      store.setDates(deal.cheapestDate, deal.cheapestReturnDate);
    }
    router.push(`/booking/${deal.id}/trip`);
  }, [router, departureCode]);

  const renderItem = useCallback(
    ({ item, index }: { item: BoardDeal; index: number }) => (
      <SavedCard
        deal={item}
        index={index}
        onPress={() => handlePress(item)}
        onRemove={() => toggle(item)}
        onBook={() => handleBook(item)}
      />
    ),
    [handlePress, toggle],
  );

  const keyExtractor = useCallback((item: BoardDeal) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>SAVED</Text>
            <Text style={styles.subtitle}>
              {savedDeals.length} {savedDeals.length === 1 ? 'flight' : 'flights'}
            </Text>
          </View>
          {savedDeals.length > 1 && (
            <View style={styles.sortRow}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setSortBy(opt)}
                  style={[styles.sortChip, sortBy === opt && styles.sortChipActive]}
                >
                  <Text style={[styles.sortText, sortBy === opt && styles.sortTextActive]}>
                    {SORT_LABELS[opt]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      {savedDeals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✈</Text>
          <Text style={styles.emptyTitle}>No saved flights yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart on any deal to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedDeals}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.yellow + '20',
    borderColor: colors.yellow + '60',
  },
  sortText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },
  sortTextActive: {
    color: colors.yellow,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  grid: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.3 },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.muted,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.faint,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
