// 全仓 pnpm test 通过此文件进入 skin-center 包的测试。
// 跑法：node skins/skin-center/tests/run-all.js

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..', '..');

const suites = [
  { name: 'skin-center/package', file: 'skins/skin-center/tests/package.test.js' },
  { name: 'skins-bulk (6 editorial skins)', file: 'skins/skin-center/tests/skins-bulk.test.js' },
];

let totalFail = 0;
for (const s of suites) {
  console.log('\n==>', s.name);
  const r = spawnSync(process.execPath, [path.join(root, s.file)], {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
  });
  if (r.status !== 0) {
    totalFail++;
    console.error(`FAIL: ${s.name} (exit ${r.status})`);
  }
}

if (totalFail > 0) {
  console.error(`\n${totalFail} suite(s) failed`);
  process.exit(1);
} else {
  console.log('\nALL TESTS PASSED');
}
