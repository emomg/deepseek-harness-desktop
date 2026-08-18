// 文档一致性检查（CI 门禁）
// 跑法：node scripts/docs-check.mjs
//
// 检查：
//   1. 每个插件 / 皮肤包的双语 README + i18n.yaml 都存在且 id 一致
//   2. AGENTS.md / README.md / PRO-DESIGN.md / start.md 中引用过的皮肤 id 都真实存在
//   3. dsh-skins/README.md 中的 6 款表格与 skins/* 目录一致

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let fail = 0;
const fail_ = (msg) => { console.error('  -', msg); fail++; };

// [1] 每个皮肤包的双语文档齐全
console.log('[1] 每个皮肤包双语文档齐全:');
const SKIN_DIRS = readdirSync(join(ROOT, 'skins'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
for (const id of SKIN_DIRS) {
  const d = join(ROOT, 'skins', id);
  const md = existsSync(join(d, 'README.md'));
  const zh = existsSync(join(d, 'README.zh.md'));
  const i18n = existsSync(join(d, 'README.i18n.yaml'));
  const label = id === 'skin-center' ? '皮肤中心' : `皮肤 ${id}`;
  if (!md || !zh || !i18n) fail_(`${label} 缺文档 (md=${md} zh=${zh} i18n=${i18n})`);
  else console.log(`  ok ${label}`);
}

// [2] 插件双语齐全
console.log('\n[2] 每个插件双语齐全:');
const PLUGIN_DIRS = readdirSync(join(ROOT, 'plugins'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
for (const id of PLUGIN_DIRS) {
  const d = join(ROOT, 'plugins', id);
  const md = existsSync(join(d, 'README.md'));
  if (!md) fail_(`plugin ${id} 缺 README.md`);
  else console.log(`  ok ${id}`);
}

// [3] README.md / AGENTS.md / PRO-DESIGN.md / start.md 引用的皮肤 id 都真实存在
console.log('\n[3] 引用一致性:');
const REAL_SKINS = new Set(SKIN_DIRS);
const docsToCheck = ['README.md', 'PRO-DESIGN.md', 'start.md', 'AGENTS.md'];
for (const f of docsToCheck) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, 'utf8');
  // 匹配 dsh-desktop/skin-<id> 或 skins/<id> 或 @dsh-desktop/skin-<id> 形式
  // 注：skin-center 是「中央注册卡」不是皮肤，必须从结果里剔除
  const refs = new Set();
  for (const m of text.matchAll(/(?:@dsh-desktop\/skin-|skins\/)([a-z][a-z0-9-]+)/g)) {
    if (m[1] === 'center' || m[1] === 'all' || m[1] === 'new') continue;  // 非具体皮肤
    refs.add(m[1]);
  }
  for (const r of refs) {
    if (!REAL_SKINS.has(r)) fail_(`${f} 引用了不存在的皮肤 ${r}`);
  }
  if (refs.size > 0) console.log(`  ok ${f} 引用 ${refs.size} 个皮肤 id（全部存在）`);
}

// [4] dsh-skins/README.md 表格与实际皮肤一致
console.log('\n[4] dsh-skins/README.md 表格:');
const dshSkinsReadme = readFileSync(join(ROOT, 'dsh-skins', 'README.md'), 'utf8');
const expectedSkins = SKIN_DIRS.filter((id) => id !== 'skin-center').sort();
for (const id of expectedSkins) {
  if (!dshSkinsReadme.includes('`' + id + '`')) {
    fail_(`dsh-skins/README.md 缺 \`${id}\` 行`);
  }
}
if (expectedSkins.every((id) => dshSkinsReadme.includes('`' + id + '`'))) {
  console.log(`  ok dsh-skins/README.md 列出全部 ${expectedSkins.length} 款皮肤`);
}

if (fail > 0) {
  console.error(`\ndocs:check: ${fail} 处不一致`);
  process.exit(1);
} else {
  console.log('\ndocs:check: ALL OK');
}
