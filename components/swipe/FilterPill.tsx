import { useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated } from 'react-native';
import { colors, fonts } from '../../theme/tokens';

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export default function FilterPill({ label, isActive, onPress, accessibilityLabel }: FilterPillProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.pill, isActive && styles.pillActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={accessibilityLabel || label}
      >
        <Text style={[styles.text, isActive && styles.textActive]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  textActive: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFF8F0',
  },
});
