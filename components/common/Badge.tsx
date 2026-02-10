// ─── Badge Component ─────────────────────────────────────────────────────────
// Colored label: LIVE, AI GENERATED, AI VERIFIED, etc.

import { View, Text, Platform } from 'react-native';
import { colors, radii, spacing, fontSize, fontWeight } from '../../constants/theme';

type BadgeVariant = 'live' | 'ai' | 'aiVerified' | 'warning';

const VARIANTS: Record<BadgeVariant, { bg: string; text: string }> = {
  live: { bg: colors.successBackground, text: colors.successDark },
  ai: { bg: colors.aiBackground, text: colors.ai },
  aiVerified: { bg: colors.aiBackground, text: colors.ai },
  warning: { bg: 'rgba(245,158,11,0.1)', text: colors.warning },
};

const LABELS: Record<BadgeVariant, string> = {
  live: 'LIVE',
  ai: 'AI GENERATED',
  aiVerified: 'AI VERIFIED',
  warning: 'WARNING',
};

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
}

export function Badge({ variant, label }: BadgeProps) {
  const style = VARIANTS[variant];
  const text = label ?? LABELS[variant];

  if (Platform.OS === 'web') {
    return (
      <span
        style={{
          fontSize: variant === 'live' ? fontSize.xs : fontSize.sm,
          fontWeight: fontWeight.bold,
          color: style.text,
          backgroundColor: style.bg,
          borderRadius: radii.sm,
          padding: '2px 6px',
          letterSpacing: 0.5,
        }}
      >
        {text}
      </span>
    );
  }

  return (
    <View
      style={{
        backgroundColor: style.bg,
        borderRadius: radii.sm,
        paddingHorizontal: spacing['1.5'],
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: variant === 'live' ? fontSize.xs : fontSize.sm,
          fontWeight: fontWeight.bold,
          color: style.text,
          letterSpacing: 0.5,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
