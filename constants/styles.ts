// ─── Shared Style Presets ────────────────────────────────────────────────────
// Composite styles built from design tokens for reuse across components.

import { StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSize, fontWeight, shadows } from './theme';

// ─── Card Styles ─────────────────────────────────────────────────────────────
export const cardStyles = StyleSheet.create({
  glass: {
    backgroundColor: colors.overlay.card,
    borderRadius: radii['3xl'],
    borderWidth: 1,
    borderColor: colors.overlay.white,
  },
  glassCompact: {
    backgroundColor: colors.overlay.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.overlay.whiteMedium,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['4'],
  },
  contentRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['4'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

// Web-specific card styles (CSS properties not in RN)
export const cardWebStyles = {
  glass: {
    backgroundColor: colors.overlay.card,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: radii['3xl'],
    border: `1px solid ${colors.overlay.white}`,
  },
  glassCompact: {
    backgroundColor: colors.overlay.cardStrong,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: radii.xl,
    border: `1px solid ${colors.overlay.whiteMedium}`,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    border: `1px solid ${colors.border}`,
    padding: `${spacing['4']}px`,
  },
  contentRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    border: `1px solid ${colors.border}`,
    padding: `${spacing['4']}px ${spacing['4'] + 2}px`,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
} as const;

// ─── Text Styles ─────────────────────────────────────────────────────────────
export const textStyles = StyleSheet.create({
  pageTitle: {
    color: colors.text.primary,
    fontSize: fontSize['6xl'],
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  body: {
    color: colors.text.body,
    fontSize: fontSize.xl,
    lineHeight: 24,
  },
  caption: {
    color: colors.text.muted,
    fontSize: fontSize.md,
  },
  settingsRow: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
  },
});

// ─── Button Styles ───────────────────────────────────────────────────────────
export const buttonStyles = StyleSheet.create({
  base: {
    borderRadius: radii['2xl'],
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['4'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryDark: {
    backgroundColor: colors.primaryDarker,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primaryBorderStrong,
  },
  small: {
    borderRadius: radii.md,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1.5'],
  },
  buttonText: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  buttonTextSmall: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});

// ─── Common Layout ───────────────────────────────────────────────────────────
export const layoutStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenDark: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing['6'],
  },
  dividerSoft: {
    height: 1,
    backgroundColor: colors.divider,
  },
});

// ─── Badge Styles ────────────────────────────────────────────────────────────
export const badgeStyles = StyleSheet.create({
  live: {
    backgroundColor: colors.successBackground,
    borderRadius: radii.sm,
    paddingHorizontal: spacing['1.5'],
    paddingVertical: 2,
  },
  liveText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.successDark,
    letterSpacing: 0.5,
  },
  ai: {
    backgroundColor: colors.aiBackground,
    borderRadius: radii.sm,
    paddingHorizontal: spacing['1.5'],
    paddingVertical: 2,
  },
  aiText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.ai,
    letterSpacing: 0.5,
  },
});

// Shadow helpers for native
export const nativeShadow = shadows.native;
