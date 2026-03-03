import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sogojet.app',
  appName: 'SoGoJet',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
