import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import * as Linking from 'expo-linking';
import Ionicons from '@expo/vector-icons/Ionicons';
import DepartureRow from './DepartureRow';
import SplitFlapRow from './SplitFlapRow';
import { colors, fonts, spacing } from '../../theme/tokens';
import { useDealStore } from '../../stores/dealStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { mediumHaptic, lightHaptic } from '../../utils/haptics';
import type { BoardDeal } from '../../types/deal';

interface DepartureBoardProps {
  deals: BoardDeal[];
  onTapDeal: (deal: BoardDeal) => void;
  isLoading?: boolean;
}

export default function DepartureBoard({ deals, onTapDeal, isLoading = false }: DepartureBoardProps) {
  const boardIndex = useDealStore((s) => s.boardIndex);
  const advanceBoard = useDealStore((s) => s.advanceBoard);
  const jumpToBoard = useDealStore((s) => s.jumpToBoard);
  const fetchMore = useDealStore((s) => s.fetchMore);
  const departureCode = useSettingsStore((s) => s.departureCode);

  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  const detailOpacity = useSharedValue(1);

  // Get 5 visible deals starting from boardIndex
  const visibleDeals = deals.slice(boardIndex, boardIndex + 5);

  // Active deal is always index 0 of visible
  const activeDeal = visibleDeals[0];

  const handleNextFlight = useCallback(() => {
    if (boardIndex >= deals.length - 1) return;

    // 1. Haptic thunk
    mediumHaptic();

    // 2. Advance the board index
    advanceBoard();

    // 3. Prefetch if near end
    if (boardIndex >= deals.length - 4) {
      fetchMore(departureCode);
    }

    // 4. Trigger row 0 animation
    setAnimatingRow(0);

    // 5. Fade detail strip
    detailOpacity.value = withTiming(0, { duration: 75 }, () => {
      detailOpacity.value = withTiming(1, { duration: 75 });
    });
  }, [boardIndex, deals.length, advanceBoard, fetchMore, departureCode, detailOpacity]);

  const handleRowPress = useCallback(
    (localIndex: number) => {
      if (localIndex === 0 && activeDeal) {
        // Tap row 0 → navigate to detail
        onTapDeal(activeDeal);
      } else {
        // Tap other rows → make it active
        lightHaptic();
        jumpToBoard(boardIndex + localIndex);
        setAnimatingRow(0);

        // Fade detail strip
        detailOpacity.value = withTiming(0, { duration: 75 }, () => {
          detailOpacity.value = withTiming(1, { duration: 75 });
        });
      }
    },
    [activeDeal, boardIndex, jumpToBoard, onTapDeal, detailOpacity],
  );

  const swipeUpGesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.translationY < -50 && event.velocityY < -200) {
        runOnJS(handleNextFlight)();
      }
    });

  const handleBookIt = useCallback(() => {
    if (!activeDeal?.affiliateUrl) return;
    lightHaptic();
    if (Platform.OS === 'web') {
      window.open(activeDeal.affiliateUrl, '_blank', 'noopener');
    } else {
      Linking.openURL(activeDeal.affiliateUrl);
    }
  }, [activeDeal]);

  const handleAnimationComplete = useCallback(() => {
    setAnimatingRow(null);
  }, []);

  const detailAnimStyle = useAnimatedStyle(() => ({
    opacity: detailOpacity.value,
  }));

  // Loading state — 5 rows cycling indefinitely
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.boardArea}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={`loading-${i}`} style={[styles.loadingRow, i === 0 ? styles.active : styles.loadingInactive]}>
              <SplitFlapRow text="" maxLength={5} size="sm" color={colors.yellow} align="right" animate startDelay={0} />
              <SplitFlapRow text="" maxLength={12} size="md" color={colors.yellow} align="left" animate startDelay={80} />
              <SplitFlapRow text="" maxLength={6} size="sm" color={colors.whiteDim} align="left" animate startDelay={160} />
              <SplitFlapRow text="" maxLength={5} size="md" color={colors.green} align="right" animate startDelay={240} />
              <SplitFlapRow text="" maxLength={4} size="sm" color={colors.green} align="left" animate startDelay={320} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Empty state
  if (deals.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        {/* 5 placeholder rows with dashes */}
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.emptyRow, { opacity: 0.25 }]}>
            <Text style={styles.emptyRowText}>{'—'.repeat(30)}</Text>
          </View>
        ))}
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyIcon}>{'\u2708'}</Text>
          <Text style={styles.emptyTitle}>No flights available</Text>
          <Text style={styles.emptySubtitle}>Check back soon</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Board area with swipe gesture */}
      <GestureDetector gesture={swipeUpGesture}>
        <Animated.View style={styles.boardArea}>
          {visibleDeals.map((deal, localIndex) => (
            <Pressable
              key={deal.id}
              onPress={() => handleRowPress(localIndex)}
            >
              <DepartureRow
                deal={deal}
                isActive={localIndex === 0}
                animate={animatingRow === localIndex}
                onAnimationComplete={
                  localIndex === 0 ? handleAnimationComplete : undefined
                }
              />
            </Pressable>
          ))}

          {/* Fill empty slots if fewer than 5 deals visible */}
          {visibleDeals.length < 5 &&
            Array.from({ length: 5 - visibleDeals.length }).map((_, i) => (
              <View
                key={`empty-${i}`}
                style={[styles.emptyRow, { opacity: 0.25 }]}
              >
                <Text style={styles.emptyRowText}>{'—'.repeat(30)}</Text>
              </View>
            ))}
        </Animated.View>
      </GestureDetector>

      {/* Detail strip */}
      {activeDeal && (
        <Animated.View style={[styles.detailStrip, detailAnimStyle]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.detailContent}
          >
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>
                {activeDeal.departureDate} — {activeDeal.returnDate}
              </Text>
            </View>
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>
                {activeDeal.flightDuration}
              </Text>
            </View>
            {activeDeal.vibeTags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.detailPill}>
                <Text style={styles.detailPillText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Action buttons */}
      <View style={styles.actionContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.nextButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleNextFlight}
        >
          <Ionicons name="shuffle" size={16} color={colors.muted} />
          <Text style={styles.nextButtonText}>NEXT FLIGHT</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.bookButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleBookIt}
        >
          <Ionicons name="airplane" size={16} color={colors.bg} />
          <Text style={styles.bookButtonText}>BOOK IT</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  boardArea: {
    flex: 1,
  },

  // Loading state
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1510',
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  active: {
    borderLeftColor: colors.yellow,
  },
  loadingInactive: {
    opacity: 0.45,
  },

  // Detail strip
  detailStrip: {
    backgroundColor: colors.cell,
    paddingVertical: spacing.sm,
  },
  detailContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  detailPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailPillText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
  },

  // Action buttons
  actionContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 10,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.muted,
    backgroundColor: 'transparent',
  },
  nextButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.muted,
  },
  bookButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.green,
  },
  bookButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.bg,
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  emptyRow: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1510',
  },
  emptyRowText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.border,
    letterSpacing: 2,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.muted,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.faint,
    marginTop: 4,
  },
});
