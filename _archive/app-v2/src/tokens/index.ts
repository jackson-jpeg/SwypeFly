import { useUIStore } from '@/stores/uiStore';

/* ── Raw palette (kept for backward compat during migration) ──────── */
export const colors = {
  duskSand: '#F5ECD7',
  sunriseButter: '#F7E8A0',
  paleHorizon: '#FDEFC3',
  seafoamMist: '#C8DDD4',
  sageDrift: '#A8C4B8',
  warmDusk: '#E8C9A0',
  deepDusk: '#2C1F1A',
  terracotta: '#D4734A',
  offWhite: '#FFFDF8',
  bodyText: '#5C4033',
  mutedText: '#8A7F72',
  specText: '#5C4F4A',
  borderTint: '#C9A99A',
  confirmGreen: '#7BAF8E',
  darkerGreen: '#4A8B7A',
} as const;

/* ── Semantic theme colors ────────────────────────────────────────── */
export const lightTheme = {
  canvas: '#FAFAF7',
  surface: '#F5F2EC',
  surfaceWhite: '#FFFFFF',
  primary: '#1A2F27',
  body: '#5C4033',
  muted: '#8B9D95',
  accent: '#3D8B6A',
  accentSoft: '#C8DDD4',
  border: '#E8E4DC',
  borderSubtle: 'rgba(0,0,0,0.04)',
  priceText: '#1A2F27',
  priceBadge: 'rgba(61,139,106,0.1)',
  priceBadgeText: '#3D8B6A',
  filterActive: '#C8DDD4',
  filterActiveText: '#1A2F27',
  filterInactive: 'rgba(0,0,0,0.04)',
  filterInactiveText: '#8B9D95',
  filterInactiveBorder: 'rgba(0,0,0,0.06)',
  filterBarBg: 'rgba(250,250,247,0.85)',
  filterBarBorder: 'rgba(0,0,0,0.04)',
  navBg: 'linear-gradient(to top, #FAFAF7 60%, transparent 100%)',
  navActive: '#3D8B6A',
  navInactive: '#8B9D95',
  heroGradient: 'linear-gradient(to bottom, transparent 40%, rgba(250,250,247,0.05) 58%, rgba(250,250,247,0.85) 78%, #FAFAF7 92%)',
  actionBtnBg: 'rgba(0,0,0,0.15)',
  ctaBg: '#1A2F27',
  ctaText: '#FAFAF7',
  dealCardBg: '#F2CEBC20',
  dealCardBorder: '#C9A99A30',
  strikethrough: '#C9A99A',
  quoteText: '#5C4033',
  labelText: '#8B9D95',
} as const;

export const darkTheme = {
  canvas: '#0A0F1E',
  surface: 'rgba(255,255,255,0.06)',
  surfaceWhite: 'rgba(255,255,255,0.08)',
  primary: '#FFFFFF',
  body: 'rgba(255,255,255,0.7)',
  muted: 'rgba(255,255,255,0.4)',
  accent: '#4ADE80',
  accentSoft: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.06)',
  borderSubtle: 'rgba(255,255,255,0.04)',
  priceText: '#F7E8A0',
  priceBadge: 'rgba(74,222,128,0.12)',
  priceBadgeText: '#4ADE80',
  filterActive: 'rgba(247,232,160,0.2)',
  filterActiveText: '#F7E8A0',
  filterInactive: 'rgba(255,255,255,0.08)',
  filterInactiveText: 'rgba(255,255,255,0.7)',
  filterInactiveBorder: 'rgba(255,255,255,0.1)',
  filterBarBg: 'rgba(10,15,30,0.8)',
  filterBarBorder: 'rgba(255,255,255,0.04)',
  navBg: 'linear-gradient(to top, #0A0F1E 60%, transparent 100%)',
  navActive: '#A8C4B8',
  navInactive: 'rgba(255,255,255,0.35)',
  heroGradient: 'linear-gradient(to bottom, transparent 40%, rgba(10,15,30,0.6) 65%, rgba(10,15,30,0.95) 82%, #0A0F1E 95%)',
  actionBtnBg: 'rgba(255,255,255,0.08)',
  ctaBg: '#FAFAF7',
  ctaText: '#1A2F27',
  dealCardBg: 'rgba(44,31,26,0.4)',
  dealCardBorder: 'rgba(255,255,255,0.08)',
  strikethrough: 'rgba(255,255,255,0.3)',
  quoteText: 'rgba(255,255,255,0.7)',
  labelText: 'rgba(255,255,255,0.4)',
} as const;

export type ThemeColors = { readonly [K in keyof typeof lightTheme]: string };

/** Returns semantic theme colors based on current uiStore.theme */
export function useThemeColors(): ThemeColors {
  const theme = useUIStore((s) => s.theme);
  if (theme === 'dark') return darkTheme;
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return darkTheme;
    }
  }
  return lightTheme;
}

/** Non-hook version for use outside React components */
export function getThemeColors(): ThemeColors {
  const theme = useUIStore.getState().theme;
  if (theme === 'dark') return darkTheme;
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return darkTheme;
    }
  }
  return lightTheme;
}

