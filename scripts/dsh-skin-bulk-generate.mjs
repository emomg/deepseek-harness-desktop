// 6 款极简 editorial 原创皮肤的批量生成脚本。
// 跑法：node scripts/dsh-skin-bulk-generate.mjs
//
// 每个 skin 包结构：
//   - package.json        npm 包描述
//   - cordis.patch.yml    dsh 注册
//   - lib/index.js        host stub
//   - lib/client.js       browser: register(skin)
//   - skin.json           静态元数据（id / name / vars / preview）
//   - preview/light.svg   预览图（由脚本生成）
//   - preview/dark.svg
//   - README.md / README.zh.md / README.i18n.yaml
//
// 注：现有 dsh-pro 11 款硬编码皮肤（black-whale/deep-space/...）已全部删除，
// 本脚本生成的是替代品。

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SKINS_DIR = join(ROOT, 'skins');

// 通用 18 token 必备键（与 shared/skin-schema.js DEFAULT_VARS 对齐）
const TOKEN_KEYS = [
  '--dsh-bg-primary', '--dsh-bg-secondary', '--dsh-bg-elevated',
  '--dsh-fg-primary', '--dsh-fg-secondary', '--dsh-fg-tertiary', '--dsh-fg-disabled',
  '--dsh-border', '--dsh-border-strong',
  '--dsh-accent', '--dsh-accent-fg',
  '--dsh-glass-bg', '--dsh-glass-border', '--dsh-glass-blur',
  '--dsh-shadow', '--dsh-glow-1', '--dsh-glow-2', '--dsh-mode',
];

