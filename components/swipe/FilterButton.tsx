import { Pressable, View, Text, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFilterStore } from '../../stores/filterStore';
import { colors, fonts } from '../../theme/tokens';

export default function FilterButton() {
  const activeCount = useFilterStore((s) => s.activeCount);
  const open = useFilterStore((s) => s.open);
  const count = activeCount();
  const hasFilters = count > 0;
  const badgeScale = useRef(new Animated.Value(hasFilters ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(badgeScale, {
      toValue: hasFilters ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  }, [hasFilters]);

  return (
    <Pressable
      onPress={open}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Open filters"
      accessibilityHint={hasFilters ? `${count} filters active` : 'No filters active'}
    >
      <Ionicons name="compass-outline" size={22} color={hasFilters ? colors.orange : colors.muted} />
      {hasFilters && (
        <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
          <Text style={styles.badgeText}>{count}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: colors.orange,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFF8F0',
  },
});
