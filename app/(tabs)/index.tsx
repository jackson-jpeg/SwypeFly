import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDealStore } from '../../stores/dealStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFilterStore } from '../../stores/filterStore';
import SwipeFeed from '../../components/swipe/SwipeFeed';
import SkeletonCard from '../../components/swipe/SkeletonCard';
import SplitFlapRow from '../../components/board/SplitFlapRow';
import FilterButton from '../../components/swipe/FilterButton';
import FilterSheet from '../../components/swipe/FilterSheet';
import { colors, fonts } from '../../theme/tokens';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { deals, isLoading, error, fetchDeals } = useDealStore();
  const departureCode = useSettingsStore((s) => s.departureCode);
  const toQueryParams = useFilterStore((s) => s.toQueryParams);
  const clearFilters = useFilterStore((s) => s.clearAll);
  const isSheetOpen = useFilterStore((s) => s.isOpen);
  const prevDepartureRef = useRef(departureCode);

  // Clear filters when departure city changes (fresh context)
  useEffect(() => {
    if (prevDepartureRef.current !== departureCode) {
      prevDepartureRef.current = departureCode;
      clearFilters();
    }
  }, [departureCode]);

  // Refetch when filters change (sheet closes) or departure changes
  useEffect(() => {
    if (!isSheetOpen) {
      fetchDeals(departureCode, toQueryParams());
    }
  }, [departureCode, isSheetOpen]);

  return (
    <View style={styles.container}>
      {/* Floating header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.logo}>✈ SOGOJET</Text>
        <FilterButton />
        <View style={styles.airportBadge}>
          <Text style={styles.airportText}>{departureCode}</Text>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <SkeletonCard />
      ) : deals.length === 0 ? (
        <View style={styles.empty}>
          <SplitFlapRow
            text="NO FLIGHTS"
            maxLength={12}
            size="lg"
            color={colors.muted}
            align="left"
            startDelay={0}
            staggerMs={50}
            animate={true}
          />
          <Text style={styles.emptySubtitle}>
            {error
              ? 'Check your connection and try again'
              : 'Try a different departure city or adjust filters'}
          </Text>
        </View>
      ) : (
        <SwipeFeed />
      )}

      {/* Filter sheet overlay */}
      <FilterSheet />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    ...Platform.select({
      web: { pointerEvents: 'box-none' as const },
      default: {},
    }),
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  airportBadge: {
    backgroundColor: 'rgba(10,8,6,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.green + '60',
  },
  airportText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.green,
    letterSpacing: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
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
