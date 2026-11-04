import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const rootPkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

// One build for the PWA (GitHub Pages, sub-path) and the APK (Capacitor), hence relative paths.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VERSION_NAME ?? `${rootPkg.version}-local`),
  },
  build: { target: 'es2020', sourcemap: true, chunkSizeWarningLimit: 600 },
  server: { port: 5173, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Aluthgama Daily Report',
        short_name: 'Aluthgama Daily',
        description: 'Daily sales report for the Aluthgama outlet',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1D6A54',
        background_color: '#F4F7F5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        navigateFallback: 'index.html',
        // The API is never cached by the service worker; the app keeps its own IndexedDB cache.
        runtimeCaching: [],
      },
    }),
  ],
});