// 6 款皮肤定义（极简 editorial：每个值都是「完成态」——不需要微调）
const SKINS = [
  {
    id: 'bone-white',
    name: '骨白',
    nameEn: 'Bone White',
    order: 1,
    tagline: '冷白底 + 大量负空间 + 一抹墨黑',
    description: '极简 clean editorial 基线：冷白底配上一抹墨黑，大量负空间留给工作本身。默认皮肤，最克制的入门。',
    tags: ['light', 'minimal', 'editorial', 'default'],
    vars: {
      '--dsh-bg-primary': '#fafaf7',
      '--dsh-bg-secondary': '#f3f1ec',
      '--dsh-bg-elevated': '#ffffff',
      '--dsh-fg-primary': '#1a1a1a',
      '--dsh-fg-secondary': '#4a4a48',
      '--dsh-fg-tertiary': '#8a8a86',
      '--dsh-fg-disabled': '#b8b8b4',
      '--dsh-border': 'rgba(0, 0, 0, 0.06)',
      '--dsh-border-strong': 'rgba(0, 0, 0, 0.12)',
      '--dsh-accent': '#1a1a1a',
      '--dsh-accent-fg': '#ffffff',
      '--dsh-glass-bg': 'rgba(250, 250, 247, 0.78)',
      '--dsh-glass-border': 'rgba(0, 0, 0, 0.06)',
      '--dsh-glass-blur': 22,
      '--dsh-shadow': '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.04)',
      '--dsh-glow-1': 'rgba(0, 0, 0, 0.03)',
      '--dsh-glow-2': 'rgba(0, 0, 0, 0.015)',
      '--dsh-mode': 'light',
    },
  },
  {
    id: 'graphite',
    name: '石墨',
    nameEn: 'Graphite',
    order: 2,
    tagline: '极简灰阶 + 一抹墨黑 + 高对比',
    description: '更深的冷灰底 + 强对比。编辑工作、文字密集、想集中注意力时的默认。',
    tags: ['light', 'minimal', 'editorial', 'focus'],
    vars: {
      '--dsh-bg-primary': '#ececeb',
      '--dsh-bg-secondary': '#dededd',
      '--dsh-bg-elevated': '#f4f4f3',
      '--dsh-fg-primary': '#0e0e0e',
      '--dsh-fg-secondary': '#3a3a3a',
      '--dsh-fg-tertiary': '#6e6e6e',
      '--dsh-fg-disabled': '#a4a4a4',
      '--dsh-border': 'rgba(0, 0, 0, 0.10)',
      '--dsh-border-strong': 'rgba(0, 0, 0, 0.18)',
      '--dsh-accent': '#0e0e0e',
      '--dsh-accent-fg': '#ffffff',
      '--dsh-glass-bg': 'rgba(236, 236, 235, 0.82)',
      '--dsh-glass-border': 'rgba(0, 0, 0, 0.10)',
      '--dsh-glass-blur': 24,
      '--dsh-shadow': '0 1px 2px rgba(0,0,0,.06), 0 8px 28px rgba(0,0,0,.06)',
      '--dsh-glow-1': 'rgba(0, 0, 0, 0.04)',
      '--dsh-glow-2': 'rgba(0, 0, 0, 0.02)',
      '--dsh-mode': 'light',
    },
  },
  {
    id: 'paper',
    name: '宣纸',
    nameEn: 'Paper',
    order: 3,
    tagline: '米白 + 朱砂一抹（暖底冷顶）',
    description: '略带暖意的米白底，配一抹朱砂色 accent。最有手感的「纸」，适合长读与写作。',
    tags: ['light', 'minimal', 'editorial', 'warm'],
    vars: {
      '--dsh-bg-primary': '#f5efe5',
      '--dsh-bg-secondary': '#ebe4d6',
      '--dsh-bg-elevated': '#fbf8f0',
      '--dsh-fg-primary': '#1f1b16',
      '--dsh-fg-secondary': '#524a3e',
      '--dsh-fg-tertiary': '#8a7f6e',
      '--dsh-fg-disabled': '#b6ad9c',
      '--dsh-border': 'rgba(31, 27, 22, 0.08)',
      '--dsh-border-strong': 'rgba(31, 27, 22, 0.16)',
      '--dsh-accent': '#b8434a',
      '--dsh-accent-fg': '#ffffff',
      '--dsh-glass-bg': 'rgba(245, 239, 229, 0.80)',
      '--dsh-glass-border': 'rgba(31, 27, 22, 0.08)',
      '--dsh-glass-blur': 22,
      '--dsh-shadow': '0 1px 2px rgba(31,27,22,.05), 0 8px 24px rgba(31,27,22,.05)',
      '--dsh-glow-1': 'rgba(184, 67, 74, 0.08)',
      '--dsh-glow-2': 'rgba(184, 67, 74, 0.04)',
      '--dsh-mode': 'light',
    },
  },
  {
    id: 'mist',
    name: '雾',
    nameEn: 'Mist',
    order: 4,
    tagline: '冷感湿润 · 雨意蓝灰 + 墨黑',
    description: '近冷蓝灰的雨意底色 + 强对比墨黑。安静、专注、不抢戏。',
    tags: ['light', 'minimal', 'editorial', 'cool'],
    vars: {
      '--dsh-bg-primary': '#eef0f2',
      '--dsh-bg-secondary': '#dfe2e6',
      '--dsh-bg-elevated': '#f6f7f8',
      '--dsh-fg-primary': '#0c1014',
      '--dsh-fg-secondary': '#2c333b',
      '--dsh-fg-tertiary': '#5b6770',
      '--dsh-fg-disabled': '#8a949c',
      '--dsh-border': 'rgba(12, 16, 20, 0.08)',
      '--dsh-border-strong': 'rgba(12, 16, 20, 0.16)',
      '--dsh-accent': '#0c1014',
      '--dsh-accent-fg': '#ffffff',
      '--dsh-glass-bg': 'rgba(238, 240, 242, 0.80)',
      '--dsh-glass-border': 'rgba(12, 16, 20, 0.08)',
      '--dsh-glass-blur': 26,
      '--dsh-shadow': '0 1px 2px rgba(12,16,20,.05), 0 8px 28px rgba(12,16,20,.06)',
      '--dsh-glow-1': 'rgba(60, 90, 140, 0.05)',
      '--dsh-glow-2': 'rgba(60, 90, 140, 0.025)',
      '--dsh-mode': 'light',
    },
  },
  {
    id: 'lilac',
    name: '丁香',
    nameEn: 'Lilac',
    order: 5,
    tagline: '冷白 + 一抹极低饱和丁香紫',
    description: '冷白底配一抹极低饱和丁香紫。安静中的一点冷色，绝不抢戏。',
    tags: ['light', 'minimal', 'editorial', 'cool', 'accent'],
    vars: {
      '--dsh-bg-primary': '#f7f5f8',
      '--dsh-bg-secondary': '#ece8ef',
      '--dsh-bg-elevated': '#fdfcfe',
      '--dsh-fg-primary': '#1c1820',
      '--dsh-fg-secondary': '#4a4350',
      '--dsh-fg-tertiary': '#857d8c',
      '--dsh-fg-disabled': '#b3acb8',
      '--dsh-border': 'rgba(28, 24, 32, 0.07)',
      '--dsh-border-strong': 'rgba(28, 24, 32, 0.14)',
      '--dsh-accent': '#7a6592',
      '--dsh-accent-fg': '#ffffff',
      '--dsh-glass-bg': 'rgba(247, 245, 248, 0.80)',
      '--dsh-glass-border': 'rgba(28, 24, 32, 0.07)',
      '--dsh-glass-blur': 22,
      '--dsh-shadow': '0 1px 2px rgba(28,24,32,.04), 0 8px 24px rgba(28,24,32,.04)',
      '--dsh-glow-1': 'rgba(122, 101, 146, 0.06)',
      '--dsh-glow-2': 'rgba(122, 101, 146, 0.03)',
      '--dsh-mode': 'light',
    },
  },
  {
    id: 'mint',
    name: '薄荷',
    nameEn: 'Mint',
    order: 6,
    tagline: '米白 + 极低饱和薄荷',
    description: '米白底配一抹极低饱和薄荷。最轻的「冷色 accent」，适合长时间轻量阅读。',
    tags: ['light', 'minimal', 'editorial', 'cool', 'accent'],
    vars: {
      '--dsh-bg-primary': '#f4f6f3',
      '--dsh-bg-secondary': '#e5ebe4',
      '--dsh-bg-elevated': '#fbfcf9',
      '--dsh-fg-primary': '#141a16',
      '--dsh-fg-secondary': '#3c4540',
      '--dsh-fg-tertiary': '#737e76',
      '--dsh-fg-disabled': '#a5aea6',
      '--dsh-border': 'rgba(20, 26, 22, 0.07)',
      '--dsh-border-strong': 'rgba(20, 26, 22, 0.14)',
      '--dsh-accent': '#5e9275',
      '--dsh-accent-fg': '#ffffff',
      '--dsh-glass-bg': 'rgba(244, 246, 243, 0.80)',
      '--dsh-glass-border': 'rgba(20, 26, 22, 0.07)',
      '--dsh-glass-blur': 22,
      '--dsh-shadow': '0 1px 2px rgba(20,26,22,.04), 0 8px 24px rgba(20,26,22,.04)',
      '--dsh-glow-1': 'rgba(94, 146, 117, 0.06)',
      '--dsh-glow-2': 'rgba(94, 146, 117, 0.03)',
      '--dsh-mode': 'light',
    },
  },
];

