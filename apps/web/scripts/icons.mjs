// Renders public/icon.svg into every icon the PWA and the Android app need (AND-02: one source SVG).
// Usage: node scripts/icons.mjs   (set PW_CHROMIUM_PATH to use a pre-installed Chromium)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const strokes = svg.match(/<g[\s\S]*<\/g>/)[0];
const BRAND = '#1D6A54';
const RES = new URL('../../android/app/src/main/res/', import.meta.url).pathname;

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await browser.newPage();

async function render(size, file, html) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.screenshot({
    path: file,
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}
const full = (size) =>
  `<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`;
const round = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="256" fill="${BRAND}"/>${strokes}</svg>`;
// Adaptive foreground: artwork inside the 66/108 safe zone, transparent around it.
const foreground = (size) =>
  `<svg width="${size}" height="${size}" viewBox="-140 -140 792 792" xmlns="http://www.w3.org/2000/svg">${strokes}</svg>`;
const maskable = (size) =>
  `<svg width="${size}" height="${size}" viewBox="-64 -64 640 640" xmlns="http://www.w3.org/2000/svg"><rect x="-64" y="-64" width="640" height="640" fill="${BRAND}"/>${strokes}</svg>`;

await render(192, 'public/icon-192.png', full(192));
await render(512, 'public/icon-512.png', full(512));
await render(512, 'public/icon-maskable-512.png', maskable(512));

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, scale] of Object.entries(densities)) {
  const dir = `${RES}mipmap-${d}`;
  mkdirSync(dir, { recursive: true });
  await render(48 * scale, `${dir}/ic_launcher.png`, full(48 * scale));
  await render(48 * scale, `${dir}/ic_launcher_round.png`, round(48 * scale));
  await render(108 * scale, `${dir}/ic_launcher_foreground.png`, foreground(108 * scale));
}
await browser.close();
console.log('icons written');
