// ─── Design Tokens ───────────────────────────────────────────────────────────
// Single source of truth for all visual constants in the app.

export const colors = {
  // Brand
  primary: '#38BDF8',         // sky-400
  primaryLight: '#7DD3FC',    // sky-300
  primaryDark: '#0284C7',     // sky-600
  primaryDarker: '#0EA5E9',   // sky-500

  // Backgrounds
  background: '#F8FAFC',      // slate-50
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9', // slate-100
  navy: '#0F172A',            // slate-900

  // Aliases
  secondary: '#0F172A',       // navy

  // Text
  text: {
    primary: '#1E293B',       // slate-800
    secondary: '#64748B',     // slate-500
    muted: '#94A3B8',         // slate-400
    dark: '#334155',          // slate-700
    body: '#475569',          // slate-600
  },

  // Card (dark background context)
  card: {
    background: '#0F172A',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.4)',
    textFaint: 'rgba(255,255,255,0.3)',
    textDot: 'rgba(255,255,255,0.15)',
    textTag: 'rgba(255,255,255,0.2)',
    priceTint: '#7DD3FC',     // sky-300
  },

  // Borders
  border: '#E2E8F0',         // slate-200
  borderLight: 'rgba(0,0,0,0.06)',
  borderSoft: '#CBD5E1',     // slate-300
  divider: '#F1F5F9',        // slate-100

  // Tab bar
  tabBar: {
    active: '#38BDF8',
    inactive: '#94A3B8',
    background: '#FFFFFF',
    border: '#E2E8F0',
  },

  // Overlays
  overlay: {
    light: 'rgba(15,23,42,0.3)',
    medium: 'rgba(15,23,42,0.5)',
    heavy: 'rgba(15,23,42,0.7)',
    modal: 'rgba(15,23,42,0.4)',
    card: 'rgba(0,0,0,0.4)',
    cardStrong: 'rgba(0,0,0,0.45)',
    glass: 'rgba(0,0,0,0.25)',
    white: 'rgba(255,255,255,0.08)',
    whiteMedium: 'rgba(255,255,255,0.1)',
    whiteStrong: 'rgba(255,255,255,0.85)',
    whiteTab: 'rgba(255,255,255,0.88)',
    whiteTabNative: 'rgba(255,255,255,0.92)',
  },

  // Semantic
  success: '#4ADE80',         // green-400
  successDark: '#22C55E',     // green-500
  error: '#EF4444',           // red-500
  warning: '#F59E0B',         // amber-500
  warningLight: '#FBBF24',    // amber-400
  info: '#818CF8',            // indigo-400

  // AI / special
  ai: '#818CF8',              // indigo-400
  aiBackground: 'rgba(129,140,248,0.1)',
  primaryTint: 'rgba(56,189,248,0.1)',
  primaryBorder: 'rgba(56,189,248,0.2)',
  primaryBorderStrong: 'rgba(56,189,248,0.3)',
  primaryBackground: 'rgba(56,189,248,0.06)',
  primaryActiveBackground: 'rgba(56,189,248,0.08)',
  primaryActiveBorder: 'rgba(56,189,248,0.18)',
  errorBorder: 'rgba(239,68,68,0.3)',
  successBackground: 'rgba(34,197,94,0.1)',

  // Skeleton / shimmer
  shimmer: 'rgba(255,255,255,0.06)',
  shimmerHighlight: 'rgba(255,255,255,0.08)',

  // Toggle
  toggleOff: '#CBD5E1',
} as const;

// ─── Spacing (4px-based scale) ───────────────────────────────────────────────
export const spacing = {
  '0': 0,
  '1': 4,
  '2': 8,
  '1.5': 6,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '14': 56,
  '15': 60,
  '20': 80,
  '24': 96,
  '25': 100,
  '30': 120,
} as const;

// ─── Border Radii ────────────────────────────────────────────────────────────
export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 20,
  full: 9999,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
export const fontSize = {
  '2xs': 9,
  xs: 10,
  sm: 11,
  md: 12,
  base: 13,
  lg: 14,
  xl: 15,
  '2xl': 16,
  '3xl': 18,
  '4xl': 20,
  '5xl': 24,
  '6xl': 28,
  '7xl': 32,
  '8xl': 36,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const lineHeight = {
  tight: 1,
  snug: 1.1,
  normal: 1.5,
  relaxed: 1.7,
  loose: 2,
  fixed18: 18,
  fixed22: 22,
  fixed24: 24,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const shadows = {
  web: {
    sm: '0 1px 2px rgba(0,0,0,0.04)',
    md: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    lg: '0 2px 8px rgba(0,0,0,0.08)',
    xl: '0 8px 24px rgba(0,0,0,0.08)',
    primary: '0 2px 8px rgba(56,189,248,0.3)',
    primaryDark: '0 2px 8px rgba(14,165,233,0.25)',
    toggle: '0 1px 3px rgba(0,0,0,0.1)',
  },
  native: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 8,
    },
  },
} as const;

// ─── Animation durations (ms) ────────────────────────────────────────────────
export const animation = {
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 400,
  heartBurstIn: 300,
  heartBurstOut: 400,
  shimmer: 2000,
  pulse: 2000,
  bounce: 1800,
  toastDuration: 3000,
} as const;

// ─── Layout constants ────────────────────────────────────────────────────────
export const layout = {
  maxContentWidth: 680,
  maxSettingsWidth: 600,
  maxGridWidth: 1200,
  tabBarHeightWeb: 64,
  tabBarHeightNative: 84,
  tabBarPaddingBottomWeb: 12,
  tabBarPaddingBottomNative: 28,
  tabBarPaddingTop: 10,
  cardPaddingHorizontal: 28,
  cardPaddingBottom: 84,
  cardPaddingBottomNative: 100,
  headerPaddingTop: 56,
  closeBtnSize: 40,
  actionBtnSize: 48,
  actionBtnGap: 14,
  badgeCountMin: 16,
  savedGridColumns: 2,
  savedGridGap: 12,
  stickyBarHeight: 72,
} as const;

// ─── Gradient stops for card overlay ─────────────────────────────────────────
export const gradientStops = {
  colors: [
    'transparent',
    'transparent',
    'rgba(15,23,42,0.08)',
    'rgba(15,23,42,0.30)',
    'rgba(15,23,42,0.55)',
    'rgba(15,23,42,0.78)',
    'rgba(15,23,42,0.90)',
    'rgba(15,23,42,0.96)',
    'rgba(15,23,42,0.98)',
  ],
  locations: [0, 0.30, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92, 1] as readonly number[],
} as const;
