# 📱 PWA / Android app layer

This folder (plus a few clearly-marked files elsewhere) is the **entire mobile / installable-app layer**.
The **web app itself is untouched** — a PWA is the *same* React SPA, just made installable. Nothing here
changes how the site works in a normal browser.

## Where the PWA lives (and nothing else does)

| Path | What it is |
| --- | --- |
| `client/pwa/manifest.js` | The web-app manifest (name, icons, colors, `display: standalone`). |
| `client/pwa/icon.svg` | **Master icon** (pure vector). Edit this to change the app icon. |
| `client/pwa/generate-icons.mjs` | Rebuilds the PNG icons from `icon.svg`. Run with `npm run icons`. |
| `client/public/pwa/*.png` | **Generated** icons (`icon-192`, `icon-512`, `apple-touch-icon`). Committed; served at `/pwa/…`. |
| `client/src/pwa/PWAUpdatePrompt.jsx` | The only PWA-aware React component (offline-ready / update toast). |
| `client/src/pwa/pwa.css` | Styles for that toast only. |
| `client/vite.config.js` → `VitePWA({…})` block | Build-time wiring: generates the service worker + manifest. |
| `client/index.html` → PWA `<meta>`/`<link>` tags | `theme-color`, `apple-touch-icon`, iOS standalone hints. |

Everything **outside** this list — all of `client/src/pages`, `client/src/components`, `client/src/context`,
`api.js`, `styles.css` — is the **plain web app** and has zero knowledge of the service worker.

## How it works

- **Installable**: the manifest + a 192/512 icon + HTTPS (Vercel) make Chrome on Android offer *"Add to Home
  screen / Install app"*. It then opens full-screen with no browser bar (`display: standalone`).
- **Offline**: `vite-plugin-pwa` (Workbox) precaches the built app shell, so it launches with no network.
  Quiz/flashcard/topic API responses use a **NetworkFirst** cache, so decks you've opened before still work offline.
- **Updates**: `registerType: 'autoUpdate'` — a new deploy is picked up automatically; the toast lets the user
  reload immediately.

## Changing the icon

1. Edit `pwa/icon.svg`.
2. From `client/`, run `npm run icons` (regenerates `public/pwa/*.png` via `@resvg/resvg-js`).
3. Commit the updated PNGs.

## Testing it

The service worker is **disabled in `npm run dev`** (so it never fights HMR). To test the installable/offline
behaviour locally:

```bash
cd client
npm run build && npm run preview   # serves the production build with the SW active
```

Then open the preview URL in Chrome → DevTools ▸ Application ▸ Manifest / Service Workers, or use the
address-bar **Install** icon. On a phone, deploy to Vercel and open it in Chrome → menu ▸ *Install app*.
