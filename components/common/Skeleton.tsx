import { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  useReducedMotion,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../../theme/tokens';

// ─── Shimmer Core ────────────────────────────────────────────────

const SHIMMER_DURATION = 1500;

function useShimmer() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reducedMotion]);

  return { progress, reducedMotion };
}

// ─── Base Skeleton Element ───────────────────────────────────────

interface SkeletonBaseProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

function SkeletonBase({ width, height, borderRadius = 6, style }: SkeletonBaseProps) {
  const { progress, reducedMotion } = useShimmer();

  const shimmerStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: 0.6 };
    const translateX = interpolate(progress.value, [0, 1], [-1, 1]);
    return {
      transform: [{ translateX: translateX * 100 }],
    };
  });

  return (
    <View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          shimmerStyle,
        ]}
      >
        <LinearGradient
          colors={[colors.surface, colors.border + '60', colors.surface]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}

// ─── Skeleton.Box ────────────────────────────────────────────────

interface BoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

function Box({ width = '100%', height = 20, borderRadius = 6, style }: BoxProps) {
  return <SkeletonBase width={width} height={height} borderRadius={borderRadius} style={style} />;
}

// ─── Skeleton.Text ───────────────────────────────────────────────

interface TextProps {
  width?: number | string;
  height?: number;
  style?: object;
}

function SkeletonText({ width = '80%', height = 14, style }: TextProps) {
  return <SkeletonBase width={width} height={height} borderRadius={4} style={style} />;
}

// ─── Skeleton.Circle ─────────────────────────────────────────────

interface CircleProps {
  size?: number;
  style?: object;
}

function Circle({ size = 40, style }: CircleProps) {
  return <SkeletonBase width={size} height={size} borderRadius={size / 2} style={style} />;
}

