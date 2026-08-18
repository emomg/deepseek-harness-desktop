/**
 * dsh-desktop CSS 变量约定
 *
 * 完整 token 列表见 skin-schema.js。每款皮肤提供 vars，skin-center 写入
 * document.documentElement 的内联 style，所有 CSS 选择器即可通过 var(--dsh-*)
 * 引用。
 *
 * 默认值（缺省回退）：用 #fafaf7 冷白 + #1a1a1a 墨黑，零依赖 100% 标准色。
 * 当 skin 加载但 token 还没注入到 DOM 时，下面的 fallback 保证布局不破。
 */

export const DEFAULT_VARS = Object.freeze({
  '--dsh-bg-primary': '#fafaf7',
  '--dsh-bg-secondary': '#f0eee8',
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
  '--dsh-glow-1': 'rgba(0, 0, 0, 0.04)',
  '--dsh-glow-2': 'rgba(0, 0, 0, 0.02)',
  '--dsh-mode': 'light',
});

/**
 * 注入默认 token（idempotent）。在 skin-center 启动时调用一次，
 * 后续 apply 皮肤时是「完整覆写」而非 merge——这样每款皮肤都是自洽的。
 * @param {Document} [doc]
 */
export function installDefaultTokens(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) return;
  const root = doc.documentElement;
  for (const [k, v] of Object.entries(DEFAULT_VARS)) {
    if (!root.style.getPropertyValue(k)) root.style.setProperty(k, String(v));
  }
}

/**
 * 把 skin.vars 完整写入 documentElement.style。
 * @param {Record<string, string|number>} vars
 * @param {Document} [doc]
 */
export function writeVars(vars, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) return;
  const root = doc.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, String(v));
  }
}

/**
 * 读取当前 DOM 上的所有 --dsh-* token
 * @param {Document} [doc]
 */
export function readVars(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) return { ...DEFAULT_VARS };
  const root = doc.documentElement;
  const cs = root.style;
  const out = {};
  for (const k of Object.keys(DEFAULT_VARS)) {
    const v = cs.getPropertyValue(k).trim();
    out[k] = v === '' ? DEFAULT_VARS[k] : v;
  }
  return out;
}
