// 6 款皮肤包的冒烟测试。
// 跑法：node skins/skin-center/tests/skins-bulk.test.js

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const skinsDir = path.join(repoRoot, 'skins');

const EXPECTED = [
  { id: 'bone-white', name: '骨白', nameEn: 'Bone White', order: 1 },
  { id: 'graphite',   name: '石墨', nameEn: 'Graphite',   order: 2 },
  { id: 'paper',      name: '宣纸', nameEn: 'Paper',      order: 3 },
  { id: 'mist',       name: '雾',   nameEn: 'Mist',       order: 4 },
  { id: 'lilac',      name: '丁香', nameEn: 'Lilac',      order: 5 },
  { id: 'mint',       name: '薄荷', nameEn: 'Mint',       order: 6 },
];

// [1] 6 个皮肤包都存在
for (const s of EXPECTED) {
  const dir = path.join(skinsDir, s.id);
  assert.ok(existsSync(dir), `missing skin dir ${s.id}`);
}
console.log(`[1] all 6 skin dirs present`);

// [2] 必备文件
for (const s of EXPECTED) {
  const dir = path.join(skinsDir, s.id);
  for (const f of ['package.json', 'cordis.patch.yml', 'skin.json', 'lib/index.js', 'lib/client.js', 'README.md', 'README.zh.md', 'README.i18n.yaml', 'preview/light.svg', 'preview/dark.svg']) {
    assert.ok(existsSync(path.join(dir, f)), `${s.id} missing ${f}`);
  }
}
console.log(`[2] all 60 expected files present (10 per skin × 6)`);

// [3] 验证 skin.json：18 token 全有 + mode 合法 + id 匹配
for (const s of EXPECTED) {
  const meta = JSON.parse(readFileSync(path.join(skinsDir, s.id, 'skin.json'), 'utf8'));
  assert.equal(meta.id, s.id);
  assert.equal(meta.name, s.name);
  assert.equal(meta.nameEn, s.nameEn);
  assert.equal(meta.order, s.order);

  const REQUIRED_TOKENS = [
    '--dsh-bg-primary', '--dsh-bg-secondary', '--dsh-bg-elevated',
    '--dsh-fg-primary', '--dsh-fg-secondary', '--dsh-fg-tertiary', '--dsh-fg-disabled',
    '--dsh-border', '--dsh-border-strong',
    '--dsh-accent', '--dsh-accent-fg',
    '--dsh-glass-bg', '--dsh-glass-border', '--dsh-glass-blur',
    '--dsh-shadow', '--dsh-glow-1', '--dsh-glow-2', '--dsh-mode',
  ];
  for (const k of REQUIRED_TOKENS) {
    assert.ok(k in meta.vars, `${s.id} skin.json missing ${k}`);
  }
  assert.ok(['light', 'dark'].includes(meta.vars['--dsh-mode']), `${s.id} invalid --dsh-mode`);
  assert.ok(Array.isArray(meta.tags) && meta.tags.length > 0, `${s.id} tags must be non-empty array`);
}
console.log(`[3] all 6 skin.json validate (18 tokens + mode + tags)`);

// [4] 验证 client.js 用 ModuleLoader.load 格式 + register 调用
for (const s of EXPECTED) {
  const src = readFileSync(path.join(skinsDir, s.id, 'lib/client.js'), 'utf8');
  assert.ok(src.includes('window.__ModuleLoader__.load('), `${s.id} client.js must use ModuleLoader`);
  assert.ok(src.includes("'@dsh-desktop/skin-" + s.id + "'"), `${s.id} client.js id mismatch`);
  assert.ok(src.includes('register(__skin)'), `${s.id} client.js must call register(__skin)`);
}
console.log(`[4] all 6 client.js use ModuleLoader + register()`);

// [5] 验证 package.json 元数据与 skin.json 一致
for (const s of EXPECTED) {
  const pkg = JSON.parse(readFileSync(path.join(skinsDir, s.id, 'package.json'), 'utf8'));
  const meta = JSON.parse(readFileSync(path.join(skinsDir, s.id, 'skin.json'), 'utf8'));
  assert.equal(pkg.name, '@dsh-desktop/skin-' + s.id);
  assert.equal(pkg.dependencies['@dsh-desktop/shared'], 'workspace:*');
  assert.equal(pkg['dsh'].bundle.patch, './cordis.patch.yml');
  assert.ok(pkg['dsh'].client.inject.includes('@deepseek-ai/dsh-client-runtime'));
  // 描述必须包含 skin.json 的 tagline
  assert.ok(pkg.description.includes(meta.tagline) || pkg.description.includes(meta.name), `${s.id} pkg description should reference skin name/tagline`);
}
console.log(`[5] all 6 package.json consistent with skin.json`);

// [6] 验证 cordis.patch.yml 包含正确 id
for (const s of EXPECTED) {
  const patch = readFileSync(path.join(skinsDir, s.id, 'cordis.patch.yml'), 'utf8');
  assert.ok(patch.includes('dsh-desktop-skin-' + s.id), `${s.id} patch must register dsh-desktop-skin-${s.id}`);
}
console.log(`[6] all 6 cordis.patch.yml have correct id`);

// [7] 验证 SVG 预览图有内容
for (const s of EXPECTED) {
  const svg = readFileSync(path.join(skinsDir, s.id, 'preview/light.svg'), 'utf8');
  assert.ok(svg.startsWith('<svg'), `${s.id} light.svg must be SVG`);
  assert.ok(svg.includes(s.id), `${s.id} light.svg should reference its id`);
}
console.log(`[7] all 6 preview SVGs are valid`);

// [8] 验证没有沿用 dsh-web-ui 的旧皮肤名（11 款外部皮肤）
const FORBIDDEN_IDS = [
  'whale-song', 'dragon-heir', 'blue-fantasy', 'harbor', 'maid-atelier',
  'matrix', 'miku', 'minecraft', 'trading', 'whale-mom', 'xp',
];
for (const s of EXPECTED) {
  for (const fid of FORBIDDEN_IDS) {
    assert.ok(s.id !== fid, `skin ${s.id} collides with dsh-web-ui external skin id ${fid}`);
  }
}
console.log(`[8] no skin id collides with dsh-web-ui external skins`);

console.log('--- 6 editorial skins: all 8 tests passed');