// 校验：所有 18 token 都有值
for (const s of SKINS) {
  for (const k of TOKEN_KEYS) {
    if (!(k in s.vars)) throw new Error(`skin ${s.id} missing token ${k}`);
  }
}

// 渲染 SVG 预览图
function renderPreviewSvg(skin) {
  const v = skin.vars;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" role="img" aria-label="${skin.nameEn} preview">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${v['--dsh-glow-1']}"/>
      <stop offset="100%" stop-color="${v['--dsh-glow-2']}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="240" fill="${v['--dsh-bg-primary']}"/>
  <rect width="400" height="240" fill="url(#g1)"/>
  <rect x="32" y="32" width="336" height="176" rx="14" fill="${v['--dsh-bg-elevated']}" stroke="${v['--dsh-border']}" stroke-width="1"/>
  <rect x="48" y="56" width="80" height="10" rx="3" fill="${v['--dsh-fg-primary']}"/>
  <rect x="48" y="78" width="180" height="6" rx="3" fill="${v['--dsh-fg-tertiary']}"/>
  <rect x="48" y="92" width="160" height="6" rx="3" fill="${v['--dsh-fg-tertiary']}"/>
  <rect x="48" y="106" width="140" height="6" rx="3" fill="${v['--dsh-fg-tertiary']}"/>
  <rect x="48" y="170" width="64" height="20" rx="6" fill="${v['--dsh-accent']}"/>
  <text x="80" y="184" text-anchor="middle" fill="${v['--dsh-accent-fg']}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">accent</text>
  <text x="370" y="220" text-anchor="end" fill="${v['--dsh-fg-tertiary']}" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="500" letter-spacing="0.04em">${skin.id}</text>
</svg>`;
}

// 文件模板
const packageJson = (s) => JSON.stringify({
  name: '@dsh-desktop/skin-' + s.id,
  version: '0.1.0',
  description: `${s.name} · 极简 editorial 皮肤：${s.tagline}。`,
  type: 'module',
  main: 'lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './skin.json': './skin.json',
    './package.json': './package.json',
  },
  files: [
    'lib',
    'skin.json',
    'cordis.patch.yml',
    'preview',
    'README.md',
    'README.zh.md',
    'README.i18n.yaml',
  ],
  license: 'MIT',
  dsh: {
    bundle: { patch: './cordis.patch.yml' },
    client: {
      inject: ['@deepseek-ai/dsh-client-runtime'],
      platform: 'web',
    },
  },
  dependencies: {
    '@dsh-desktop/shared': 'workspace:*',
  },
}, null, 2) + '\n';

const cordisPatchYml = (s) => `# @dsh-desktop/skin-${s.id}：${s.name}（${s.nameEn}）—— 极简 editorial 原创皮肤

- insert:
    - id: dsh-desktop-skin-${s.id}
      name: '@dsh-desktop/skin-${s.id}'
      config: {}
`;

const hostIndexJs = (s) => `// @dsh-desktop/skin-${s.id} · 宿主端 stub
// 纯浏览器端插件：唯一动作是 register(skin) 到共享注册表。

export const name = 'dsh-desktop-skin-${s.id}';
export const inject = [];
export function apply(_ctx) { /* no-op */ }
`;

const clientJs = (s) => `// @dsh-desktop/skin-${s.id} · 浏览器端
// 唯一动作：register() 把 ${s.name} 元数据塞进共享注册表。
// skin-center 卡的 list() 拉到后自动出现在「皮肤中心」。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-${s.id}',
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
    var __skin = ${JSON.stringify(s, null, 2)
      .split('\n')
      .map((line, i) => i === 0 ? line : '    ' + line)
      .join('\n')};

    var off = register(__skin);
    exports.dispose = off;
    exports.skin = __skin;
    return module.exports;
  },
});
`;

const readmeEn = (s) => `# @dsh-desktop/skin-${s.id}

