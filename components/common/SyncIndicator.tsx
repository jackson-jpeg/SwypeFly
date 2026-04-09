import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Network from 'expo-network';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSavedStore } from '../../stores/savedStore';
import { colors, fonts, spacing } from '../../theme/tokens';

type SyncState = 'idle' | 'syncing' | 'synced' | 'offline';

export default function SyncIndicator() {
  const pendingSyncs = useSavedStore((s) => s.pendingSyncs);
  const pendingCount = pendingSyncs.length;
  const [isOnline, setIsOnline] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [prevCount, setPrevCount] = useState(pendingCount);

  const translateY = useSharedValue(60);
  const opacity = useSharedValue(0);

  // Poll network status when there are pending syncs
  useEffect(() => {
    if (pendingCount === 0) return;
    let cancelled = false;
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!cancelled) setIsOnline(state.isConnected !== false);
      } catch {
        // expo-network unavailable (SSR)
      }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pendingCount]);

  // Determine sync state
  useEffect(() => {
    if (pendingCount > 0 && !isOnline) {
      setSyncState('offline');
    } else if (pendingCount > 0) {
      setSyncState('syncing');
    } else if (prevCount > 0 && pendingCount === 0) {
      // Just finished syncing
      setSyncState('synced');
    }
    setPrevCount(pendingCount);
  }, [pendingCount, isOnline]);

  // Animate in/out based on sync state
  useEffect(() => {
    if (syncState === 'idle') {
      translateY.value = withTiming(60, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
      return;
    }

    // Show indicator
    translateY.value = withTiming(0, { duration: 250 });
    opacity.value = withTiming(1, { duration: 250 });

    if (syncState === 'synced') {
      // Auto-hide after 2s
      const timer = setTimeout(() => {
        translateY.value = withTiming(60, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 });
        // Reset state after animation
        const resetTimer = setTimeout(() => setSyncState('idle'), 350);
        return () => clearTimeout(resetTimer);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [syncState, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (syncState === 'idle') return null;

  const label =
    syncState === 'offline'
      ? `Offline \u2014 ${pendingCount} save${pendingCount !== 1 ? 's' : ''} pending`
      : syncState === 'syncing'
        ? `Syncing ${pendingCount} save${pendingCount !== 1 ? 's' : ''}...`
        : 'All synced';

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    syncState === 'offline'
      ? 'cloud-offline-outline'
      : syncState === 'synced'
        ? 'checkmark-circle-outline'
        : 'sync-outline';

  const iconColor =
    syncState === 'offline'
      ? colors.orange
      : syncState === 'synced'
        ? colors.green
        : colors.yellow;

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
    >
      <View accessibilityRole="alert" accessibilityLabel={label}>
        <View style={styles.inner}>
          <Ionicons name={iconName} size={14} color={iconColor} />
          <Text style={[styles.text, syncState === 'offline' && styles.textOffline]}>
            {label}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 95 : 75,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 20,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  textOffline: {
    color: colors.orange,
  },
});
