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

export const fonts = {
  display: 'Syne',
  body: 'Inter',
  accent: 'Playfair Display',
  mono: 'Bebas Neue',
} as const;

export const typography = {
  display: { fontFamily: fonts.display, fontWeight: 800, fontSize: 52, lineHeight: '52px', letterSpacing: '-0.02em', textTransform: 'uppercase' as const },
  pageTitle: { fontFamily: fonts.display, fontWeight: 800, fontSize: 34, lineHeight: '40px', letterSpacing: '-0.01em', textTransform: 'uppercase' as const },
  headline: { fontFamily: fonts.display, fontWeight: 800, fontSize: 22, lineHeight: '24px', letterSpacing: '-0.01em', textTransform: 'uppercase' as const },
  subheadline: { fontFamily: fonts.display, fontWeight: 700, fontSize: 14, lineHeight: '18px' },
  body: { fontFamily: fonts.body, fontWeight: 400, fontSize: 16, lineHeight: '24px' },
  bodySmall: { fontFamily: fonts.body, fontWeight: 400, fontSize: 15, lineHeight: '24px' },
  secondary: { fontFamily: fonts.body, fontWeight: 500, fontSize: 13, lineHeight: '18px' },
  sectionLabel: { fontFamily: fonts.body, fontWeight: 600, fontSize: 10, lineHeight: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  smallLabel: { fontFamily: fonts.body, fontWeight: 600, fontSize: 9, lineHeight: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  button: { fontFamily: fonts.body, fontWeight: 600, fontSize: 16, lineHeight: '20px' },
  price: { fontFamily: fonts.body, fontWeight: 800, fontSize: 48, lineHeight: '48px' },
  priceMedium: { fontFamily: fonts.body, fontWeight: 800, fontSize: 28, lineHeight: '34px' },
} as const;

export const spacing = { xs: 8, sm: 16, md: 24, lg: 40, xl: 60 } as const;
export const radius = { sm: 8, md: 12, lg: 14, xl: 16, pill: 9999 } as const;

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

export const buttons = {
  primary: { height: 52, borderRadius: 14, background: colors.deepDusk, color: colors.paleHorizon },
  primaryLarge: { height: 56, borderRadius: 16, background: colors.deepDusk, color: colors.paleHorizon },
  confirm: { height: 48, borderRadius: 14, background: 'transparent', border: '1.5px solid #7BAF8E', color: colors.confirmGreen },
  ai: { height: 44, borderRadius: 10, background: colors.confirmGreen, color: '#FFFFFF' },
  secondary: { height: 44, borderRadius: 12, background: 'transparent', border: '1.5px solid #C9A99A', color: colors.deepDusk },
  destructive: { height: 44, borderRadius: 12, background: colors.terracotta, color: '#FFFFFF' },
} as const;

export const motion = {
  cardSwipe: { type: 'spring' as const, mass: 1, stiffness: 80, damping: 12, velocityThreshold: 800, decay: 0.997, triggerDistance: 120 },
  pricePill: { duration: 0.4, ease: 'easeOut' as const },
  seatSelect: { duration: 0.2, type: 'spring' as const, mass: 0.7, stiffness: 100, damping: 8 },
  saveHeart: { duration: 0.3, ease: [0.2, 1, 0.3, 1] as const },
  pageTransition: { duration: 0.35, ease: 'easeInOut' as const },
} as const;
