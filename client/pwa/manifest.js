// PWA (Add-to-Home-Screen / installable Android app) manifest.
// Consumed by vite.config.js via vite-plugin-pwa. Icons are generated from
// pwa/icon.svg into public/pwa/ (run `npm run icons`).
export const manifest = {
  id: '/',
  name: 'Quiz Boss — Quizzes & Flashcards',
  short_name: 'Quiz Boss',
  description: 'Bilingual quizzes and flashcards for nursing & general knowledge — study anywhere, even offline.',
  start_url: '/',
  scope: '/',
  display: 'standalone', // full-screen app window, no browser chrome
  orientation: 'portrait',
  background_color: '#0b1020', // splash-screen background
  theme_color: '#6366f1', // Android status bar / task switcher tint
  categories: ['education'],
  lang: 'en',
  icons: [
    { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
