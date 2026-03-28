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
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
