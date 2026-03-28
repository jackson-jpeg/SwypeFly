import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Animated, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDealStore } from '../../stores/dealStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFilterStore } from '../../stores/filterStore';
import SwipeFeed from '../../components/swipe/SwipeFeed';
import DepartureBoard from '../../components/board/DepartureBoard';
import SkeletonCard from '../../components/swipe/SkeletonCard';
import SplitFlapRow from '../../components/board/SplitFlapRow';
import FilterButton from '../../components/swipe/FilterButton';
import FilterSheet from '../../components/swipe/FilterSheet';
import { colors, fonts, spacing } from '../../theme/tokens';
import { nearbyAirports } from '../../data/airports';

// Immersion mode: header fades after 2+ swipes, returns on tap
const IMMERSE_AFTER_SWIPES = 2;

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deals, isLoading, error, fetchDeals } = useDealStore();
  const departureCode = useSettingsStore((s) => s.departureCode);
  const preferredView = useSettingsStore((s) => s.preferredView);
  const toQueryParams = useFilterStore((s) => s.toQueryParams);
  const clearFilters = useFilterStore((s) => s.clearAll);
  const isSheetOpen = useFilterStore((s) => s.isOpen);
  const prevDepartureRef = useRef(departureCode);

  // Immersion mode state
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const [immersed, setImmersed] = useState(false);

  const fadeHeader = useCallback((show: boolean) => {
    Animated.timing(headerOpacity, {
      toValue: show ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setImmersed(!show);
  }, [headerOpacity]);

  const handleVisibleIndexChange = useCallback((index: number) => {
    if (index >= IMMERSE_AFTER_SWIPES && !immersed) {
      fadeHeader(false);
    } else if (index === 0 && immersed) {
      fadeHeader(true);
    }
  }, [immersed, fadeHeader]);

  const handleHeaderTap = useCallback(() => {
    if (immersed) fadeHeader(true);
  }, [immersed, fadeHeader]);

  // Deal stats for header subtitle
  const dealStats = useMemo(() => {
    if (deals.length === 0) return null;
    const withSavings = deals.filter((d) => d.savingsPercent && d.savingsPercent > 0);
    const avgSavings = withSavings.length > 0
      ? Math.round(withSavings.reduce((sum, d) => sum + (d.savingsPercent || 0), 0) / withSavings.length)
      : 0;
    const amazingCount = deals.filter((d) => d.dealTier === 'amazing' || d.dealTier === 'great').length;
    return { total: deals.length, avgSavings, amazingCount };
  }, [deals]);

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
      {/* Floating header — fades during immersion */}
      <Pressable onPress={handleHeaderTap} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <Animated.View style={[styles.header, { paddingTop: insets.top + 8, opacity: headerOpacity }]}>
          <View>
            <Text style={styles.logo}>✈ SOGOJET</Text>
            {dealStats && dealStats.avgSavings > 0 && (
              <Text style={styles.dealCounter}>
                {dealStats.total} deals · avg {dealStats.avgSavings}% off
              </Text>
            )}
          </View>
          <FilterButton />
          <View style={styles.airportBadge}>
            <Text style={styles.airportText}>{departureCode}</Text>
          </View>
        </Animated.View>
      </Pressable>

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
              : 'No deals found from ' + departureCode + ' right now'}
          </Text>

          {/* Retry button */}
          <Pressable
            style={styles.retryBtn}
            onPress={() => fetchDeals(departureCode, toQueryParams())}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>

          {/* Nearby airports suggestion */}
          {nearbyAirports[departureCode || ''] && (
            <View style={styles.nearbySection}>
              <Text style={styles.nearbyTitle}>Try nearby airports</Text>
              <View style={styles.nearbyRow}>
                {nearbyAirports[departureCode || ''].slice(0, 3).map((ap) => (
                  <Pressable
                    key={ap.code}
                    style={styles.nearbyChip}
                    onPress={() => {
                      useSettingsStore.getState().setDeparture(ap.label.split(' (')[0], ap.code);
                    }}
                  >
                    <Text style={styles.nearbyCode}>{ap.code}</Text>
                    <Text style={styles.nearbyLabel}>{ap.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Deal forecast */}
          <View style={styles.forecastSection}>
            <Text style={styles.forecastText}>
              Deals from {departureCode} typically appear several times per week.{'\n'}
              Set a price alert to get notified instantly.
            </Text>
          </View>
        </View>
      ) : preferredView === 'board' ? (
        <DepartureBoard
          deals={deals}
          onTapDeal={(deal) => router.push(`/destination/${deal.id}`)}
          isLoading={isLoading}
        />
      ) : (
        <SwipeFeed onVisibleIndexChange={handleVisibleIndexChange} />
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
  dealCounter: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 0.5,
    marginTop: 2,
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
  retryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.yellow,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.bg,
    letterSpacing: 0.5,
  },
  nearbySection: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  nearbyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  nearbyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nearbyChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  nearbyCode: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.green,
    letterSpacing: 1,
  },
  nearbyLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.faint,
    marginTop: 2,
  },
  forecastSection: {
    marginTop: spacing.lg,
    paddingHorizontal: 40,
  },
  forecastText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.faint,
    textAlign: 'center',
    lineHeight: 18,
  },
});
