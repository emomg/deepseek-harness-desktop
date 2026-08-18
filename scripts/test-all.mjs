// 全仓测试入口
// 跑法：node scripts/test-all.mjs
// 或：  pnpm test

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SUITES = [
  { name: 'shared',                file: 'shared/tests/run-all.js' },
  { name: 'dsh-pro',               file: 'plugins/dsh-pro/test/run-all.js' },
  // dsh-files 的 parse.test.js 需要 mammoth/pdfjs-dist/jszip 等 npm 依赖。
  // 本机内网跑 npm install 不通（参考根 AGENTS.md 环境说明），故在 test-all 里只跑
  // core.test.js（无依赖），parse.test.js 留给装机后 / CI 跑。
  { name: 'dsh-files (core only)', file: 'plugins/dsh-files/test/run-all.js', skipOnMissingDeps: true },
  { name: 'dsh-plugin-image-input', file: 'plugins/dsh-plugin-image-input/test/run-all.js' },
  { name: 'skin-center + 6 skins', file: 'skins/skin-center/tests/run-all.js' },
  { name: 'dsh-skins',             file: 'dsh-skins/tests/run-all.js' },
  { name: 'installer-variants',    file: 'scripts/installer-variants.test.mjs' },
];

let totalFail = 0;
for (const s of SUITES) {
  console.log('\n========================================');
  console.log(`==> ${s.name}`);
  console.log('========================================');
  // skipOnMissingDeps 模式：检查 node_modules 是否齐；不齐则跳过整 suite
  if (s.skipOnMissingDeps) {
    const nm = resolve(ROOT, 'plugins/dsh-files', 'node_modules');
    if (!existsSync(nm)) {
      console.log(`  [skip] ${s.name} —— node_modules 未安装（网络受限），跳过`);
      continue;
    }
  }
  const r = spawnSync(process.execPath, [resolve(ROOT, s.file)], {
    stdio: 'inherit', cwd: ROOT, env: process.env,
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
  console.log('\n========================================');
  console.log('ALL SUITES PASSED');
  console.log('========================================');
}
