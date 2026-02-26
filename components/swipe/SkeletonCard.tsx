import { View, Platform, useWindowDimensions } from 'react-native';
import { colors, radii } from '../../constants/theme';

export function SkeletonCard() {
  const { width, height } = useWindowDimensions();

  // sg-shimmer keyframes defined in global.css

  const shimmerBg = colors.shimmer;
  const shimmerHi = colors.shimmerHighlight;

  if (Platform.OS === 'web') {
    return (
      <div style={{ width: '100%', height: '100vh', backgroundColor: colors.navy, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 56, left: 20 }}>
          <div className="sg-shimmer" style={{ width: 110, height: 28, borderRadius: radii['3xl'], backgroundColor: shimmerBg }} />
        </div>
        <div style={{ position: 'absolute', bottom: 84, left: 28, right: 28 }}>
          <div className="sg-shimmer" style={{ width: '80%', height: 70, borderRadius: radii['2xl'], backgroundColor: shimmerBg, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div className="sg-shimmer" style={{ width: 60, height: 14, borderRadius: radii.sm, backgroundColor: shimmerBg }} />
            <div className="sg-shimmer" style={{ width: 72, height: 14, borderRadius: radii.sm, backgroundColor: shimmerBg }} />
          </div>
          <div className="sg-shimmer" style={{ width: 220, height: 40, borderRadius: 6, backgroundColor: shimmerHi, marginBottom: 10 }} />
          <div className="sg-shimmer" style={{ width: 240, height: 16, borderRadius: radii.sm, backgroundColor: shimmerBg }} />
        </div>
      </div>
    );
  }

  return (
    <View style={{ width, height, backgroundColor: colors.navy, position: 'relative' }}>
      <View style={{ position: 'absolute', top: 56, left: 20 }}>
        <View style={{ width: 110, height: 28, borderRadius: radii['3xl'], backgroundColor: shimmerBg }} />
      </View>
      <View style={{ position: 'absolute', bottom: 100, left: 28, right: 28 }}>
        <View style={{ width: '80%', height: 70, borderRadius: radii['2xl'], backgroundColor: shimmerBg, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View style={{ width: 60, height: 14, borderRadius: radii.sm, backgroundColor: shimmerBg }} />
          <View style={{ width: 72, height: 14, borderRadius: radii.sm, backgroundColor: shimmerBg }} />
        </View>
        <View style={{ width: 220, height: 40, borderRadius: 6, backgroundColor: shimmerHi, marginBottom: 10 }} />
        <View style={{ width: 240, height: 16, borderRadius: radii.sm, backgroundColor: shimmerBg }} />
      </View>
    </View>
  );
}
