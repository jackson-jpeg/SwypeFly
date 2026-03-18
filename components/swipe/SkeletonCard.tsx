import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/tokens';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Shimmer placeholder while feed is loading.
 * On web we use CSS animation; on native a static pulse.
 */
export default function SkeletonCard() {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.03)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Fake status badge */}
      <View style={[styles.pill, { top: Platform.OS === 'web' ? 70 : 60, left: 16, width: 50, height: 22 }]} />

      {/* Fake price tag */}
      <View style={[styles.pill, { top: Platform.OS === 'web' ? 70 : 60, right: 16, width: 80, height: 64, borderRadius: 8 }]} />

      {/* Bottom content placeholders */}
      <View style={styles.bottom}>
        <View style={[styles.pill, { width: 200, height: 40 }]} />
        <View style={[styles.pill, { width: 120, height: 14, marginTop: 8 }]} />
        <View style={[styles.pill, { width: SCREEN_W - 64, height: 16, marginTop: 16 }]} />
        <View style={styles.chipRow}>
          <View style={[styles.pill, { width: 70, height: 24, borderRadius: 4 }]} />
          <View style={[styles.pill, { width: 80, height: 24, borderRadius: 4 }]} />
          <View style={[styles.pill, { width: 60, height: 24, borderRadius: 4 }]} />
        </View>
        <View style={[styles.pill, { width: SCREEN_W - 32, height: 44, marginTop: 20, borderRadius: 8 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: colors.surface,
  },
  pill: {
    backgroundColor: colors.border,
    borderRadius: 6,
    opacity: 0.5,
  },
  bottom: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 100 : 120,
    left: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
});
