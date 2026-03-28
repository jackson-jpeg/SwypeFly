export const colors = {
  // Backgrounds
  bg: '#0A0806',
  surface: '#0F0D0A',
  cell: '#1A1510',
  border: '#2A2218',
  highlight: '#F7E8A020',

  // Text
  yellow: '#F7E8A0',
  white: '#FFFFFFDD',
  whiteDim: '#FFFFFFB3',
  muted: '#C9A99A',
  faint: '#C9A99A80',

  // Semantic
  green: '#7BAF8E',
  orange: '#D4734A',

  // Deal tier badges
  dealAmazing: '#4ADE80',
  dealGreat: '#FBBF24',
  dealGood: '#60A5FA',

  // Sheet / overlays
  sheetBg: '#12100D',
  sheetHandle: '#2A2218',

  // Card overlays (swipe feed)
  cardGradient: [
    'transparent',
    'transparent',
    'rgba(10,8,6,0.3)',
    'rgba(10,8,6,0.85)',
  ] as const,
  cardGradientLocations: [0, 0.35, 0.55, 1.0] as const,
} as const;

export const fonts = {
  display: 'BebasNeue-Regular',
  body: 'Inter_400Regular',
  bodyBold: 'Inter_600SemiBold',
  accent: 'PlayfairDisplay_400Regular_Italic',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;

// App Store link — update the ID once the app is published on App Store Connect
export const APP_STORE_URL = 'https://apps.apple.com/app/sogojet/id6746076960';
