// @dsh-desktop/skin-center 包冒烟测试
// 跑法：node skins/skin-center/tests/package.test.js
// 验证包结构 / 必备文件 / 不残留旧硬编码皮肤

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgDir, '..', '..');

// [1] 必备文件
for (const f of ['package.json', 'cordis.patch.yml', 'README.md', 'README.zh.md', 'lib/index.js', 'lib/client.js']) {
  assert.ok(existsSync(path.join(pkgDir, f)), `missing ${f}`);
}
console.log('[1] required files present');

// [2] package.json 关键字段
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
assert.equal(pkg.name, '@dsh-desktop/skin-center');
assert.equal(pkg.type, 'module');
assert.ok(pkg['dsh'] && pkg['dsh'].bundle && pkg['dsh'].bundle.patch === './cordis.patch.yml');
assert.ok(pkg.dependencies && pkg.dependencies['@dsh-desktop/shared'], 'must depend on @dsh-desktop/shared');
console.log('[2] package.json OK');

// [3] cordis.patch.yml 含必要字段
const patch = readFileSync(path.join(pkgDir, 'cordis.patch.yml'), 'utf8');
assert.ok(patch.includes('insert:'), 'patch must have insert:');
assert.ok(patch.includes('dsh-desktop-skin-center'), 'patch must register dsh-desktop-skin-center id');
console.log('[3] cordis.patch.yml OK');

// [4] lib/client.js 必须用 ModuleLoader.load 格式
const clientSrc = readFileSync(path.join(pkgDir, 'lib/client.js'), 'utf8');
assert.ok(clientSrc.includes('window.__ModuleLoader__.load('), 'client.js must use window.__ModuleLoader__');
assert.ok(clientSrc.includes("'@dsh-desktop/skin-center'"), 'client.js id must be @dsh-desktop/skin-center');
console.log('[4] client.js uses ModuleLoader format');

// [5] lib/client.js 不能有旧硬编码皮肤 id（黑鲸/深空/...）
const OLD_SKIN_IDS = [
  'black-whale', 'deep-space', 'liquid-glass', 'aurora', 'cyber',
  'midnight', 'jade', 'dawn', 'mint', 'sakura', 'pure-white',
];
for (const id of OLD_SKIN_IDS) {
  assert.ok(!clientSrc.includes(id), `client.js must not contain legacy skin id "${id}"`);
}
console.log('[5] client.js free of legacy 11-skin ids');

// [6] lib/client.js 必须用新 --dsh-* 标记（不依赖 --dsw-alias-*）
assert.ok(clientSrc.includes('--dsh-bg-primary'), 'client.js must use new --dsh-* tokens');
assert.ok(clientSrc.includes('list: listSkins'), 'client.js must read registry via listSkins');
console.log('[6] client.js uses new token system + shared registry');

// [7] lib/index.js 是 host 端 stub
const indexSrc = readFileSync(path.join(pkgDir, 'lib/index.js'), 'utf8');
assert.ok(indexSrc.includes("export const name = 'dsh-desktop-skin-center'"), 'index.js must export name');
assert.ok(Array.isArray(JSON.parse('[' + indexSrc.match(/inject = \[(.*?)\]/s)[1].split(',').map(s => JSON.stringify(s.trim())).join(',') + ']')), 'inject must be array');
console.log('[7] lib/index.js host stub OK');

// [8] dsh-pro 真的剥除了 11 款硬编码
const proClient = readFileSync(path.join(repoRoot, 'plugins/dsh-pro/lib/client.js'), 'utf8');
for (const id of OLD_SKIN_IDS) {
  assert.ok(!proClient.includes(id), `dsh-pro/client.js must not contain legacy skin id "${id}"`);
}
assert.ok(!proClient.includes('SkinCenterSection'), 'dsh-pro must not reference SkinCenterSection anymore');
console.log('[8] dsh-pro/lib/client.js fully stripped of skin center');

console.log('--- skin-center: all 8 tests passed');
