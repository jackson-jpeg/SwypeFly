// ─── Quick Stats Strip ───────────────────────────────────────────────────────
// Temp, flight time, rating — horizontal strip.

import { View, Text, Platform } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';
import type { Destination } from '../../types/destination';

interface QuickStatsProps {
  destination: Destination;
}

function StatBox({ label, value, isWeb }: { label: string; value: string; isWeb: boolean }) {
  if (isWeb) {
    return (
      <div style={{
        flex: '1 1 0', minWidth: 100,
        backgroundColor: colors.dark.surface, border: `1px solid ${colors.dark.border}`,
        borderRadius: radii.lg, padding: `${spacing['3']}px ${spacing['4']}px`, textAlign: 'center',
      }}>
        <div style={{ color: colors.dark.text.muted, fontSize: fontSize.md, fontWeight: fontWeight.medium }}>{label}</div>
        <div style={{ color: colors.dark.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginTop: 2 }}>
          {value}
        </div>
      </div>
    );
  }

  return (
    <View style={{
      flex: 1, backgroundColor: colors.dark.surface, borderWidth: 1, borderColor: colors.dark.border,
      borderRadius: radii.lg, padding: spacing['3'], alignItems: 'center',
    }}>
      <Text style={{ color: colors.dark.text.muted, fontSize: fontSize.md, fontWeight: fontWeight.medium }}>{label}</Text>
      <Text style={{ color: colors.dark.text.primary, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

export function QuickStats({ destination }: QuickStatsProps) {
  const isWeb = Platform.OS === 'web';

  if (isWeb) {
    return (
      <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['5'], flexWrap: 'wrap' }}>
        <StatBox label="Avg Temp" value={`${destination.averageTemp}\u00B0F`} isWeb />
        <StatBox label="Flight" value={destination.flightDuration} isWeb />
        <StatBox label="Rating" value={`${destination.rating.toFixed(1)} \u2B50`} isWeb />
      </div>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: spacing['3'], marginTop: spacing['5'] }}>
      <StatBox label="Avg Temp" value={`${destination.averageTemp}\u00B0F`} isWeb={false} />
      <StatBox label="Flight" value={destination.flightDuration} isWeb={false} />
      <StatBox label="Rating" value={`${destination.rating.toFixed(1)} \u2B50`} isWeb={false} />
    </View>
  );
}
