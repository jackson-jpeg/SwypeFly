import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ScrollView, Modal, RefreshControl, ActionSheetIOS, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSavedStore } from '../../stores/savedStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBookingFlowStore } from '../../stores/bookingFlowStore';
import SavedCard from '../../components/saved/SavedCard';
import { colors, fonts, spacing } from '../../theme/tokens';
import { lightHaptic, mediumHaptic, successHaptic, warningHaptic } from '../../utils/haptics';
import { shareDestination } from '../../utils/share';
import { showToast } from '../../stores/toastStore';
import type { BoardDeal } from '../../types/deal';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

type SortOption = 'recent' | 'price-asc' | 'price-desc';

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Recent',
  'price-asc': 'Price ↑',
  'price-desc': 'Price ↓',
};

// ─── Compare Sheet ────────────────────────────────────────────────

function CompareSheet({ deals, onClose }: { deals: [BoardDeal, BoardDeal]; onClose: () => void }) {
  const [a, b] = deals;

  const rows: { label: string; aVal: string; bVal: string; highlight?: 'lower' | 'higher' }[] = [
    {
      label: 'Price',
      aVal: a.price != null ? `$${a.price}` : '—',
      bVal: b.price != null ? `$${b.price}` : '—',
      highlight: 'lower',
    },
    {
      label: 'Duration',
      aVal: a.flightDuration || '—',
      bVal: b.flightDuration || '—',
    },
    {
      label: 'Stops',
      aVal: a.isNonstop ? 'Nonstop' : a.totalStops != null ? `${a.totalStops} stop${a.totalStops > 1 ? 's' : ''}` : '—',
      bVal: b.isNonstop ? 'Nonstop' : b.totalStops != null ? `${b.totalStops} stop${b.totalStops > 1 ? 's' : ''}` : '—',
    },
    {
      label: 'Trip',
      aVal: a.tripDays > 0 ? `${a.tripDays} days` : '—',
      bVal: b.tripDays > 0 ? `${b.tripDays} days` : '—',
    },
    {
      label: 'Airline',
      aVal: a.airline || '—',
      bVal: b.airline || '—',
    },
    {
      label: 'Vibes',
      aVal: a.vibeTags.slice(0, 2).join(', ') || '—',
      bVal: b.vibeTags.slice(0, 2).join(', ') || '—',
    },
  ];

  return (
    <Modal visible animationType="slide" transparent>
      <View style={cmpStyles.backdrop}>
        <View style={cmpStyles.sheet}>
          <View style={cmpStyles.header}>
            <Text style={cmpStyles.title}>COMPARE</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          {/* City headers */}
          <View style={cmpStyles.cityRow}>
            <View style={cmpStyles.cityCell}>
              <Text style={cmpStyles.cityName}>{a.destination}</Text>
              <Text style={cmpStyles.cityCountry}>{a.country}</Text>
            </View>
            <Text style={cmpStyles.vs}>VS</Text>
            <View style={cmpStyles.cityCell}>
              <Text style={cmpStyles.cityName}>{b.destination}</Text>
              <Text style={cmpStyles.cityCountry}>{b.country}</Text>
            </View>
          </View>

          {/* Comparison rows */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {rows.map((row) => {
              const aNum = parseFloat(row.aVal.replace(/[^0-9.]/g, ''));
              const bNum = parseFloat(row.bVal.replace(/[^0-9.]/g, ''));
              const aWins = row.highlight === 'lower' && !isNaN(aNum) && !isNaN(bNum) && aNum < bNum;
              const bWins = row.highlight === 'lower' && !isNaN(aNum) && !isNaN(bNum) && bNum < aNum;

              return (
                <View key={row.label} style={cmpStyles.row}>
                  <View style={[cmpStyles.valCell, aWins && cmpStyles.winCell]}>
                    <Text style={[cmpStyles.val, aWins && cmpStyles.winVal]}>{row.aVal}</Text>
                  </View>
                  <View style={cmpStyles.labelCell}>
                    <Text style={cmpStyles.label}>{row.label}</Text>
                  </View>
                  <View style={[cmpStyles.valCell, bWins && cmpStyles.winCell]}>
                    <Text style={[cmpStyles.val, bWins && cmpStyles.winVal]}>{row.bVal}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const cmpStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,8,6,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.yellow,
    letterSpacing: 3,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cityCell: {
    flex: 1,
    alignItems: 'center',
  },
  cityName: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 1,
  },
  cityCountry: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  vs: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.faint,
    letterSpacing: 2,
    marginHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  valCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  winCell: {
    backgroundColor: colors.dealAmazing + '15',
  },
  labelCell: {
    width: 70,
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  val: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.white,
  },
  winVal: {
    color: colors.dealAmazing,
    fontFamily: fonts.bodyBold,
  },
});

// ─── Saved Screen ─────────────────────────────────────────────────

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { savedDeals, toggle } = useSavedStore();
  const departureCode = useSettingsStore((s) => s.departureCode) || 'TPA';
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [compareDeals, setCompareDeals] = useState<[BoardDeal, BoardDeal] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (savedDeals.length === 0) return;
    setRefreshing(true);
    successHaptic();

    try {
      // Refresh prices for each saved deal (cap at 10 concurrent to avoid flooding)
      const batch = savedDeals.slice(0, 10);
      const results = await Promise.allSettled(
        batch.map(async (deal) => {
          const res = await fetch(
            `${API_BASE}/api/destination?id=${encodeURIComponent(deal.id)}&origin=${encodeURIComponent(departureCode)}`,
          );
          if (!res.ok) return null;
          const data = await res.json();
          return data?.destination ?? null;
        }),
      );

      // Update saved deals with fresh price data
      const store = useSavedStore.getState();
      const updatedDeals = store.savedDeals.map((deal) => {
        const idx = batch.findIndex((b) => b.id === deal.id);
        if (idx === -1) return deal;
        const result = results[idx];
        if (result.status !== 'fulfilled' || !result.value) return deal;
        const fresh = result.value;
        return {
          ...deal,
          price: fresh.price ?? fresh.flightPrice ?? deal.price,
          savingsAmount: fresh.savingsAmount ?? deal.savingsAmount,
          dealTier: fresh.dealTier ?? deal.dealTier,
          isNonstop: fresh.isNonstop ?? deal.isNonstop,
          totalStops: fresh.totalStops ?? deal.totalStops,
          flightDuration: fresh.flightDuration ?? deal.flightDuration,
          airline: fresh.airline ?? deal.airline,
        };
      });

      useSavedStore.setState({ savedDeals: updatedDeals });
      showToast('Prices refreshed');
    } catch {
      showToast('Could not refresh prices');
    } finally {
      setRefreshing(false);
    }
  }, [savedDeals, departureCode]);

  // Compute savings stats
  const savingsStats = useMemo(() => {
    const withSavings = savedDeals.filter((d) => d.savingsAmount && d.savingsAmount > 0);
    const totalSavings = withSavings.reduce((sum, d) => sum + (d.savingsAmount || 0), 0);
    const totalValue = savedDeals.reduce((sum, d) => sum + (d.price || 0), 0);
    return { totalSavings, totalValue, count: savedDeals.length };
  }, [savedDeals]);

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
    if (compareMode) {
      setCompareSelection((prev) => {
        if (prev.includes(deal.id)) return prev.filter((id) => id !== deal.id);
        if (prev.length >= 2) return prev;
        const next = [...prev, deal.id];
        if (next.length === 2) {
          const a = savedDeals.find((d) => d.id === next[0]);
          const b = savedDeals.find((d) => d.id === next[1]);
          if (a && b) {
            setCompareDeals([a, b]);
            setCompareMode(false);
            setCompareSelection([]);
          }
        }
        return next;
      });
      lightHaptic();
      return;
    }
    lightHaptic();
    router.push(`/destination/${deal.id}`);
  }, [router, compareMode, savedDeals]);

  const handleBook = useCallback((deal: BoardDeal) => {
    const store = useBookingFlowStore.getState();
    store.reset();
    store.setTripContext(departureCode, deal.iataCode, deal.destinationFull || deal.destination, deal.price ?? null);
    if (deal.cheapestDate && deal.cheapestReturnDate) {
      store.setDates(deal.cheapestDate, deal.cheapestReturnDate);
    }
    router.push(`/booking/${deal.id}/trip`);
  }, [router, departureCode]);

  const handleRemove = useCallback((deal: BoardDeal) => {
    warningHaptic();
    toggle(deal);
  }, [toggle]);

  const handleLongPress = useCallback((deal: BoardDeal) => {
    mediumHaptic();
    const options = ['View Details', 'Search Flights', 'Share', 'Remove from Saved', 'Cancel'];
    const destructiveButtonIndex = 3;
    const cancelButtonIndex = 4;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex,
          cancelButtonIndex,
          title: `${deal.destination}, ${deal.country}`,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            router.push(`/destination/${deal.id}`);
          } else if (buttonIndex === 1) {
            handleBook(deal);
          } else if (buttonIndex === 2) {
            shareDestination(deal.destination, deal.country, deal.tagline, deal.id, deal.price ?? undefined);
          } else if (buttonIndex === 3) {
            warningHaptic();
            toggle(deal);
          }
        },
      );
    } else if (Platform.OS === 'web') {
      // Web fallback — simple confirm for destructive action
      const action = typeof window !== 'undefined'
        ? window.prompt(`${deal.destination}\n\nType "remove" to unsave, or press Cancel:`)
        : null;
      if (action?.toLowerCase() === 'remove') {
        warningHaptic();
        toggle(deal);
      }
    } else {
      // Android fallback
      Alert.alert(
        `${deal.destination}, ${deal.country}`,
        undefined,
        [
          { text: 'View Details', onPress: () => router.push(`/destination/${deal.id}`) },
          { text: 'Search Flights', onPress: () => handleBook(deal) },
          { text: 'Remove from Saved', style: 'destructive', onPress: () => { warningHaptic(); toggle(deal); } },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  }, [router, toggle, handleBook]);

  const toggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev);
    setCompareSelection([]);
    lightHaptic();
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: BoardDeal; index: number }) => (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index, 8) * 50).springify()}
        style={compareMode && compareSelection.includes(item.id) ? styles.selectedCard : undefined}
      >
        <SavedCard
          deal={item}
          index={index}
          onPress={() => handlePress(item)}
          onRemove={() => handleRemove(item)}
          onBook={compareMode ? undefined : () => handleBook(item)}
          onLongPress={() => handleLongPress(item)}
        />
        {compareMode && compareSelection.includes(item.id) && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={24} color={colors.yellow} />
          </View>
        )}
      </Animated.View>
    ),
    [handlePress, handleRemove, handleBook, handleLongPress, compareMode, compareSelection],
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
          <View style={styles.headerActions}>
            {savedDeals.length >= 2 && (
              <Pressable
                onPress={toggleCompareMode}
                style={[styles.compareBtn, compareMode && styles.compareBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={compareMode ? 'Cancel comparison' : 'Compare two saved deals'}
              >
                <Ionicons name="git-compare-outline" size={16} color={compareMode ? colors.bg : colors.yellow} />
                <Text style={[styles.compareBtnText, compareMode && { color: colors.bg }]}>
                  {compareMode ? `Select ${2 - compareSelection.length}` : 'Compare'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        {savedDeals.length > 1 && !compareMode && (
          <View style={styles.sortRow}>
            {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => { lightHaptic(); setSortBy(opt); }}
                style={[styles.sortChip, sortBy === opt && styles.sortChipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${SORT_LABELS[opt]}`}
                accessibilityState={{ selected: sortBy === opt }}
              >
                <Text style={[styles.sortText, sortBy === opt && styles.sortTextActive]}>
                  {SORT_LABELS[opt]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {compareMode && (
          <Text style={styles.compareHint}>Tap two cards to compare them side by side</Text>
        )}
      </View>

      {/* Savings summary */}
      {savingsStats.count > 0 && savingsStats.totalSavings > 0 && !compareMode && (
        <View style={styles.savingsBanner}>
          <View style={styles.savingsStat}>
            <Text style={styles.savingsValue}>${savingsStats.totalSavings.toLocaleString()}</Text>
            <Text style={styles.savingsLabel}>total savings</Text>
          </View>
          <View style={styles.savingsDivider} />
          <View style={styles.savingsStat}>
            <Text style={styles.savingsValue}>${savingsStats.totalValue.toLocaleString()}</Text>
            <Text style={styles.savingsLabel}>trip value</Text>
          </View>
          <View style={styles.savingsDivider} />
          <View style={styles.savingsStat}>
            <Text style={styles.savingsValue}>{savingsStats.count}</Text>
            <Text style={styles.savingsLabel}>{savingsStats.count === 1 ? 'trip' : 'trips'}</Text>
          </View>
        </View>
      )}

      {savedDeals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✈</Text>
          <Text style={styles.emptyTitle}>No saved flights yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart on any deal to save it here
          </Text>
          <Pressable
            style={styles.exploreBtn}
            onPress={() => router.replace('/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="Go explore deals"
          >
            <Ionicons name="compass-outline" size={18} color={colors.bg} />
            <Text style={styles.exploreBtnText}>Explore Deals</Text>
          </Pressable>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.yellow}
              colors={[colors.yellow]}
              progressBackgroundColor={colors.surface}
            />
          }
        />
      )}

      {/* Compare sheet */}
      {compareDeals && (
        <CompareSheet deals={compareDeals} onClose={() => setCompareDeals(null)} />
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
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
  // Compare mode
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow + '40',
    backgroundColor: colors.yellow + '10',
  },
  compareBtnActive: {
    backgroundColor: colors.yellow,
    borderColor: colors.yellow,
  },
  compareBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.yellow,
  },
  compareHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    textAlign: 'center',
  },
  selectedCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.yellow,
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
  },

  // Savings banner
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: spacing.md,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dealAmazing + '20',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  savingsStat: {
    alignItems: 'center',
  },
  savingsValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.dealAmazing,
    letterSpacing: 0.5,
  },
  savingsLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savingsDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
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
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.yellow,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  exploreBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.bg,
    letterSpacing: 0.5,
  },
});
