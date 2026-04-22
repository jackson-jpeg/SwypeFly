import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { useStreakStore } from '../../stores/streakStore';
import { colors, fonts } from '../../theme/tokens';

const MILESTONE_DAYS = [7, 14, 30, 50, 100, 365];

export default function StreakBadge() {
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isMilestone = MILESTONE_DAYS.includes(currentStreak);

  useEffect(() => {
    if (isMilestone) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [currentStreak, isMilestone, scaleAnim]);

  if (currentStreak < 1) return null;

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.flame}>🔥</Text>
      <Text style={[styles.count, isMilestone && styles.milestoneCount]}>{currentStreak}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,8,6,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.orange + '50',
    gap: 3,
  },
  flame: {
    fontSize: 13,
  },
  count: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.orange,
    letterSpacing: 0.5,
  },
  milestoneCount: {
    color: colors.dealAmazing,
  },
});
