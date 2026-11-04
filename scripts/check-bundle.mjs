// NFR-PERF-02: initial JS ≤ 250 KB gzipped. Counts the scripts and module preloads index.html loads up front.
import { readFileSync, appendFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'apps/web/dist';
const LIMIT = 250 * 1024;
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
let total = 0;
for (const f of new Set(files)) total += gzipSync(readFileSync(join(dir, f))).length;
const kb = (total / 1024).toFixed(1);
console.log(`Initial JS (gzipped): ${kb} KB of 250 KB`);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| Initial JS (gzip) | ${kb} KB / 250 KB |\n`);
if (total > LIMIT) {
  console.error('Bundle budget exceeded (NFR-PERF-02).');
  process.exit(1);
}
