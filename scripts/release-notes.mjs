// Release notes from Conventional Commits since the previous tag (CICD-02 job 8).
import { execSync } from 'node:child_process';

const tag = process.argv[2];
const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();
let prev = '';
try {
  prev = sh(`git describe --tags --abbrev=0 ${tag}^`);
} catch {
  prev = '';
}
const range = prev ? `${prev}..${tag}` : tag;
const lines = sh(`git log ${range} --pretty=format:%s`).split('\n').filter(Boolean);
const groups = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance',
  docs: 'Documentation',
  test: 'Tests',
  chore: 'Maintenance',
};
const out = [`## ${tag}`, ''];
for (const [type, title] of Object.entries(groups)) {
  const items = lines
    .filter((l) => new RegExp(`^${type}(\\(.+\\))?!?:`).test(l))
    .map((l) => `- ${l.replace(/^\w+(\(.+\))?!?:\s*/, '')}`);
  if (items.length) out.push(`### ${title}`, ...items, '');
}
const other = lines.filter((l) => !/^\w+(\(.+\))?!?:/.test(l));
if (other.length) out.push('### Other', ...other.map((l) => `- ${l}`), '');
if (prev) out.push(`Changes since ${prev}.`);
console.log(out.join('\n'));
