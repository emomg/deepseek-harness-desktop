// 安装包变体一致性门禁（CI gate）
// 跑法：node scripts/installer-variants.test.mjs
//
// 验证：
//   1. installer.nsi（精简 / full 共享）只装 dsh-files + dsh-plugin-image-input，
//      不装 dsh-pro
//   2. installer-pro.nsi（专业版）3 个插件都装
//   3. 插件目录实际存在
//
// 不通过 → CI 失败。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PLUGINS = [
  { id: 'dsh-pro', nameEn: 'dsh-pro' },
  { id: 'dsh-files', nameEn: 'dsh-files' },
  { id: 'dsh-plugin-image-input', nameEn: 'dsh-plugin-image-input' },
];

let fail = 0;
const fail_ = (m) => { console.error('  -', m); fail++; };

// [1] 实际插件目录存在
console.log('[1] 插件目录存在:');
for (const p of PLUGINS) {
  const dir = join(ROOT, 'plugins', p.id);
  if (!existsSync(dir)) fail_(`plugins/${p.id} 不存在`);
  else console.log(`  ok plugins/${p.id}`);
}

// [2] installer.nsi (lite/full) 只装 dsh-files + dsh-plugin-image-input
console.log('\n[2] installer.nsi (lite/full) 插件策略:');
const installerLite = readFileSync(join(ROOT, 'installer', 'installer.nsi'), 'utf8');
const LITE_ALLOWED = new Set(['dsh-files', 'dsh-plugin-image-input']);
for (const p of PLUGINS) {
  // 检查 /r 形式:  File /r "build\plugins\<id>"
  const re = new RegExp(`File\\s+/r\\s+"build\\\\plugins\\\\${p.id}"`, 'g');
  if (LITE_ALLOWED.has(p.id)) {
    if (!re.test(installerLite)) fail_(`installer.nsi 应装 plugins/${p.id} 但没找到 File /r 行`);
    else console.log(`  ok 装 ${p.id}`);
  } else {
    if (re.test(installerLite)) fail_((`installer.nsi 不应装 plugins/${p.id}（pro 专属）`));
    else console.log(`  ok 跳过 ${p.id}`);
  }
}
// 也不能用通配符 *.* 装所有（会破坏白名单）
if (/File\s+\/r\s+"build\\plugins\\\*\.\*"/.test(installerLite)) {
  fail_('installer.nsi 不该用 File /r "build\\plugins\\*.*" 通配符（会装 pro-plugin）');
} else {
  console.log('  ok 无通配符 *.*');
}

// [3] installer-pro.nsi (pro) 3 个插件都装
console.log('\n[3] installer-pro.nsi (pro) 插件策略:');
const installerPro = readFileSync(join(ROOT, 'installer', 'installer-pro.nsi'), 'utf8');
// pro 可以用通配符（因为 3 个都该装）或显式列举
const usesWildcard = /File\s+\/r\s+"build\\plugins\\\*\.\*"/.test(installerPro);
if (usesWildcard) {
  console.log('  ok 用通配符 *.*（3 个都装）');
} else {
  for (const p of PLUGINS) {
    const re = new RegExp(`File\\s+/r\\s+"build\\\\plugins\\\\${p.id}"`, 'g');
    if (!re.test(installerPro)) fail_((`installer-pro.nsi 应装 plugins/${p.id} 但没找到`));
    else console.log(`  ok 装 ${p.id}`);
  }
}

// [4] 一致性：build-installer.ps1 把 3 个插件都拷到 installer/build/plugins/，
//     由各 .nsi 自己挑（lite 挑 2 个，pro 3 个全挑）
console.log('\n[4] build-installer.ps1 把 3 个都拷到 build/plugins/:');
const buildPs1 = readFileSync(join(ROOT, 'scripts', 'build-installer.ps1'), 'utf8');
for (const p of PLUGINS) {
  const re = new RegExp(`plugins\\\\${p.id}`, 'g');
  if (!re.test(buildPs1)) fail_((`build-installer.ps1 拷 plugins/${p.id} 没找到`));
  else console.log(`  ok 拷 ${p.id}`);
}

if (fail > 0) {
  console.error(`\ninstaller-variants: ${fail} 处不一致`);
  process.exit(1);
} else {
  console.log('\ninstaller-variants: ALL OK');
}
