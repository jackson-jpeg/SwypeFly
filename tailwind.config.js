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
          DEFAULT: '#FF6B35',
          light: '#FF8F65',
          dark: '#E55A2B',
        },
        secondary: {
          DEFAULT: '#2196F3',
          light: '#64B5F6',
          dark: '#1976D2',
        },
        accent: '#FFD700',
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
