import React, { useCallback } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/tokens';
import { successHaptic, mediumHaptic } from '../../utils/haptics';

const SCREEN_W = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_W * 0.3; // 30% of screen width
const MAX_ROTATION = 12; // degrees at full swipe

interface SwipeGestureProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  enabled?: boolean;
}

export default function SwipeGesture({
  children,
  onSwipeRight,
  onSwipeLeft,
  enabled = true,
}: SwipeGestureProps) {
  const translateX = useSharedValue(0);
  const isActive = useSharedValue(false);

  // Track if we already fired haptic at threshold (avoid repeats during same drag)
  const didHaptic = useSharedValue(false);

  const fireHaptic = useCallback(() => {
    mediumHaptic();
  }, []);

  const fireSuccess = useCallback(() => {
    successHaptic();
  }, []);

  const handleSwipeRight = useCallback(() => {
    onSwipeRight();
  }, [onSwipeRight]);

  const handleSwipeLeft = useCallback(() => {
    onSwipeLeft();
  }, [onSwipeLeft]);

  const pan = Gesture.Pan()
    .enabled(enabled && Platform.OS !== 'web')
    // Only activate on clear horizontal movement; fail if vertical comes first
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onStart(() => {
      isActive.value = true;
      didHaptic.value = false;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;

      // Fire haptic when crossing threshold
      if (!didHaptic.value && Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        didHaptic.value = true;
        runOnJS(fireHaptic)();
      }
    })
    .onEnd((_e) => {
      const swipedRight = translateX.value > SWIPE_THRESHOLD;
      const swipedLeft = translateX.value < -SWIPE_THRESHOLD;

      if (swipedRight) {
        // Fly card off to the right
        translateX.value = withTiming(SCREEN_W * 1.5, { duration: 250 }, () => {
          runOnJS(fireSuccess)();
          runOnJS(handleSwipeRight)();
          // Reset position after callback
          translateX.value = 0;
          isActive.value = false;
        });
      } else if (swipedLeft) {
        // Fly card off to the left
        translateX.value = withTiming(-SCREEN_W * 1.5, { duration: 250 }, () => {
          runOnJS(handleSwipeLeft)();
          translateX.value = 0;
          isActive.value = false;
        });
      } else {
        // Spring back
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        isActive.value = false;
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-MAX_ROTATION, 0, MAX_ROTATION],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  const saveOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      [0, 0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0],
      [1, 0, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // On web, skip the gesture layer entirely (web uses keyboard shortcuts)
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.container, cardStyle]}>
        {children}

        {/* SAVE overlay (right swipe) */}
        <Animated.View style={[styles.overlay, styles.saveOverlay, saveOverlayStyle]} pointerEvents="none">
          <View style={styles.saveBadge}>
            <Ionicons name="heart" size={28} color="#fff" />
            <Text style={styles.overlayText}>SAVE</Text>
          </View>
        </Animated.View>

        {/* SKIP overlay (left swipe) */}
        <Animated.View style={[styles.overlay, styles.skipOverlay, skipOverlayStyle]} pointerEvents="none">
          <View style={styles.skipBadge}>
            <Ionicons name="close" size={28} color="#fff" />
            <Text style={styles.overlayText}>SKIP</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    borderRadius: 0,
  },
  saveOverlay: {
    alignItems: 'flex-start',
    paddingLeft: 32,
  },
  skipOverlay: {
    alignItems: 'flex-end',
    paddingRight: 32,
  },
  saveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  skipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  overlayText: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: '#fff',
    letterSpacing: 3,
  },
});
