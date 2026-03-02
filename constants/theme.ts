// ─── Design Tokens ───────────────────────────────────────────────────────────
// Single source of truth for all visual constants in the app.
// V4 Design System: Warm earth-tone palette with Syne + Inter typography.

export const colors = {
  // ─── Brand Palette ──────────────────────────────────────────────────────────
  duskSand: '#F5ECD7',         // background
  sunriseButter: '#F7E8A0',    // primary accent
  paleHorizon: '#FDEFC3',      // card surfaces
  seafoamMist: '#C8DDD4',      // selected/active states
  sageDrift: '#A8C4B8',        // deep selected, success, CTAs
  warmDusk: '#E8C9A0',         // secondary surfaces
  deepDusk: '#2C1F1A',         // text, primary buttons
  terracotta: '#D4734A',       // ERRORS ONLY — never use for non-error contexts

  // ─── Semantic Aliases ───────────────────────────────────────────────────────
  background: '#F5ECD7',       // duskSand
  accent: '#F7E8A0',           // sunriseButter
  surface: '#FDEFC3',          // paleHorizon
  surfaceElevated: '#FDEFC3',  // paleHorizon
  selected: '#C8DDD4',         // seafoamMist
  success: '#A8C4B8',          // sageDrift
  error: '#D4734A',            // terracotta — errors only
  warning: '#E8C9A0',          // warmDusk

  // Primary / secondary (button-centric aliases)
  primary: '#2C1F1A',          // deepDusk — primary buttons
  primaryLight: '#A8C4B8',     // sageDrift — lighter CTA
  primaryDark: '#1A120E',      // darker deepDusk
  secondary: '#A8C4B8',        // sageDrift

  // ─── Text ───────────────────────────────────────────────────────────────────
  text: {
    primary: '#2C1F1A',        // deepDusk
    secondary: '#5C4A3A',      // warm mid-brown
    muted: '#8A7A6A',          // warm gray
    dark: '#3D2E24',           // slightly lighter than deepDusk
    body: '#4A3B2E',           // warm brown for body text
  },

  // ─── Card (dark background context — photo overlay) ─────────────────────────
  card: {
    background: '#2C1F1A',     // deepDusk
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.7)',
    textMuted: 'rgba(255,255,255,0.5)',
    textFaint: 'rgba(255,255,255,0.3)',
    textDot: 'rgba(255,255,255,0.15)',
    textTag: 'rgba(255,255,255,0.25)',
    priceTint: '#F7E8A0',      // sunriseButter
  },

  // ─── Borders ────────────────────────────────────────────────────────────────
  border: '#D9CEB8',           // warm border
  borderLight: 'rgba(44,31,26,0.08)',
  borderSoft: '#C8B99A',       // slightly darker warm border
  divider: '#EDE4D0',          // subtle warm divider

  // ─── Tab Bar ────────────────────────────────────────────────────────────────
  tabBar: {
    active: '#A8C4B8',         // sageDrift
    inactive: '#8A7A6A',       // warm gray
    background: '#F5ECD7',     // duskSand
    border: '#D9CEB8',         // warm border
  },

  // ─── Overlays ───────────────────────────────────────────────────────────────
  overlay: {
    light: 'rgba(44,31,26,0.2)',
    medium: 'rgba(44,31,26,0.4)',
    heavy: 'rgba(44,31,26,0.6)',
    modal: 'rgba(44,31,26,0.4)',
    card: 'rgba(0,0,0,0.35)',
    cardStrong: 'rgba(0,0,0,0.45)',
    glass: 'rgba(245,236,215,0.7)',  // duskSand glass
    white: 'rgba(255,255,255,0.12)',
    whiteMedium: 'rgba(255,255,255,0.15)',
    whiteStrong: 'rgba(255,255,255,0.85)',
    whiteTab: 'rgba(245,236,215,0.88)',  // duskSand tint
    whiteTabNative: 'rgba(245,236,215,0.92)',
    warmDusk: 'rgba(232,201,160,0.6)',   // warmDusk 60% — onboarding overlay
  },

  // ─── Dark theme (destination detail, settings) ──────────────────────────────
  dark: {
    background: '#2C1F1A',     // deepDusk
    surface: '#3D2E24',        // warm dark surface
    surfaceElevated: '#4A3B2E',
    text: {
      primary: '#F5ECD7',      // duskSand
      secondary: '#C8B99A',    // warm light
      muted: '#8A7A6A',        // warm gray
      body: '#D9CEB8',         // warm light body
    },
    border: '#4A3B2E',
    borderLight: 'rgba(255,255,255,0.08)',
  },

  // ─── Semantic Status ────────────────────────────────────────────────────────
  successDark: '#8AB4A4',      // deeper sageDrift
  warningLight: '#F7E8A0',     // sunriseButter
  info: '#A8C4B8',             // sageDrift for info

  // ─── AI / Special ───────────────────────────────────────────────────────────
  ai: '#A8C4B8',               // sageDrift
  aiBackground: 'rgba(168,196,184,0.15)',

  // Tints (used for subtle backgrounds/borders referencing primary/accent)
  primaryTint: 'rgba(44,31,26,0.06)',
  primaryBorder: 'rgba(44,31,26,0.12)',
  primaryBorderStrong: 'rgba(44,31,26,0.2)',
  primaryBackground: 'rgba(44,31,26,0.04)',
  primaryActiveBackground: 'rgba(168,196,184,0.12)',
  primaryActiveBorder: 'rgba(168,196,184,0.25)',
  errorBorder: 'rgba(212,115,74,0.3)',
  successBackground: 'rgba(168,196,184,0.15)',

  // ─── Skeleton / shimmer ─────────────────────────────────────────────────────
  shimmer: 'rgba(44,31,26,0.04)',
  shimmerHighlight: 'rgba(44,31,26,0.08)',

  // ─── Toggle ─────────────────────────────────────────────────────────────────
  toggleOn: '#A8C4B8',         // sageDrift
  toggleOff: '#E8C9A0',        // warmDusk

  // ─── Navy (legacy alias — kept for gradient compatibility) ──────────────────
  navy: '#2C1F1A',             // mapped to deepDusk
} as const;

