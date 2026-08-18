/**
 * dsh-desktop -> DSH Web UI token bridge
 *
 * The official DeepSeek Harness web client styles itself exclusively with the
 * `--dsw-*` custom properties it defines on `body` / `body[data-ds-dark-theme]`
 * (see packages/client/ui-theme/src/styles/design-platform.css upstream). A skin
 * written only in `--dsh-*` tokens therefore never reaches the real UI.
 *
 * This module translates the 18 `--dsh-*` skin tokens into a complete override
 * of the official semantic aliases. The returned stylesheet targets both `body`
 * and `body[data-ds-dark-theme]` so the skin wins regardless of the OS theme
 * preference (all six shipped skins are light-mode editorial skins).
 */

/** @param {string} hex `#rrggbb` or `#rgb` -> [r,g,b] */
function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** `#rrggbb` -> `rgb(r, g, b)` */
function rgbStr(hex) {
  const c = hexToRgb(hex)
  return c ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : String(hex)
}

/** `#rrggbb` -> `rgba(r, g, b, a)` */
function rgba(hex, alpha) {
  const c = hexToRgb(hex)
  return c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})` : String(hex)
}

/** mix hex with white (amount 0..1) -> #rrggbb */
function lighten(hex, amount) {
  const c = hexToRgb(hex)
  if (!c) return String(hex)
  const m = Math.min(1, Math.max(0, amount))
  const mix = c.map((v) => Math.round(v + (255 - v) * m))
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** mix hex with black (amount 0..1) -> #rrggbb */
function darken(hex, amount) {
  const c = hexToRgb(hex)
  if (!c) return String(hex)
  const m = Math.min(1, Math.max(0, amount))
  const mix = c.map((v) => Math.round(v * (1 - m)))
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/**
 * Build the official-token override stylesheet for one skin.
 * @param {Record<string, string|number>} vars the 18 `--dsh-*` tokens
 * @param {string} [extraCss] optional skin-specific CSS appended verbatim
 * @returns {string} CSS text safe to inject into <head>
 */
export function skinStylesheet(vars, extraCss) {
  const v = Object.assign({}, vars)
  const bg = rgbStr(String(v['--dsh-bg-primary'] ?? '#fafaf7'))
  const bg2 = rgbStr(String(v['--dsh-bg-secondary'] ?? '#f0eee8'))
  const elev = rgbStr(String(v['--dsh-bg-elevated'] ?? '#ffffff'))
  const fg = String(v['--dsh-fg-primary'] ?? '#1a1a1a')
  const fg2 = String(v['--dsh-fg-secondary'] ?? '#4a4a48')
  const fg3 = String(v['--dsh-fg-tertiary'] ?? '#8a8a86')
  const fgOff = String(v['--dsh-fg-disabled'] ?? '#b8b8b4')
  const line = String(v['--dsh-border'] ?? 'rgba(0, 0, 0, 0.06)')
  const line2 = String(v['--dsh-border-strong'] ?? 'rgba(0, 0, 0, 0.12)')
  const accent = String(v['--dsh-accent'] ?? '#1a1a1a')
  const accentFg = String(v['--dsh-accent-fg'] ?? '#ffffff')
  const glow = String(v['--dsh-glow-1'] ?? 'rgba(0, 0, 0, 0.04)')

  const decls = [
    // backgrounds
    '--dsw-alias-bg-base: ' + bg + ';',
    '--dsw-alias-bg-layer-1: ' + bg + ';',
    '--dsw-alias-bg-layer-2: ' + bg + ';',
    '--dsw-alias-bg-layer-3: ' + elev + ';',
    '--dsw-alias-bg-module-platform: ' + bg2 + ';',
    '--dsw-alias-bg-multi-select: ' + bg2 + ';',
    '--dsw-alias-bg-overlay: ' + bg2 + ';',
    '--dsw-alias-bg-skeleton: ' + rgba(accent, 0.04) + ';',
    // borders
    '--dsw-alias-border-l1: ' + line + ';',
    '--dsw-alias-border-l2: ' + line + ';',
    '--dsw-alias-border-l2-darkmode-thin: ' + line + ';',
    '--dsw-alias-border-l3: ' + line2 + ';',
    '--dsw-alias-border-l4: ' + line2 + ';',
    // labels
    '--dsw-alias-label-primary: ' + fg + ';',
    '--dsw-alias-label-secondary: ' + fg2 + ';',
    '--dsw-alias-label-tertiary: ' + fg3 + ';',
    '--dsw-alias-label-caption: ' + fg3 + ';',
    '--dsw-alias-label-dimmed: ' + fgOff + ';',
    '--dsw-alias-label-primary-dimmed: ' + fg2 + ';',
    '--dsw-alias-label-primary-foreground: ' + accentFg + ';',
    '--dsw-alias-label-primary-inverted: ' + accentFg + ';',
    '--dsw-alias-label-primary-bluish: ' + fg + ';',
    // brand
    '--dsw-alias-brand-primary: ' + accent + ';',
    '--dsw-alias-brand-text: ' + fg + ';',
    '--dsw-alias-brand-primary-invert: ' + accent + ';',
    '--dsw-alias-brand-primary-new-colorprimary-new-color: ' + accent + ';',
    // buttons
    '--dsw-alias-button-primary-fill: ' + accent + ';',
    '--dsw-alias-button-primary-hover: ' + lighten(accent, 0.08) + ';',
    '--dsw-alias-button-primary-dimmed: ' + rgba(accent, 0.12) + ';',
    '--dsw-alias-button-info-fill: ' + accent + ';',
    '--dsw-alias-button-info-hover: ' + lighten(accent, 0.08) + ';',
    '--dsw-alias-button-contrast-fill: ' + fg + ';',
    '--dsw-alias-button-elevated-fill: ' + elev + ';',
    '--dsw-alias-button-floating-fill: ' + elev + ';',
    '--dsw-alias-button-floating-hover: ' + bg2 + ';',
    '--dsw-alias-button-ghost-active-fill: ' + bg2 + ';',
    '--dsw-alias-button-ghost-active-hover: ' + bg2 + ';',
    '--dsw-alias-button-ghost-active-border: ' + fg3 + ';',
    '--dsw-alias-button-tool-bar-fill: ' + rgba(accent, 0.5) + ';',
    '--dsw-alias-button-tool-bar-hover: ' + rgba(accent, 0.6) + ';',
    '--dsw-alias-button-tool-bar-fill-invisible: ' + rgba(accent, 0.36) + ';',
    // interactive
    '--dsw-alias-interactive-bg-hover: ' + rgba(accent, 0.06) + ';',
    '--dsw-alias-interactive-bg-active: ' + rgba(accent, 0.1) + ';',
    '--dsw-alias-interactive-bg-hover-accent: ' + rgba(accent, 0.14) + ';',
    '--dsw-alias-interactive-bg-hover-solid: ' + bg2 + ';',
    // markdown
    '--dsw-alias-markdown-code-block: ' + bg2 + ';',
    '--dsw-alias-markdown-code-block-banner: ' + bg2 + ';',
    '--dsw-alias-markdown-code-segment-unselected: ' + bg2 + ';',
    '--dsw-alias-markdown-code-segment-selected: ' + elev + ';',
    '--dsw-alias-markdown-inline-code: ' + bg2 + ';',
    '--dsw-alias-markdown-placeholder: ' + bg2 + ';',
    '--dsw-alias-markdown-tag: ' + bg2 + ';',
    '--dsw-alias-markdown-citation: ' + bg2 + ';',
    // scrollbar
    '--dsw-alias-scrollbar-bg-l1: ' + line + ';',
    '--dsw-alias-scrollbar-bg-l2: ' + line + ';',
    '--dsw-alias-scrollbar-hover-l1: ' + line2 + ';',
    '--dsw-alias-scrollbar-hover-l2: ' + line2 + ';',
    // business state (accent-tinted only; error/success/warn stay functional)
    '--dsw-alias-state-business-primary: ' + accent + ';',
    '--dsw-alias-state-business-tertiary: ' + rgba(accent, 0.12) + ';',
    // dark surfaces
    '--dsw-alias-toast-bg: ' + fg + ';',
    '--dsw-alias-tooltip-bg: ' + fg + ';',
    // specific surfaces
    '--dsw-specific-bubble: ' + rgba(accent, 0.1) + ';',
    '--dsw-specific-bubble-highlight: ' + rgba(accent, 0.15) + ';',
    '--dsw-specific-input-major: ' + elev + ';',
    '--dsw-specific-login-input: ' + bg2 + ';',
    '--dsw-specific-menu: ' + elev + ';',
    '--dsw-specific-selector: ' + bg2 + ';',
    '--dsw-specific-sidebar-fill: ' + bg2 + ';',
    '--dsw-specific-sidebar-nav-item-active: ' + elev + ';',
    '--dsw-specific-sidebar-nav-item-active-accent: ' + rgba(accent, 0.12) + ';',
    '--dsw-specific-sidebar-nav-item-hover: ' + rgba(accent, 0.04) + ';',
    '--dsw-specific-tip: ' + bg2 + ';',
  ].join('\n')

  // Official static scale override (derived from the 18 tokens). The official
  // aliases reference these statics via var(); overriding both levels covers
  // components that consume statics directly, mirroring how dsh-web-ui skins work.
  const statics = [
    // neutral bluish scale
    '--dsw-static-neutral-bluish-00: ' + bg + ';',
    '--dsw-static-neutral-bluish-50: ' + bg2 + ';',
    '--dsw-static-neutral-bluish-60: ' + bg2 + ';',
    '--dsw-static-neutral-bluish-75: ' + bg2 + ';',
    '--dsw-static-neutral-bluish-100: ' + bg2 + ';',
    '--dsw-static-neutral-bluish-150: ' + bg2 + ';',
    '--dsw-static-neutral-bluish-200: ' + line + ';',
    '--dsw-static-neutral-bluish-250: ' + line + ';',
    '--dsw-static-neutral-bluish-300: ' + line2 + ';',
    '--dsw-static-neutral-bluish-400: ' + fg3 + ';',
    '--dsw-static-neutral-bluish-500: ' + fg3 + ';',
    '--dsw-static-neutral-bluish-550: ' + fg3 + ';',
    '--dsw-static-neutral-bluish-600: ' + fg3 + ';',
    '--dsw-static-neutral-bluish-700: ' + fg2 + ';',
    '--dsw-static-neutral-bluish-750: ' + fg + ';',
    '--dsw-static-neutral-bluish-800: ' + fg + ';',
    '--dsw-static-neutral-bluish-850: ' + fg + ';',
    '--dsw-static-neutral-bluish-875: ' + fg + ';',
    '--dsw-static-neutral-bluish-900: ' + fg + ';',
    '--dsw-static-neutral-bluish-950: ' + fg + ';',
    '--dsw-static-neutral-bluish-1000: ' + fg + ';',
    // neutral (non-bluish) scale
    '--dsw-static-neutral-00: ' + bg + ';',
    '--dsw-static-neutral-50: ' + bg2 + ';',
    '--dsw-static-neutral-100: ' + bg2 + ';',
    '--dsw-static-neutral-150: ' + bg2 + ';',
    '--dsw-static-neutral-200: ' + line + ';',
    '--dsw-static-neutral-250: ' + line + ';',
    '--dsw-static-neutral-300: ' + line2 + ';',
    '--dsw-static-neutral-400: ' + fg3 + ';',
    '--dsw-static-neutral-500: ' + fg3 + ';',
    '--dsw-static-neutral-550: ' + fg3 + ';',
    '--dsw-static-neutral-600: ' + fg3 + ';',
    '--dsw-static-neutral-700: ' + fg2 + ';',
    '--dsw-static-neutral-800: ' + fg + ';',
    '--dsw-static-neutral-850: ' + fg + ';',
    '--dsw-static-neutral-900: ' + fg + ';',
    '--dsw-static-neutral-1000: ' + fg + ';',
    // deepseek brand scale -> accent
    '--dsw-static-deepseek-50: ' + rgba(accent, 0.08) + ';',
    '--dsw-static-deepseek-100: ' + rgba(accent, 0.12) + ';',
    '--dsw-static-deepseek-200: ' + rgba(accent, 0.18) + ';',
    '--dsw-static-deepseek-300: ' + rgba(accent, 0.3) + ';',
    '--dsw-static-deepseek-400: ' + rgbStr(accent) + ';',
    '--dsw-static-deepseek-450: ' + rgbStr(accent) + ';',
    '--dsw-static-deepseek-500: ' + rgbStr(accent) + ';',
    '--dsw-static-deepseek-600: ' + darken(accent, 0.15) + ';',
    '--dsw-static-deepseek-700-delete: ' + darken(accent, 0.25) + ';',
    '--dsw-static-deepseek-800: ' + darken(accent, 0.35) + ';',
    '--dsw-static-deepseek-900: ' + darken(accent, 0.45) + ';',
    // blue scale -> accent-tinted (links / focus rings that use raw blue)
    '--dsw-static-blue-50: ' + rgba(accent, 0.08) + ';',
    '--dsw-static-blue-50p: ' + rgba(accent, 0.08) + ';',
    '--dsw-static-blue-75: ' + rgba(accent, 0.1) + ';',
    '--dsw-static-blue-100: ' + rgba(accent, 0.12) + ';',
    '--dsw-static-blue-300: ' + rgba(accent, 0.3) + ';',
    '--dsw-static-blue-400: ' + rgbStr(accent) + ';',
    '--dsw-static-blue-450: ' + rgbStr(accent) + ';',
    '--dsw-static-blue-500: ' + rgbStr(accent) + ';',
    '--dsw-static-blue-600: ' + darken(accent, 0.15) + ';',
    '--dsw-static-blue-800: ' + darken(accent, 0.35) + ';',
    '--dsw-static-blue-900: ' + darken(accent, 0.45) + ';',
    '--dsw-static-blue-950: ' + darken(accent, 0.55) + ';',
  ].join('\n')

  const body = 'body {\n' + decls + '\n' + statics + '\n}'
  const dark = 'body[data-ds-dark-theme] {\n' + decls + '\n' + statics + '\n}'
  const glowRule =
    'body {\n' +
    '  background-image: radial-gradient(120% 90% at 85% -10%, ' + glow + ', transparent 60%),\n' +
    '    radial-gradient(100% 80% at -10% 110%, ' + rgba(accent, 0.03) + ', transparent 55%);\n' +
    '  background-attachment: fixed;\n' +
    '}'
  const extra = typeof extraCss === 'string' && extraCss.trim() ? '\n' + extraCss : ''
  return [body, dark, glowRule, extra].join('\n')
}

/**
 * Translate one skin's vars into a { css } payload for skin-center.
 * @param {{ vars: Record<string, string|number>, css?: string }} skin
 * @returns {{ css: string }}
 */
export function skinCss(skin) {
  return { css: skinStylesheet(skin && skin.vars ? skin.vars : {}, skin && skin.css) }
}

export const _internal = { hexToRgb, rgbStr, rgba, lighten, darken }
