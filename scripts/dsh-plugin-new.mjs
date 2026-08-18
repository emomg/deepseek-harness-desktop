// 新插件脚手架：交互式建一个 dsh-<id> 包
// 跑法：pnpm plugin:new <id> [--name <zh>]
//
// 与 dsh-skin-new 不同，插件需要写 lib/index.js（host apply） + lib/client.js（cordis bundle）
// 这里只生成空壳模板，host 端业务逻辑自己填。

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('--')) {
  console.error('usage: pnpm plugin:new <id>');
  process.exit(1);
}
const id = args[0];
if (!/^[a-z][a-z0-9-]{1,32}$/.test(id)) {
  console.error(`error: id must be kebab-case ascii, 2-33 chars (got: ${id})`);
  process.exit(1);
}

const target = join(ROOT, 'plugins', id);
if (existsSync(target)) {
  console.error(`error: plugins/${id} already exists`);
  process.exit(1);
}

mkdirSync(join(target, 'lib'), { recursive: true });
mkdirSync(join(target, 'test'), { recursive: true });

writeFileSync(join(target, 'package.json'), JSON.stringify({
  name: 'dsh-' + id,
  version: '0.1.0',
  description: `DSH 插件 ${id}（占位 — 写自己的功能描述）`,
  type: 'module',
  main: 'lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './package.json': './package.json',
  },
  files: ['lib', 'cordis.patch.yml', 'README.md'],
  license: 'MIT',
  dsh: {
    bundle: { patch: './cordis.patch.yml' },
    client: { inject: ['@deepseek-ai/dsh-client-runtime'], platform: 'web' },
  },
}, null, 2) + '\n', 'utf8');

writeFileSync(join(target, 'cordis.patch.yml'), `# dsh-${id}：占位

- insert:
    - id: dsh-${id}
      name: 'dsh-${id}'
      config: {}
`, 'utf8');

writeFileSync(join(target, 'lib/index.js'), `// dsh-${id} · 宿主端
// TODO: 注入服务（如 sessions / llm / webServer） + 注册 API 路由
export const name = 'dsh-${id}';
export const inject = [];
export function apply(_ctx) {
  /* TODO: 实现 host 端逻辑 */
}
`, 'utf8');

writeFileSync(join(target, 'lib/client.js'), `// dsh-${id} · 浏览器端
// TODO: 用 ctx.slots.inject 在合适位置插入 UI；用 ctx.locale.register 加 i18n 字典
window.__ModuleLoader__.load({
  id: 'dsh-${id}',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    let react = require('react');
    react = (function (m) { return m && m.__esModule ? m : { default: m }; })(react);
    const { createElement: h } = react;

    function PlaceholderPanel() {
      return h('div', null, 'dsh-${id} — TODO');
    }

    const inject = ['slots', 'locale'];
    function apply(ctx) {
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-${id}-panel',
      }, () => h(PlaceholderPanel)));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
`, 'utf8');

writeFileSync(join(target, 'test/run-all.js'), `// dsh-${id} 测试入口
// 跑法：node plugins/${id}/test/run-all.js
console.log('dsh-${id}: no tests yet');
`, 'utf8');

writeFileSync(join(target, 'README.md'), `# dsh-${id}

DSH 插件 ${id}（占位）。

## TODO

- 写 host 端 \`lib/index.js\` 的 \`apply(ctx)\` —— 注入服务 / 注册 API
- 写 \`lib/client.js\` 的 UI 部分 —— 用 \`ctx.slots.inject\` 挂载到 DSH 界面
- 改 \`cordis.patch.yml\` 的 config
- 加 README 双语（zh + en + i18n.yaml）

## License

MIT
`, 'utf8');

console.log(`\n[dsh-plugin-new] scaffolded plugins/${id}/`);
console.log(`                 cd plugins/${id} && 编辑 lib/{index,client}.js`);
