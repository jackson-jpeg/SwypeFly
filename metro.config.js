const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Re-enable .mjs resolution (needed for modern packages)
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// Also support .cjs for packages that provide CommonJS fallbacks
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Enable package exports for tree-shaking (reduces web bundle size)
// Use 'require' condition to avoid ESM files containing import.meta
// (import.meta is invalid in non-module scripts that Metro/Expo emit)
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = config;
