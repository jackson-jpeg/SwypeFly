import { memo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, spacing } from '../theme/tokens';
import { lightHaptic } from '../utils/haptics';

interface SegmentedControlProps {
  value: 'swipe' | 'board';
  onChange: (value: 'swipe' | 'board') => void;
}

const INDICATOR_PADDING = 2;

function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useSharedValue(value === 'swipe' ? 0 : 1);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = (newValue: 'swipe' | 'board') => {
    if (newValue === value) return;
    lightHaptic();
    indicatorX.value = withTiming(newValue === 'swipe' ? 0 : 1, {
      duration: 150,
    });
    onChange(newValue);
  };

  const segmentWidth = containerWidth > 0 ? (containerWidth - INDICATOR_PADDING * 2) / 2 : 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value * segmentWidth }],
    width: segmentWidth,
  }));

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Sliding indicator */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      {/* Segments */}
      <Pressable style={styles.segment} onPress={() => handlePress('swipe')}>
        <Text
          style={[
            styles.segmentText,
            value === 'swipe' && styles.activeText,
          ]}
        >
          Swipe
        </Text>
      </Pressable>

      <Pressable style={styles.segment} onPress={() => handlePress('board')}>
        <Text
          style={[
            styles.segmentText,
            value === 'board' && styles.activeText,
          ]}
        >
          Board
        </Text>
      </Pressable>
    </View>
  );
}

export default memo(SegmentedControl);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 36,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: colors.cell,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: INDICATOR_PADDING,
    left: INDICATOR_PADDING,
    height: 36 - INDICATOR_PADDING * 2 - 2, // Account for border
    backgroundColor: colors.highlight,
    borderRadius: 8,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.muted,
    letterSpacing: 1,
  },
  activeText: {
    color: colors.yellow,
  },
});
