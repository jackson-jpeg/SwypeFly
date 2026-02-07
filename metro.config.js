const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Prevent Metro from resolving .mjs files (which use import.meta.env in zustand)
// Force CJS resolution for compatibility
config.resolver.sourceExts = config.resolver.sourceExts.filter(
  (ext) => ext !== 'mjs'
);

module.exports = withNativeWind(config, { input: './global.css' });
