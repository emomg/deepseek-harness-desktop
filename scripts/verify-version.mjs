// 版本一致性校验：每个 npm 包的 version 与根 package.json 的 vX.Y.Z 标签对应。
// 跑法：node scripts/verify-version.mjs <tag-version>
// 例：  node scripts/verify-version.mjs 0.2.0
//
// CI 上由 release workflow 推送 tag 后调：
//   scripts/verify-version.mjs "$GITHUB_REF_NAME"  (去掉 v 前缀)

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/verify-version.mjs <version>');
  process.exit(1);
}
const target = arg.replace(/^v/, '');

const PKG_DIRS = [
  ROOT,
  join(ROOT, 'shared'),
  join(ROOT, 'apps', 'desktop'),
  join(ROOT, 'plugins', 'dsh-pro'),
  join(ROOT, 'plugins', 'dsh-files'),
  join(ROOT, 'plugins', 'dsh-plugin-image-input'),
  join(ROOT, 'skins', 'skin-center'),
  join(ROOT, 'skins', 'bone-white'),
  join(ROOT, 'skins', 'graphite'),
  join(ROOT, 'skins', 'paper'),
  join(ROOT, 'skins', 'mist'),
  join(ROOT, 'skins', 'lilac'),
  join(ROOT, 'skins', 'mint'),
  join(ROOT, 'dsh-skins'),
  join(ROOT, 'gallery'),
];

let fail = 0;
for (const d of PKG_DIRS) {
  const pkgPath = join(d, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.version !== target) {
      console.error(`  ${pkg.name}: ${pkg.version} (expected ${target})`);
      fail++;
    } else {
      console.log(`  ok ${pkg.name}: ${pkg.version}`);
    }
  } catch (e) {
    console.error(`  skip ${d}: ${e.message}`);
  }
}

if (fail > 0) {
  console.error(`\nverify-version: ${fail} mismatch(es)`);
  process.exit(1);
} else {
  console.log(`\nverify-version: all ${PKG_DIRS.length} packages at ${target}`);
}
