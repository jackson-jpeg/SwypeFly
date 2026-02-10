/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#38BDF8',   // sky-400
          light: '#7DD3FC',     // sky-300
          dark: '#0284C7',      // sky-600
        },
        secondary: {
          DEFAULT: '#0F172A',   // slate-900
          light: '#1E293B',     // slate-800
        },
        'app-bg': '#F8FAFC',
        'app-surface': '#FFFFFF',
        'app-text': {
          DEFAULT: '#1E293B',
          secondary: '#64748B',
          muted: '#94A3B8',
        },
      },
    },
  },
  plugins: [],
};
