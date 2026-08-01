import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { manifest } from './pwa/manifest.js';

// The web app is the React SPA. The VitePWA block below is the ONLY build-time PWA
// wiring — it generates the service worker + web manifest. Everything else PWA-related
// lives under client/pwa/ and client/src/pwa/ (see pwa/README.md).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Quiz/flashcard/topic content: serve from network, fall back to cache so
            // decks you've already opened keep working offline. Matched by PATHNAME (via a
            // callback) so it also caches the cross-origin production API (Railway) — a bare
            // RegExp only matches same-origin requests, which is why offline was failing.
            urlPattern: ({ url }) => /^\/api\/(topics|quizzes|flashcards)(\/|$)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'qb-api-content',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false }, // no service worker during `npm run dev`
    }),
  ],
  // Proxy /api to the Express backend during development.
  server: {
    host: true, // listen on 0.0.0.0 so phones/other devices on the same LAN can connect
    port: 5173,
    strictPort: true, // always use 5173 (fail loudly instead of drifting to a new port)
    proxy: {
      '/api': {
        // Runs on the PC (not the phone), so it can still reach the API on localhost.
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
