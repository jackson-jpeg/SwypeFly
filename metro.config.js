const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Re-enable .mjs resolution (needed for @supabase/supabase-js and other modern packages)
// If .mjs is not already in sourceExts, add it
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// Also support .cjs for packages that provide CommonJS fallbacks
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Disable package exports resolution to avoid mjs/esm conflicts with Metro
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: './global.css' });
