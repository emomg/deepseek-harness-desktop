// 画廊静态站生成。
// 跑法：node gallery/scripts/build.mjs [--check]
//
// 输入：dsh-skins/build/registry.json + skins/*/preview/light.svg
// 输出：gallery/index.html（一张大页面，6 款卡片网格 + 详情面板）

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const REG = join(ROOT, 'dsh-skins', 'build', 'registry.json');
const GALLERY = resolve(__dirname, '..'); // gallery/
const OUT = join(GALLERY, 'index.html');

if (!existsSync(REG)) {
  console.error('error: dsh-skins/build/registry.json missing; run `pnpm --filter @dsh-desktop/skins-all build` first');
  process.exit(1);
}

const reg = JSON.parse(readFileSync(REG, 'utf8'));

// 给每款皮肤构造预览卡（直接 inline 它的 vars 作为 CSS 自定义属性，
// 然后用一个简化 DSH 面板 SVG）
function previewCardHtml(skin) {
  const v = skin.vars;
  const inlineVars = Object.entries(v).map(([k, val]) => `${k}: ${val}`).join('; ');
  return `<article class="card" style="${inlineVars}" data-skin-id="${skin.id}">
  <div class="card__prev" aria-hidden="true">
    <div class="prev__glow"></div>
    <div class="prev__chip">${skin.id} · ${v['--dsh-mode']}</div>
    <div class="prev__name">${escapeHtml(skin.name)}</div>
  </div>
  <div class="card__head">
    <h2>${escapeHtml(skin.name)} <span class="card__en">${escapeHtml(skin.nameEn)}</span></h2>
    <p class="card__tagline">${escapeHtml(skin.tagline)}</p>
  </div>
  <p class="card__desc">${escapeHtml(skin.description)}</p>
  <div class="card__tags">${(skin.tags || []).map((t) => `<span class="pill">${escapeHtml(t)}</span>`).join('')}</div>
  <details class="card__tokens">
    <summary>18 token values</summary>
    <table>
      ${Object.entries(v).map(([k, val]) => `<tr><td><code>${escapeHtml(k)}</code></td><td><code>${escapeHtml(String(val))}</code></td></tr>`).join('')}
    </table>
  </details>
</article>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const cards = reg.skins.map(previewCardHtml).join('\n');

const html = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8"/>
  <title>dsh-desktop · 皮肤画廊 · ${reg.count} 款极简 editorial 原创皮肤</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    :root {
      color-scheme: light;
      --page-bg: #fafaf7;
      --page-fg: #1a1a1a;
      --page-fg-2: #6a6a66;
      --page-border: rgba(0,0,0,.08);
      --page-mono: "Cascadia Code", Consolas, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      background: var(--page-bg);
      color: var(--page-fg);
      line-height: 1.6;
    }
    .page { max-width: 1240px; margin: 0 auto; padding: 56px 32px 96px; }
    .page__head { margin-bottom: 40px; }
    .page__eyebrow { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--page-fg-2); }
    .page__title { font-size: 32px; font-weight: 600; margin: 8px 0 12px; letter-spacing: -.01em; }
    .page__lead { font-size: 16px; color: var(--page-fg-2); max-width: 720px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .card {
      border: 1px solid var(--page-border);
      border-radius: 14px;
      padding: 18px;
      background: var(--dsh-bg-secondary);
      color: var(--dsh-fg-primary);
      display: flex; flex-direction: column; gap: 12px;
    }
    .card__prev {
      position: relative;
      height: 144px;
      border-radius: 10px;
      background: var(--dsh-bg-primary);
      border: 1px solid var(--dsh-border);
      overflow: hidden;
    }
    .prev__glow {
      position: absolute; inset: 0;
      background:
        radial-gradient(120% 90% at 88% -10%, var(--dsh-glow-1), transparent 60%),
        radial-gradient(100% 80% at -8% 110%, var(--dsh-glow-2), transparent 55%);
    }
    .prev__chip {
      position: absolute; top: 10px; left: 12px;
      font-family: var(--page-mono);
      font-size: 10px; letter-spacing: .04em;
      background: var(--dsh-bg-elevated);
      color: var(--dsh-fg-tertiary);
      padding: 2px 6px; border-radius: 4px;
    }
    .prev__name {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: var(--dsh-fg-primary);
      font-size: 26px; font-weight: 600; letter-spacing: .04em;
    }
    .card__head h2 {
      margin: 0; font-size: 16px; font-weight: 600;
      display: flex; align-items: baseline; gap: 8px;
    }
    .card__en {
      font-family: var(--page-mono);
      font-size: 11px; letter-spacing: .04em;
      color: var(--dsh-fg-tertiary);
      font-weight: 400;
    }
    .card__tagline { margin: 6px 0 0; font-size: 13px; color: var(--dsh-fg-secondary); }
    .card__desc { margin: 0; font-size: 12px; color: var(--dsh-fg-tertiary); }
    .card__tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .pill {
      font-family: var(--page-mono);
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: var(--dsh-bg-elevated); color: var(--dsh-fg-tertiary);
    }
    .card__tokens { margin-top: auto; }
    .card__tokens summary {
      cursor: pointer; font-size: 11px; color: var(--dsh-fg-tertiary);
      padding: 4px 0;
    }
    .card__tokens table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .card__tokens td { padding: 3px 4px; border-bottom: 1px solid var(--dsh-border); vertical-align: top; }
    .card__tokens td:first-child { width: 50%; }
    .card__tokens code { font-family: var(--page-mono); color: var(--dsh-fg-secondary); }
    .page__foot { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--page-border); font-size: 12px; color: var(--page-fg-2); }
    code { font-family: var(--page-mono); }
  </style>
</head>
<body>
  <main class="page">
    <header class="page__head">
      <div class="page__eyebrow">dsh-desktop · skin gallery</div>
      <h1 class="page__title">${reg.count} 款极简 editorial 原创皮肤</h1>
      <p class="page__lead">
        为 dsh-desktop 桌面端的 DSH Web UI 设计的原创皮肤系统。每款皮肤是 18 个
        CSS token 的完整覆写，呈现一种独立的视觉情绪。先试穿再应用，离开本页或点
        还原即可完全回退。
      </p>
    </header>
    <section class="grid">
      ${cards}
    </section>
    <footer class="page__foot">
      Generated <code>${escapeHtml(reg.generated)}</code> · tokens per skin
      18 · gallery version 1
    </footer>
  </main>
</body>
</html>
`;

if (process.argv.includes('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== html) {
    console.error('gallery index.html is out of date; run `pnpm --filter @dsh-desktop/gallery build`');
    process.exit(1);
  }
  console.log('gallery: CHECK OK');
  process.exit(0);
}

writeFileSync(OUT, html, 'utf8');
console.log(`[gallery] wrote index.html (${html.length} bytes, ${reg.count} skins)`);
