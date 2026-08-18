// dsh-skins 包的测试入口
// 跑法：node dsh-skins/tests/run-all.js

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const suites = [
  { name: 'dsh-skins/aggregate', file: 'dsh-skins/tests/aggregate.test.js' },
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
