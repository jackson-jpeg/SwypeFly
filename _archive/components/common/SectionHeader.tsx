// ─── Section Header ──────────────────────────────────────────────────────────
// Section title with optional AI/LIVE badge. Used 7+ times in detail page.

import { View, Text, Platform } from 'react-native';
import { colors, fontSize, fontWeight, spacing, radii } from '../../constants/theme';
import { badgeStyles } from '../../constants/styles';

interface SectionHeaderProps {
  title: string;
  badge?: 'ai' | 'live';
}

export function SectionHeader({ title, badge }: SectionHeaderProps) {
  const badgeElement = badge === 'ai' ? (
    Platform.OS === 'web' ? (
      <span style={{
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.ai,
        backgroundColor: colors.aiBackground,
        borderRadius: radii.sm,
        padding: '2px 6px',
        letterSpacing: 0.5,
        marginLeft: spacing['2'],
      }}>
        AI GENERATED
      </span>
    ) : (
      <View style={[badgeStyles.ai, { marginLeft: spacing['2'] }]}>
        <Text style={badgeStyles.aiText}>AI GENERATED</Text>
      </View>
    )
  ) : badge === 'live' ? (
    Platform.OS === 'web' ? (
      <span style={{
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.successDark,
        backgroundColor: colors.successBackground,
        borderRadius: radii.sm,
        padding: '2px 6px',
        letterSpacing: 0.5,
        marginLeft: spacing['2'],
      }}>
        LIVE
      </span>
    ) : (
      <View style={[badgeStyles.live, { marginLeft: spacing['2'] }]}>
        <Text style={badgeStyles.liveText}>LIVE</Text>
      </View>
    )
  ) : null;

  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing['2'] }}>
        <h3 style={{ margin: 0, color: colors.text.primary, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }}>
          {title}
        </h3>
        {badgeElement}
      </div>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing['2'] }}>
      <Text style={{ color: colors.text.primary, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }}>
        {title}
      </Text>
      {badgeElement}
    </View>
  );
}
