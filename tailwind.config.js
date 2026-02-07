/** @type {import('tailwindcss').Config} */
module.exports = {
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
        'app-bg': '#0A0A0A',
        'app-surface': '#1A1A1A',
        'app-text': {
          DEFAULT: '#FFFFFF',
          secondary: '#B0B0B0',
          muted: '#707070',
        },
      },
    },
  },
  plugins: [],
};