${s.name} (${s.nameEn}) — one of the six original minimal editorial skins for
dsh-desktop.

## What this package is

A standalone skin. When loaded by dsh web, its only action is to register
itself into the shared skin registry. The skin-center card picks it up and
renders it in the "皮肤中心 / Skins" tab.

## Tokens

The full 18-token set is in \`skin.json\` and shipped via the \`vars\` field.
It is a complete overwrite (not a partial merge), so each skin is self-
contained — no residual values from the previous skin leak through.

## Token values

${Object.entries(s.vars).map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n')}

## Preview

\`preview/light.svg\` is generated at scaffold time and shows a mock DSH
panel using the skin's tokens. It is a stand-in, not a real screenshot.

## License

MIT
`;

const readmeZh = (s) => `# @dsh-desktop/skin-${s.id}

${s.name}（${s.nameEn}）—— dsh-desktop 6 款极简 editorial 原创皮肤之一。

## 这是什么

独立皮肤包。dsh web 加载后，唯一的动作就是把自己注册到共享皮肤注册表。
皮肤中心卡会拉取它，渲染在「皮肤中心」标签页里。

## Token

完整 18 个 token 在 \`skin.json\` 的 \`vars\` 字段。皮肤中心是「完整覆写」
（不是 partial merge），所以每款皮肤都是自洽的——上一个皮肤的残值不会泄漏到
当前皮肤。

## Token 值

${Object.entries(s.vars).map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n')}

## 预览

\`preview/light.svg\` 是脚手架时生成的样张，模拟 DSH 面板用本皮肤 token 渲染
的占位图，不是真实截图。

## 许可

MIT
`;

const readmeI18n = (s) => `# 双语配对（CI 门禁 docs:check 校验）
namespace: '@dsh-desktop/skin-${s.id}'
entries:
  - id: name
    zh: ${s.name}
    en: ${s.nameEn}
  - id: tagline
    zh: ${s.tagline}
    en: ${s.tagline}
  - id: description
    zh: ${s.description}
    en: ${s.description}
`;

// 写入
for (const s of SKINS) {
  const dir = join(SKINS_DIR, s.id);
  mkdirSync(join(dir, 'lib'), { recursive: true });
  mkdirSync(join(dir, 'preview'), { recursive: true });
  mkdirSync(join(dir, 'tests'), { recursive: true });

  writeFileSync(join(dir, 'package.json'), packageJson(s), 'utf8');
  writeFileSync(join(dir, 'cordis.patch.yml'), cordisPatchYml(s), 'utf8');
  writeFileSync(join(dir, 'lib/index.js'), hostIndexJs(s), 'utf8');
  writeFileSync(join(dir, 'lib/client.js'), clientJs(s), 'utf8');
  writeFileSync(join(dir, 'skin.json'), JSON.stringify({
    id: s.id,
    name: s.name,
    nameEn: s.nameEn,
    tagline: s.tagline,
    description: s.description,
    tags: s.tags,
    order: s.order,
    vars: s.vars,
  }, null, 2) + '\n', 'utf8');
  writeFileSync(join(dir, 'preview/light.svg'), renderPreviewSvg(s), 'utf8');
  writeFileSync(join(dir, 'preview/dark.svg'), renderPreviewSvg({ ...s, vars: { ...s.vars, '--dsh-bg-primary': s.vars['--dsh-fg-primary'], '--dsh-fg-primary': s.vars['--dsh-bg-primary'] } }), 'utf8');
  writeFileSync(join(dir, 'README.md'), readmeEn(s), 'utf8');
  writeFileSync(join(dir, 'README.zh.md'), readmeZh(s), 'utf8');
  writeFileSync(join(dir, 'README.i18n.yaml'), readmeI18n(s), 'utf8');
  console.log('  +', s.id);
}

console.log(`\nGenerated ${SKINS.length} skin packages in skins/`);
