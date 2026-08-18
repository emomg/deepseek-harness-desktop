// 皮肤中心注册表一致性（CI 门禁）
// 跑法：node scripts/skin-center-check.mjs
//
// 验证：所有 6 款皮肤都满足 skin-schema.js 的校验规则。

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 动态 import shared 的 schema validator
const sharedPath = resolve(ROOT, 'shared', 'skin-schema.js');
const sharedUrl = new URL('file:///' + sharedPath.replace(/\\/g, '/')).href;
const { validateRegistry } = await import(sharedUrl);

const SKIN_DIRS = readdirSync(join(ROOT, 'skins'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'skin-center')
  .map((e) => e.name)
  .sort();

const metas = SKIN_DIRS.map((id) => {
  const p = join(ROOT, 'skins', id, 'skin.json');
  return JSON.parse(readFileSync(p, 'utf8'));
});

const result = validateRegistry(metas);
if (!result.ok) {
  console.error('skin-center:check FAILED');
  for (const e of result.errors) console.error('  -', e);
  for (const d of result.duplicates) console.error('  - duplicate id:', d);
  process.exit(1);
}

console.log(`skin-center:check: ${metas.length} skins valid (no duplicates, all 18 tokens present)`);