/* ── Fonts ────────────────────────────────────────────────────────── */
export const fonts = {
  display: 'Syne',
  body: 'Inter',
  accent: 'Playfair Display',
  mono: 'Bebas Neue',
} as const;

/* ── Typography (retuned) ─────────────────────────────────────────── */
export const typography = {
  display: { fontFamily: fonts.display, fontWeight: 800, fontSize: 32, lineHeight: '34px', letterSpacing: '-0.02em', textTransform: 'uppercase' as const },
  pageTitle: { fontFamily: fonts.display, fontWeight: 800, fontSize: 32, lineHeight: '34px', letterSpacing: '-0.02em', textTransform: 'uppercase' as const },
  headline: { fontFamily: fonts.display, fontWeight: 800, fontSize: 22, lineHeight: '24px', letterSpacing: '-0.01em', textTransform: 'uppercase' as const },
  sectionTitle: { fontFamily: fonts.body, fontWeight: 700, fontSize: 18, lineHeight: '22px' },
  subheadline: { fontFamily: fonts.display, fontWeight: 700, fontSize: 14, lineHeight: '18px' },
  body: { fontFamily: fonts.body, fontWeight: 400, fontSize: 16, lineHeight: '24px' },
  bodySmall: { fontFamily: fonts.body, fontWeight: 400, fontSize: 15, lineHeight: '24px' },
  secondary: { fontFamily: fonts.body, fontWeight: 500, fontSize: 13, lineHeight: '18px' },
  sectionLabel: { fontFamily: fonts.body, fontWeight: 600, fontSize: 10, lineHeight: '12px', letterSpacing: '0.12em', textTransform: 'uppercase' as const },
  smallLabel: { fontFamily: fonts.body, fontWeight: 600, fontSize: 9, lineHeight: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  quote: { fontFamily: fonts.accent, fontWeight: 400, fontSize: 20, lineHeight: '30px', fontStyle: 'italic' as const },
  button: { fontFamily: fonts.body, fontWeight: 600, fontSize: 16, lineHeight: '20px' },
  price: { fontFamily: fonts.body, fontWeight: 800, fontSize: 48, lineHeight: '48px', letterSpacing: '-0.03em' },
  priceMedium: { fontFamily: fonts.body, fontWeight: 800, fontSize: 28, lineHeight: '34px', letterSpacing: '-0.02em' },
} as const;

/* ── Spacing & Radius ─────────────────────────────────────────────── */
export const spacing = { xs: 8, sm: 16, md: 24, lg: 40, xl: 60 } as const;
export const radius = { sm: 8, md: 12, lg: 14, xl: 16, pill: 9999 } as const;

/* ── Surfaces (kept for backward compat) ──────────────────────────── */
export const surfaces = {
  page: { background: colors.duskSand },
  card: { background: colors.offWhite, border: '1px solid #C9A99A20', borderRadius: 16 },
  highlight: { background: colors.paleHorizon, border: '1px solid #E8C9A040', borderRadius: 16 },
  statusTint: { background: '#C8DDD430', border: '1px solid #C8DDD440', borderRadius: 14 },
  selected: { background: '#A8C4B830', border: '2px solid #A8C4B8', borderRadius: 14 },
  warmMid: { background: colors.warmDusk, border: '1px solid #C9A99A40', borderRadius: 12 },
  flightDeal: { background: '#F2CEBC33', border: '1px solid #C9A99A40', borderRadius: 16 },
  settingsRow: { background: colors.offWhite },
} as const;

/* ── Buttons (kept for backward compat) ───────────────────────────── */
export const buttons = {
  primary: { height: 52, borderRadius: 14, background: colors.deepDusk, color: colors.paleHorizon },
  primaryLarge: { height: 56, borderRadius: 16, background: colors.deepDusk, color: colors.paleHorizon },
  confirm: { height: 48, borderRadius: 14, background: 'transparent', border: '1.5px solid #7BAF8E', color: colors.confirmGreen },
  ai: { height: 44, borderRadius: 10, background: colors.confirmGreen, color: '#FFFFFF' },
  secondary: { height: 44, borderRadius: 12, background: 'transparent', border: '1.5px solid #C9A99A', color: colors.deepDusk },
  destructive: { height: 44, borderRadius: 12, background: colors.terracotta, color: '#FFFFFF' },
} as const;

/* ── Motion ────────────────────────────────────────────────────────── */
export const motion = {
  cardSwipe: { type: 'spring' as const, mass: 1, stiffness: 80, damping: 12, velocityThreshold: 800, decay: 0.997, triggerDistance: 120 },
  pricePill: { duration: 0.4, ease: 'easeOut' as const },
  seatSelect: { duration: 0.2, type: 'spring' as const, mass: 0.7, stiffness: 100, damping: 8 },
  saveHeart: { duration: 0.3, ease: [0.2, 1, 0.3, 1] as const },
  pageTransition: { duration: 0.35, ease: 'easeInOut' as const },
} as const;
