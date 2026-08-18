// 新皮肤脚手架：交互式建一个 @dsh-desktop/skin-<id> 包
// 跑法：pnpm skin:new <id> [--name <zh>] [--nameEn <en>] [--order N]
//
// 流程：
//   1. 校验 id（kebab-case ascii，未与现有 6 款冲突）
//   2. 用默认 token 起骨架（编辑后填实际值）
//   3. 写 package.json / cordis.patch.yml / skin.json / lib/{index,client}.js / README / preview SVG
//   4. 跑 aggregate.mjs 把新皮肤加进 dsh-skins 聚合

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('--')) {
  console.error('usage: pnpm skin:new <id> [--name <zh>] [--nameEn <en>] [--order N]');
  console.error('example: pnpm skin:new obsidian --name 墨石 --nameEn Obsidian --order 7');
  process.exit(1);
}

const id = args[0];
if (!/^[a-z][a-z0-9-]{1,32}$/.test(id)) {
  console.error(`error: id must be kebab-case ascii, 2-33 chars (got: ${id})`);
  process.exit(1);
}
const flag = (n, def) => {
  const i = args.indexOf(n);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const name = flag('--name', id);
const nameEn = flag('--nameEn', id);
const order = parseInt(flag('--order', '99'), 10);
const tagline = flag('--tagline', '极简 editorial 原创皮肤');
const description = flag('--description', '一款原创的 dsh-desktop 极简 editorial 皮肤。');

const target = join(ROOT, 'skins', id);
if (existsSync(target)) {
  console.error(`error: skins/${id} already exists`);
  process.exit(1);
}
if (existsSync(join(ROOT, 'skins', 'skin-center', id))) {
  console.error(`error: ${id} collides with skin-center`);
  process.exit(1);
}

const TOKEN_KEYS = [
  '--dsh-bg-primary', '--dsh-bg-secondary', '--dsh-bg-elevated',
  '--dsh-fg-primary', '--dsh-fg-secondary', '--dsh-fg-tertiary', '--dsh-fg-disabled',
  '--dsh-border', '--dsh-border-strong',
  '--dsh-accent', '--dsh-accent-fg',
  '--dsh-glass-bg', '--dsh-glass-border', '--dsh-glass-blur',
  '--dsh-shadow', '--dsh-glow-1', '--dsh-glow-2', '--dsh-mode',
];
const DEFAULT_VARS = JSON.parse(readFileSync(join(ROOT, 'shared', 'css-tokens.js'), 'utf8')
  .match(/DEFAULT_VARS[\s\S]+?\}\)/)[0]
  .replace('DEFAULT_VARS = Object.freeze(', '')
  .replace(/\)\s*$/, '')
  .replace(/(\w+):/g, '"$1":')
  .replace(/'/g, '"')
  .replace(/,(\s*})/g, '$1')
);

mkdirSync(join(target, 'lib'), { recursive: true });
mkdirSync(join(target, 'preview'), { recursive: true });

// package.json
writeFileSync(join(target, 'package.json'), JSON.stringify({
  name: '@dsh-desktop/skin-' + id,
  version: '0.1.0',
  description: `${name} · 极简 editorial 皮肤：${tagline}。`,
  type: 'module',
  main: 'lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './skin.json': './skin.json',
    './package.json': './package.json',
  },
  files: [
    'lib', 'skin.json', 'cordis.patch.yml', 'preview',
    'README.md', 'README.zh.md', 'README.i18n.yaml',
  ],
  license: 'MIT',
  dsh: {
    bundle: { patch: './cordis.patch.yml' },
    client: { inject: ['@deepseek-ai/dsh-client-runtime'], platform: 'web' },
  },
  dependencies: { '@dsh-desktop/shared': 'workspace:*' },
}, null, 2) + '\n', 'utf8');

// cordis.patch.yml
writeFileSync(join(target, 'cordis.patch.yml'), `# @dsh-desktop/skin-${id}：${name}（${nameEn}）—— 极简 editorial 原创皮肤

- insert:
    - id: dsh-desktop-skin-${id}
      name: '@dsh-desktop/skin-${id}'
      config: {}
`, 'utf8');

// lib/index.js
writeFileSync(join(target, 'lib/index.js'), `// @dsh-desktop/skin-${id} · 宿主端 stub
// 纯浏览器端插件：唯一动作是 register(skin) 到共享注册表。

export const name = 'dsh-desktop-skin-${id}';
export const inject = [];
export function apply(_ctx) { /* no-op */ }
`, 'utf8');

// skin.json
const skin = {
  id, name, nameEn, tagline, description,
  tags: ['light', 'minimal', 'editorial'],
  order,
  vars: { ...DEFAULT_VARS },
};
writeFileSync(join(target, 'skin.json'), JSON.stringify(skin, null, 2) + '\n', 'utf8');