// ─── Screen-Specific Skeletons ───────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Skeleton matching the SwipeCard layout — full-screen card with image, text, price, actions */
export function SkeletonSwipeCard() {
  return (
    <View style={skeletonStyles.swipeCard}>
      {/* Full-screen image area */}
      <Box width={SCREEN_W} height={SCREEN_H * 0.55} borderRadius={0} />

      {/* Status badge — top left */}
      <View style={skeletonStyles.swipeTopLeft}>
        <Box width={60} height={24} borderRadius={4} />
      </View>

      {/* Price tag — top right */}
      <View style={skeletonStyles.swipeTopRight}>
        <Box width={80} height={60} borderRadius={8} />
      </View>

      {/* Bottom content area */}
      <View style={skeletonStyles.swipeBottom}>
        {/* Destination name */}
        <SkeletonText width={180} height={32} />
        {/* Country */}
        <SkeletonText width={100} height={14} style={{ marginTop: 6 }} />
        {/* Tagline */}
        <SkeletonText width={240} height={16} style={{ marginTop: 12 }} />
        {/* Info chips row */}
        <View style={skeletonStyles.chipRow}>
          <Box width={70} height={24} borderRadius={4} />
          <Box width={55} height={24} borderRadius={4} />
          <Box width={65} height={24} borderRadius={4} />
        </View>
        {/* Vibe tags */}
        <View style={skeletonStyles.chipRow}>
          <Box width={60} height={22} borderRadius={12} />
          <Box width={70} height={22} borderRadius={12} />
          <Box width={55} height={22} borderRadius={12} />
        </View>
        {/* Action buttons */}
        <View style={skeletonStyles.actionRow}>
          <Box width={80} height={40} borderRadius={8} />
          <Box width={80} height={40} borderRadius={8} />
          <Box height={40} borderRadius={8} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

/** Skeleton for the saved grid card — small square with text below */
export function SkeletonSavedCard() {
  const CARD_GAP = 12;
  const cardW = (SCREEN_W - spacing.md * 2 - CARD_GAP) / 2;
  const cardH = cardW * 1.55;

  return (
    <View style={[skeletonStyles.savedCard, { width: cardW, height: cardH }]}>
      {/* Image area — fills most of the card */}
      <Box width={cardW} height={cardH * 0.6} borderRadius={0} />
      {/* Bottom content */}
      <View style={skeletonStyles.savedBottom}>
        {/* Price badge */}
        <Box width={60} height={18} borderRadius={4} />
        {/* City name */}
        <SkeletonText width={cardW * 0.7} height={14} style={{ marginTop: 6 }} />
        {/* Country */}
        <SkeletonText width={cardW * 0.5} height={11} style={{ marginTop: 4 }} />
        {/* Meta row */}
        <View style={[skeletonStyles.chipRow, { marginTop: 6 }]}>
          <Box width={40} height={10} borderRadius={3} />
          <Box width={35} height={10} borderRadius={3} />
        </View>
        {/* Book button */}
        <Box width={cardW - 20} height={30} borderRadius={6} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

/** Skeleton for the destination detail page */
export function SkeletonDestinationDetail() {
  return (
    <View style={skeletonStyles.detailContainer}>
      {/* Hero image */}
      <Box width={SCREEN_W} height={360} borderRadius={0} />

      <View style={skeletonStyles.detailContent}>
        {/* Title + subtitle */}
        <SkeletonText width={220} height={28} />
        <SkeletonText width={140} height={14} style={{ marginTop: 8 }} />

        {/* Price section */}
        <View style={skeletonStyles.detailSection}>
          <Box width={100} height={36} borderRadius={6} />
          <SkeletonText width={160} height={12} style={{ marginTop: 6 }} />
        </View>

        {/* Description block */}
        <View style={skeletonStyles.detailSection}>
          <SkeletonText width={'90%'} height={14} />
          <SkeletonText width={'75%'} height={14} style={{ marginTop: 8 }} />
          <SkeletonText width={'85%'} height={14} style={{ marginTop: 8 }} />
        </View>

        {/* Flight info block */}
        <View style={skeletonStyles.detailSection}>
          <Box width={'100%'} height={80} borderRadius={12} />
        </View>

        {/* AI section block */}
        <View style={skeletonStyles.detailSection}>
          <SkeletonText width={120} height={16} />
          <Box width={'100%'} height={100} borderRadius={12} style={{ marginTop: 8 }} />
        </View>
      </View>
    </View>
  );
}

/** Skeleton for a leaderboard row — rank circle, text lines, stats */
export function SkeletonLeaderboardRow() {
  return (
    <View style={skeletonStyles.leaderRow}>
      {/* Rank circle */}
      <Circle size={36} />
      {/* Name + subtitle */}
      <View style={skeletonStyles.leaderText}>
        <SkeletonText width={120} height={14} />
        <SkeletonText width={80} height={11} style={{ marginTop: 4 }} />
      </View>
      {/* Stats on right */}
      <View style={skeletonStyles.leaderStats}>
        <Box width={50} height={18} borderRadius={4} />
      </View>
    </View>
  );
}

// ─── Skeleton Grids (for embedding in screens) ──────────────────

/** 6 skeleton saved cards in a 2-column grid */
export function SkeletonSavedGrid() {
  return (
    <View style={skeletonStyles.savedGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonSavedCard key={i} />
      ))}
    </View>
  );
}

/** 8 skeleton leaderboard rows */
export function SkeletonLeaderboardList() {
  return (
    <View style={skeletonStyles.leaderList}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonLeaderboardRow key={i} />
      ))}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const skeletonStyles = StyleSheet.create({
  // SwipeCard skeleton
  swipeCard: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: colors.bg,
  },
  swipeTopLeft: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 70 : 60,
    left: spacing.md,
  },
  swipeTopRight: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 70 : 60,
    right: spacing.sm,
  },
  swipeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'web' ? 100 : 120,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
  },

  // SavedCard skeleton
  savedCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  savedBottom: {
    padding: 10,
  },

  // Saved grid
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: spacing.md,
  },

  // Destination detail
  detailContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  detailContent: {
    padding: spacing.md,
  },
  detailSection: {
    marginTop: spacing.lg,
  },

  // Leaderboard row
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  leaderText: {
    flex: 1,
  },
  leaderStats: {
    alignItems: 'flex-end',
  },
  leaderList: {
    paddingTop: spacing.sm,
  },
});

// ─── Export ──────────────────────────────────────────────────────

const Skeleton = { Box, Text: SkeletonText, Circle };
export default Skeleton;
