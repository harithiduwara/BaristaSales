// AND-06: version.json for the in-app update check, published only from tagged releases.
import { writeFileSync } from 'node:fs';

const [out, version, versionCode, apkUrl] = process.argv.slice(2);
writeFileSync(
  out,
  `${JSON.stringify({ version, versionCode: Number(versionCode), apkUrl, releasedAt: new Date().toISOString() }, null, 2)}\n`,
);
console.log(`wrote ${out}`);
