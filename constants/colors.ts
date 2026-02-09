export const colors = {
  primary: '#38BDF8',         // sky-400
  primaryLight: '#7DD3FC',    // sky-300
  primaryDark: '#0284C7',     // sky-600
  secondary: '#0F172A',       // navy
  background: '#F8FAFC',      // slate-50
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9', // slate-100
  navy: '#0F172A',            // slate-900

  text: {
    primary: '#1E293B',       // slate-800
    secondary: '#64748B',     // slate-500
    muted: '#94A3B8',         // slate-400
  },

  card: {
    background: '#0F172A',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.4)',
    priceTint: '#7DD3FC',     // sky-300
  },

  border: '#E2E8F0',         // slate-200
  borderLight: 'rgba(0,0,0,0.06)',

  tabBar: {
    active: '#38BDF8',
    inactive: '#94A3B8',
    background: '#FFFFFF',
    border: '#E2E8F0',
  },

  overlay: {
    light: 'rgba(15,23,42,0.3)',
    medium: 'rgba(15,23,42,0.5)',
    heavy: 'rgba(15,23,42,0.7)',
  },

  success: '#4ADE80',
  error: '#EF4444',
  warning: '#F59E0B',
} as const;
