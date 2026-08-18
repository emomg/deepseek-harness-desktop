// 全仓 JS 语法检查（不用 TS，所以是 syntax check）。
// 跑法：node scripts/typecheck.mjs
// 覆盖：所有 lib/*.js（cordis 插件 + 共享层 + 皮肤包）。

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TARGETS = [
  'shared',
  'skins',
  'plugins',
  'dsh-skins',
  'apps/desktop',
];

function* walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    if (ent.name === 'target' || ent.name === 'dist' || ent.name === 'build') continue;
    if (ent.name === 'vendor') continue;  // Tauri 嵌入的 Rust crate 源码 + JS fixtures
    if (ent.name === 'gen') continue;      // Tauri 生成的 schema
    if (ent.name === 'icons') continue;    // 图标二进制
    const p = join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && (ent.name.endsWith('.js') || ent.name.endsWith('.mjs'))) yield p;
  }
}

const files = [];
for (const t of TARGETS) {
  const abs = join(ROOT, t);
  if (!existsSync(abs)) continue;
  for (const f of walk(abs)) files.push(f);
}

let fail = 0;
for (const f of files) {
  try {
    // --check 走语法检查，输出 silent
    execFileSync(process.execPath, ['--check', f], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    console.error('SYNTAX ERROR:', f.replace(ROOT + '\\', ''));
    console.error('  ', e.stderr ? e.stderr.toString().split('\n')[0] : e.message);
    fail++;
  }
}

if (fail > 0) {
  console.error(`\ntypecheck: ${fail} file(s) failed`);
  process.exit(1);
} else {
  console.log(`typecheck: ${files.length} file(s) OK`);
}
