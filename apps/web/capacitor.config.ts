import type { CapacitorConfig } from '@capacitor/cli';

// AND-01: the web build is bundled in the APK, so the app works offline from first launch.
const config: CapacitorConfig = {
  appId: 'lk.royalbliss.aluthgamadaily', // OQ-06
  appName: 'Aluthgama Daily',
  webDir: 'dist',
  android: {
    path: '../android',
    // Release builds never load from a dev server and never allow cleartext.
    allowMixedContent: false,
  },
};

export default config;
