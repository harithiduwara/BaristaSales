// AND-05: one version scheme for every build.
//   versionCode = run_number + 1000 (always increases)
//   versionName = X.Y.Z on a tag vX.Y.Z, otherwise X.Y.Z-dev.<run_number>+<short sha>
// Prints KEY=value lines; in GitHub Actions also appends them to $GITHUB_OUTPUT.
import { appendFileSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const run = Number(process.env.GITHUB_RUN_NUMBER ?? 0);
const ref = process.env.GITHUB_REF ?? '';
const sha = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
const tag = ref.startsWith('refs/tags/v') ? ref.slice('refs/tags/v'.length) : null;

if (tag && tag !== pkg.version) {
  console.error(
    `Tag v${tag} does not match package.json version ${pkg.version}. Bump the version before tagging.`,
  );
  process.exit(1);
}
const versionName = tag ?? `${pkg.version}-dev.${run}+${sha}`;
const out = { versionName, versionCode: String(run + 1000), isRelease: tag ? 'true' : 'false' };
const text = Object.entries(out)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n');
console.log(text);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${text}\n`);
