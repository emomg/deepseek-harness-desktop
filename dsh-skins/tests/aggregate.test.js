// dsh-skins 聚合包测试
// 跑法：node dsh-skins/tests/aggregate.test.js
//
// 验证：
//  1. package.json 元数据
//  2. build/registry.json 与 6 款 skin.json 一致
//  3. build/index.js 6 款都 import + register
//  4. dsh-skins 是聚合：列全 6 款

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const pkgDir = path.resolve(__dirname, '..');
const buildDir = path.join(pkgDir, 'build');

// [1] 必备文件
for (const f of ['package.json', 'scripts/aggregate.mjs', 'build/registry.json', 'build/index.js']) {
  assert.ok(existsSync(path.join(pkgDir, f)), `missing ${f}`);
}
console.log('[1] required files present');

// [2] package.json 字段
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
assert.equal(pkg.name, '@dsh-desktop/skins-all');
assert.equal(pkg.type, 'module');
const EXPECTED_SKINS = [
  '@dsh-desktop/skin-bone-white',
  '@dsh-desktop/skin-graphite',
  '@dsh-desktop/skin-paper',
  '@dsh-desktop/skin-mist',
  '@dsh-desktop/skin-lilac',
  '@dsh-desktop/skin-mint',
];
for (const dep of EXPECTED_SKINS) {
  assert.ok(pkg.dependencies[dep], `must depend on ${dep}`);
  assert.equal(pkg.dependencies[dep], 'workspace:*', `${dep} must be workspace dep`);
}
console.log('[2] package.json OK');

// [3] build/registry.json：6 款全有 + id 与目录一致
const reg = JSON.parse(readFileSync(path.join(buildDir, 'registry.json'), 'utf8'));
assert.equal(reg.count, 6);
assert.equal(reg.skins.length, 6);
for (const s of reg.skins) {
  assert.ok(s.id, 'skin must have id');
  assert.ok(s.name && s.nameEn, 'skin must have name + nameEn');
  assert.ok(s.vars && s.vars['--dsh-bg-primary'], 'skin must have --dsh-bg-primary');
}
console.log('[3] build/registry.json has 6 valid skins');

// [4] build/index.js：6 款都 import + register
const indexSrc = readFileSync(path.join(buildDir, 'index.js'), 'utf8');
for (const dep of EXPECTED_SKINS) {
  assert.ok(indexSrc.includes(`from '${dep}/skin.json'`), `index.js must import ${dep}/skin.json`);
}
const registerCalls = (indexSrc.match(/register\(__skin\d+\)/g) || []).length;
assert.equal(registerCalls, 6, `index.js must call register() 6 times, got ${registerCalls}`);
console.log(`[4] build/index.js imports + registers all 6 skins`);

// [5] dsh-skins 没有把 skin-center 列在 dependencies（skin-center 是注册表，不是皮肤）
assert.ok(!pkg.dependencies['@dsh-desktop/skin-center'], 'must NOT depend on @dsh-desktop/skin-center');
console.log('[5] dsh-skins does not depend on skin-center (clean separation)');

// [6] 与 skins/ 目录实际存在的包数一致
const { readdirSync } = await import('node:fs');
const actualSkinDirs = readdirSync(path.join(repoRoot, 'skins'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'skin-center')
  .map((e) => e.name)
  .sort();
assert.equal(actualSkinDirs.length, 6, 'expected 6 skin dirs in skins/');
console.log(`[6] skins/ has 6 dirs: ${actualSkinDirs.join(', ')}`);

console.log('--- dsh-skins: all 6 tests passed');
