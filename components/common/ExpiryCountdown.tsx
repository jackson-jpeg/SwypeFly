import { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '../../theme/tokens';

interface ExpiryCountdownProps {
  expiresAt: string;
}

interface TimeLeftResult {
  label: string;
  diffMs: number;
}

function getTimeLeft(expiresAt: string): TimeLeftResult | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: 'Expired', diffMs: 0 };
  if (diff > 86_400_000) return null; // > 24h, don't show countdown
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  if (hours > 0) return { label: `${hours}h ${minutes}m left`, diffMs: diff };
  if (minutes > 0) return { label: `${minutes}m ${seconds}s left`, diffMs: diff };
  return { label: `${seconds}s left`, diffMs: diff };
}

/** Determine refresh interval based on remaining time. */
function getInterval(diffMs: number): number {
  if (diffMs <= 0) return 60_000; // expired, slow poll
  if (diffMs <= 5 * 60_000) return 1_000; // < 5 min: every second
  if (diffMs <= 60 * 60_000) return 10_000; // < 1 hour: every 10s
  return 60_000; // otherwise: every minute
}

export default function ExpiryCountdown({ expiresAt }: ExpiryCountdownProps) {
  const [result, setResult] = useState(() => getTimeLeft(expiresAt));

  // Pulsing animation for urgent countdown (< 5 min)
  const pulseScale = useSharedValue(1);

  const isExpired = result?.diffMs === 0 && result?.label === 'Expired';
  const isUrgent = result != null && !isExpired && result.diffMs <= 5 * 60_000;

  useEffect(() => {
    if (isUrgent) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 150 });
    }
  }, [isUrgent, pulseScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  useEffect(() => {
    const tick = () => setResult(getTimeLeft(expiresAt));
    tick();

    // Use adaptive interval based on current remaining time
    let intervalId: ReturnType<typeof setInterval>;

    const scheduleNext = () => {
      const current = getTimeLeft(expiresAt);
      const interval = getInterval(current?.diffMs ?? 0);
      clearInterval(intervalId);
      intervalId = setInterval(() => {
        tick();
        // Re-evaluate interval when crossing thresholds
        const now = getTimeLeft(expiresAt);
        const newInterval = getInterval(now?.diffMs ?? 0);
        if (newInterval !== interval) {
          scheduleNext();
        }
      }, interval);
    };

    scheduleNext();
    return () => clearInterval(intervalId);
  }, [expiresAt]);

  if (!result) return null;

  const accessLabel = isExpired
    ? 'Deal expired'
    : `Deal expires in ${result.label.replace(' left', '')}`;

  return (
    <Animated.View
      style={[
        styles.badge,
        isExpired && styles.badgeExpired,
        isUrgent && styles.badgeUrgent,
        animatedStyle,
      ]}
      accessibilityRole="text"
      accessibilityLabel={accessLabel}
    >
      <Ionicons
        name={isExpired ? 'alert-circle-outline' : 'timer-outline'}
        size={11}
        color={isExpired ? colors.muted : '#EF4444'}
      />
      <Text style={[styles.text, isExpired && styles.textExpired]}>
        {result.label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
  },
  badgeExpired: {
    backgroundColor: 'rgba(100,100,100,0.15)',
    borderColor: 'rgba(100,100,100,0.4)',
  },
  badgeUrgent: {
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderColor: 'rgba(239,68,68,0.6)',
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#EF4444',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  textExpired: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
});
