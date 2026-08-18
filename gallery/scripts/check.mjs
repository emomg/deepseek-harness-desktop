// gallery 一致性检查：registry.json 与 index.html 同步
// 跑法：node gallery/scripts/check.mjs

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const reg = JSON.parse(readFileSync(join(ROOT, 'dsh-skins', 'build', 'registry.json'), 'utf8'));
const indexPath = resolve(__dirname, '..', 'index.html');

if (!existsSync(indexPath)) {
  console.error('gallery/index.html missing; run `pnpm --filter @dsh-desktop/gallery build`');
  process.exit(1);
}
const html = readFileSync(indexPath, 'utf8');

let fail = 0;
for (const s of reg.skins) {
  if (!html.includes(`data-skin-id="${s.id}"`)) {
    console.error(`MISSING in gallery: ${s.id}`);
    fail++;
  }
  if (!html.includes(s.name)) {
    console.error(`MISSING name in gallery: ${s.id} -> ${s.name}`);
    fail++;
  }
  if (!html.includes(s.nameEn)) {
    console.error(`MISSING nameEn in gallery: ${s.id} -> ${s.nameEn}`);
    fail++;
  }
}

if (fail > 0) {
  console.error(`gallery: ${fail} missing skin reference(s)`);
  process.exit(1);
}
console.log(`gallery: all ${reg.skins.length} skins referenced in index.html`);
