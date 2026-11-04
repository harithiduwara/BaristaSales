// Renders public/icon.svg to the PNG icons the manifest and Android need (AND-02).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage();
async function render(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#1D6A54;display:grid;place-items:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg.replace('rx="112"', 'rx="0"')}</div></div>`
    : svg;
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}</body></html>`);
  await page.addStyleTag({ content: 'svg{width:100%;height:100%;display:block}' });
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await render(192, 'public/icon-192.png');
await render(512, 'public/icon-512.png');
await render(512, 'public/icon-maskable-512.png', { maskable: true });
await browser.close();
console.log('icons written');
