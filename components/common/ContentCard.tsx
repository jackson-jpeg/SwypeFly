// ─── Content Card ────────────────────────────────────────────────────────────
// White bordered card pattern used 10+ times.

import { View, Platform } from 'react-native';
import type { ReactNode } from 'react';
import { colors, radii, spacing } from '../../constants/theme';

interface ContentCardProps {
  children: ReactNode;
  padding?: number;
  gap?: number;
  style?: Record<string, unknown>;
  nativeStyle?: Record<string, unknown>;
}

export function ContentCard({ children, padding = spacing['4'], gap, style, nativeStyle }: ContentCardProps) {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii['2xl'],
          border: `1px solid ${colors.border}`,
          padding,
          display: gap != null ? 'flex' : undefined,
          flexDirection: gap != null ? 'column' : undefined,
          gap: gap != null ? gap : undefined,
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
        backgroundColor: colors.surface,
        borderRadius: radii['2xl'],
        borderWidth: 1,
        borderColor: colors.border,
        padding,
        gap: gap != null ? gap : undefined,
        ...nativeStyle,
      }}
    >
      {children}
    </View>
  );
}