// ─── Fonts ──────────────────────────────────────────────────────────────────
export const fonts = {
  display: 'Syne',             // headlines, destination names, prices
  body: 'Inter',               // UI labels, body text, forms
} as const;

// ─── Spacing (8px base scale) ───────────────────────────────────────────────
export const spacing = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 16,
  '2xl': 16,
  '3xl': 24,
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

// ─── Text Style Presets ──────────────────────────────────────────────────────
// Composite text styles combining font family, size, weight.
export const textPresets = {
  display: {
    hero: {
      fontFamily: 'Syne_800ExtraBold',
      fontSize: 36,
      fontWeight: '800' as const,
      color: '#2C1F1A',
    },
    title: {
      fontFamily: 'Syne_700Bold',
      fontSize: 28,
      fontWeight: '700' as const,
      color: '#2C1F1A',
    },
    price: {
      fontFamily: 'Syne_600SemiBold',
      fontSize: 24,
      fontWeight: '600' as const,
      color: '#2C1F1A',
    },
  },
  body: {
    default: {
      fontFamily: 'Inter_400Regular',
      fontSize: 17,
      fontWeight: '400' as const,
      color: '#4A3B2E',
      lineHeight: 26,
    },
    caption: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      fontWeight: '400' as const,
      color: '#8A7A6A',
    },
    label: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      fontWeight: '500' as const,
      color: '#5C4A3A',
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      fontWeight: '600' as const,
      color: '#8A7A6A',
      textTransform: 'uppercase' as const,
      letterSpacing: 1.5,
    },
  },
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const shadows = {
  web: {
    sm: '0 1px 2px rgba(44,31,26,0.04)',
    md: '0 1px 3px rgba(44,31,26,0.06), 0 1px 2px rgba(44,31,26,0.04)',
    lg: '0 2px 8px rgba(44,31,26,0.08)',
    xl: '0 8px 24px rgba(44,31,26,0.08)',
    primary: '0 2px 8px rgba(44,31,26,0.15)',
    primaryDark: '0 2px 8px rgba(44,31,26,0.2)',
    toggle: '0 1px 3px rgba(44,31,26,0.1)',
  },
  native: {
    sm: {
      shadowColor: '#2C1F1A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#2C1F1A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#2C1F1A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    xl: {
      shadowColor: '#2C1F1A',
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
  cardPaddingBottom: 40,
  cardPaddingBottomNative: 100,
  headerPaddingTop: 56,
  closeBtnSize: 40,
  actionBtnSize: 48,
  actionBtnGap: 14,
  badgeCountMin: 16,
  savedGridColumns: 2,
  savedGridGap: 12,
  stickyBarHeight: 72,
  // V4 spacing rhythm
  elementGap: 16,       // gap between sibling elements
  sectionPadding: 24,   // padding within sections
  sectionGap: 40,       // gap between sections
} as const;

// ─── Gradient stops for card overlay ─────────────────────────────────────────
export const gradientStops = {
  colors: [
    'transparent',
    'transparent',
    'rgba(44,31,26,0.15)',
    'rgba(44,31,26,0.40)',
    'rgba(44,31,26,0.65)',
    'rgba(44,31,26,0.82)',
    'rgba(44,31,26,0.92)',
    'rgba(44,31,26,0.97)',
    'rgba(44,31,26,0.99)',
  ],
  locations: [0, 0.25, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88, 1] as readonly number[],
} as const;
