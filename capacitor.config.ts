import type { CapacitorConfig } from '@capacitor/cli';

// App Store Connect bundle identifier: JOMON pix only.
// This is a NEW identifier; it is not shared with みんやせ or かなたけ.
const config: CapacitorConfig = {
  appId: 'com.jomonpix.app',
  appName: 'JOMON pix',
  webDir: 'dist',
  // Load the built app from inside the bundle, not from GitHub Pages.
  // This preserves access to the local stickers and face-tracking WASM/model.
  server: {
    hostname: 'localhost',
    iosScheme: 'capacitor',
  },
};

export default config;
