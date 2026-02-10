// ─── Frosted Glass Container ─────────────────────────────────────────────────
// Used in card actions, deal badge, freshness pill, tab bar.

import { View, Platform } from 'react-native';
import type { ReactNode } from 'react';
import { colors, radii } from '../../constants/theme';

interface GlassPanelProps {
  children: ReactNode;
  radius?: keyof typeof radii;
  padding?: number;
  style?: Record<string, unknown>;
  nativeStyle?: Record<string, unknown>;
}

export function GlassPanel({ children, radius = '3xl', padding, style, nativeStyle }: GlassPanelProps) {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          backgroundColor: colors.overlay.card,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: radii[radius],
          border: `1px solid ${colors.overlay.white}`,
          padding: padding != null ? padding : undefined,
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.overlay.card,
        borderRadius: radii[radius],
        borderWidth: 1,
        borderColor: colors.overlay.white,
        padding: padding != null ? padding : undefined,
        ...nativeStyle,
      }}
    >
      {children}
    </View>
  );
}
