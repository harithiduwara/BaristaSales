// Bundles the backend into dist/Code.js for Apps Script (ADR-0006, C-03).
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const ENTRY_POINTS = ['doGet', 'doPost', 'onOpen', 'setup', 'setPinsPrompt', 'loadSeedData'];

mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'Backend',
  target: 'es2020',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  outfile: 'dist/Code.js',
  legalComments: 'none',
  minify: true,
  keepNames: true,
  logLevel: 'warning',
});
const stubs = ENTRY_POINTS.map((n) => `function ${n}() { return Backend.${n}.apply(this, arguments); }`).join(
  '\n',
);
writeFileSync('dist/Code.js', `${readFileSync('dist/Code.js', 'utf8')}\n${stubs}\n`);
copyFileSync('appsscript.json', 'dist/appsscript.json');
console.log(`dist/Code.js ${(readFileSync('dist/Code.js').length / 1024).toFixed(0)} KB`);
