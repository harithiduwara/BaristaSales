// CI check (CICD-02 job 5): the bundle declares every entry point at the top level (C-03).
import { readFileSync } from 'node:fs';

const REQUIRED = [
  'doGet',
  'doPost',
  'onOpen',
  'setup',
  'setPinsPrompt',
  'loadSeedData',
  'setClaudeKeyPrompt',
];
const file = process.argv[2] ?? 'dist/Code.js';
const src = readFileSync(file, 'utf8');
const missing = REQUIRED.filter((n) => !new RegExp(`^function ${n}\\(`, 'm').test(src));
if (missing.length) {
  console.error(`Missing top-level functions in ${file}: ${missing.join(', ')}`);
  process.exit(1);
}
if (/\bimport\s*\(|^\s*(import|export)\s/m.test(src)) {
  console.error(`${file} still contains ES module syntax`);
  process.exit(1);
}
console.log(`OK: ${REQUIRED.join(', ')}`);
