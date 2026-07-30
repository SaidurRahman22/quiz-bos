// Regenerate the PWA/Android app icons from pwa/icon.svg.
// Pure JS (no ImageMagick) via @resvg/resvg-js. Run from client/:  npm run icons
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const client = resolve(here, '..');
const svg = readFileSync(resolve(here, 'icon.svg'), 'utf8');
mkdirSync(resolve(client, 'public/pwa'), { recursive: true });

const targets = [
  ['icon-512.png', 512], // any + maskable
  ['icon-192.png', 192], // any
  ['apple-touch-icon.png', 180], // iOS home screen
];

for (const [name, size] of targets) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(resolve(client, 'public/pwa', name), png);
  console.log('✔ public/pwa/' + name);
}