// lib/client.js
writeFileSync(join(target, 'lib/client.js'), `// @dsh-desktop/skin-${id} · 浏览器端
// 唯一动作：register() 把 ${name} 元数据塞进共享注册表。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-${id}',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __copyProps = (to, from, except, desc) => {
      if (from && (typeof from === 'object' || typeof from === 'function')) {
        for (var keys = __getOwnPropNames(from), i = 0, n = keys.length; i < n; i++) {
          var key = keys[i];
          if (!__hasOwnProp.call(to, key) && key !== except) {
            __defProp(to, key, { get: ((k) => from[k]).bind(null, key), enumerable: !(desc = Object.getOwnPropertyDescriptor(from, key)) || desc.enumerable });
          }
        }
      }
      return to;
    };
    var __getProtoOf = Object.getPrototypeOf;
    var __toESM = (mod, isNodeMode, target) => (
      (target = mod != null ? __create(__getProtoOf(mod)) : {}),
      __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, 'default', { value: mod, enumerable: true }) : target, mod)
    );

    var shared = require('@dsh-desktop/shared');
    shared = __toESM(shared, 1);
    var register = shared.register;
    var __skin = ${JSON.stringify(skin, null, 2)
      .split('\n')
      .map((line, i) => i === 0 ? line : '    ' + line)
      .join('\n')};

    var off = register(__skin);
    exports.dispose = off;
    exports.skin = __skin;
    return module.exports;
  },
});
`, 'utf8');

// preview SVG
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" role="img" aria-label="${nameEn} preview">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${skin.vars['--dsh-glow-1']}"/>
      <stop offset="100%" stop-color="${skin.vars['--dsh-glow-2']}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="240" fill="${skin.vars['--dsh-bg-primary']}"/>
  <rect width="400" height="240" fill="url(#g1)"/>
  <rect x="32" y="32" width="336" height="176" rx="14" fill="${skin.vars['--dsh-bg-elevated']}" stroke="${skin.vars['--dsh-border']}" stroke-width="1"/>
  <rect x="48" y="56" width="80" height="10" rx="3" fill="${skin.vars['--dsh-fg-primary']}"/>
  <rect x="48" y="78" width="180" height="6" rx="3" fill="${skin.vars['--dsh-fg-tertiary']}"/>
  <rect x="48" y="92" width="160" height="6" rx="3" fill="${skin.vars['--dsh-fg-tertiary']}"/>
  <rect x="48" y="106" width="140" height="6" rx="3" fill="${skin.vars['--dsh-fg-tertiary']}"/>
  <rect x="48" y="170" width="64" height="20" rx="6" fill="${skin.vars['--dsh-accent']}"/>
  <text x="80" y="184" text-anchor="middle" fill="${skin.vars['--dsh-accent-fg']}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">accent</text>
  <text x="370" y="220" text-anchor="end" fill="${skin.vars['--dsh-fg-tertiary']}" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="500" letter-spacing="0.04em">${id}</text>
</svg>`;
writeFileSync(join(target, 'preview/light.svg'), svg, 'utf8');
writeFileSync(join(target, 'preview/dark.svg'), svg, 'utf8');

// README 双语 + i18n yaml
writeFileSync(join(target, 'README.md'), `# @dsh-desktop/skin-${id}

${name} (${nameEn}) — a dsh-desktop minimal editorial skin.

## Tokens

Edit \`skin.json\` → \`vars\` to adjust the 18 CSS tokens. The full list is in
\`@dsh-desktop/shared\`. The card re-applies on reload.

## License

MIT
`, 'utf8');
writeFileSync(join(target, 'README.zh.md'), `# @dsh-desktop/skin-${id}

${name}（${nameEn}）—— dsh-desktop 一款极简 editorial 原创皮肤。

## Token

编辑 \`skin.json\` 的 \`vars\` 字段调整 18 个 CSS token。完整列表见
\`@dsh-desktop/shared\`。改完刷新即可在皮肤中心看到。

## 许可

MIT
`, 'utf8');
writeFileSync(join(target, 'README.i18n.yaml'), `# 双语配对（CI 门禁 docs:check 校验）
namespace: '@dsh-desktop/skin-${id}'
entries:
  - id: name
    zh: ${name}
    en: ${nameEn}
  - id: tagline
    zh: ${tagline}
    en: ${tagline}
  - id: description
    zh: ${description}
    en: ${description}
`, 'utf8');

console.log(`\n[dsh-skin-new] scaffolded skins/${id}/`);
console.log(`              编辑 skin.json 改 token，然后跑:`);
console.log(`              pnpm aggregate\n`);

// 自动重跑聚合
console.log('[dsh-skin-new] 重新生成 dsh-skins 聚合...');
const r = spawnSync(process.execPath, [join(ROOT, 'dsh-skins', 'scripts', 'aggregate.mjs')], {
  stdio: 'inherit', cwd: ROOT,
});
if (r.status !== 0) {
  console.error('warning: aggregate.mjs failed; 记得手动把新皮肤加进 dsh-skins/package.json dependencies');
} else {
  console.log('[dsh-skin-new] 提示：把 "@dsh-desktop/skin-' + id + '": "workspace:*" 加进 dsh-skins/package.json');
}
