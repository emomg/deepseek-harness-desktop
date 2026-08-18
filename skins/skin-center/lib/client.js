// @dsh-desktop/skin-center · 客户端插件 v0.1
//!
//! 皮肤中心 GUI 卡：列表 / 试穿 / 应用 / 还原 / 持久化。
//! 皮肤从 @dsh-desktop/shared 注册表读（每款 skin 包 register）。
//! 应用通过 @dsh-desktop/skin-center/lib/apply.js（写 CSS 变量 + body data attr）。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-center',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    // ---- rolldown ESM interop shims ----
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

    let react = require('react');
    react = __toESM(react, 1);
    const { useState, useEffect, useRef, useCallback, createElement: h } = react;

    // ---- imports from @dsh-desktop/shared (via ModuleLoader's local require) ----
    // 同一 bundle 内可访问共享注册表。
    var shared = require('@dsh-desktop/shared');
    shared = __toESM(shared, 1);
    const { list: listSkins, get: getSkin, skinCss } = shared;

    // ---- apply layer ----
    // 浏览器端 apply：写 CSS 变量 + body data attr。
    // 内联实现，避免跨包 import 复杂度。
    const DEFAULT_VARS = {
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
    };

    function writeVars(vars) {
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      for (const k in vars) root.style.setProperty(k, String(vars[k]));
    }
    function readVars() {
      if (typeof document === 'undefined') return { ...DEFAULT_VARS };
      const root = document.documentElement;
      const cs = root.style;
      const out = {};
      for (const k in DEFAULT_VARS) {
        const v = cs.getPropertyValue(k).trim();
        out[k] = v === '' ? DEFAULT_VARS[k] : v;
      }
      return out;
    }

    // 应用状态：当前已应用 / 试穿快照
    const state = {
      appliedId: /** @type {string|null} */ (null),
      snapshot: /** @type {{vars: any, skinId: string|null} | null} */ (null),
      extraStyleId: /** @type {string|null} */ (null),
      dswStyleId: /** @type {string|null} */ (null),
    };

    // DSH Web UI 官方 --dsw-* 令牌覆写样式（皮肤真正作用于真实界面）。
    // 注入位置在 head 末尾，晚于官方 design-platform.css，同特异性后者胜出；
    // 同时覆盖 body[data-ds-dark-theme]，让 light 皮肤在系统深色偏好下也生效。
    function writeDswStyle(skin) {
      if (typeof document === 'undefined') return;
      if (state.dswStyleId) {
        const old = document.getElementById(state.dswStyleId);
        if (old) old.remove();
        state.dswStyleId = null;
      }
      if (!skin || !skin.vars) return;
      const { css } = skinCss(skin);
      state.dswStyleId = 'dsh-desktop-dsw-' + skin.id;
      const tag = document.createElement('style');
      tag.id = state.dswStyleId;
      tag.dataset.skin = skin.id;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    function applySkin(skin) {
      if (!skin || !skin.vars) return false;
      writeVars({ ...DEFAULT_VARS, ...skin.vars });
      if (typeof document !== 'undefined') document.documentElement.dataset.dshSkin = skin.id;
      writeDswStyle(skin);
      // inject extra css
      if (typeof document !== 'undefined') {
        if (state.extraStyleId) {
          const old = document.getElementById(state.extraStyleId);
          if (old) old.remove();
          state.extraStyleId = null;
        }
        if (skin.css) {
          state.extraStyleId = 'dsh-desktop-skin-css-' + skin.id;
          const tag = document.createElement('style');
          tag.id = state.extraStyleId;
          tag.dataset.skin = skin.id;
          tag.textContent = skin.css;
          document.head.appendChild(tag);
        }
      }
      state.appliedId = skin.id;
      return true;
    }

    function tryOn(skin) {
      if (state.snapshot === null) {
        state.snapshot = { vars: readVars(), skinId: state.appliedId };
      }
      applySkin(skin);
    }

    function restore() {
      if (state.snapshot !== null) {
        writeVars(state.snapshot.vars);
        if (typeof document !== 'undefined') {
          if (state.snapshot.skinId) {
            document.documentElement.dataset.dshSkin = state.snapshot.skinId;
          } else {
            delete document.documentElement.dataset.dshSkin;
          }
        }
        if (state.extraStyleId) {
          const old = document.getElementById(state.extraStyleId);
          if (old) old.remove();
          state.extraStyleId = null;
        }
        if (state.dswStyleId) {
          const old = document.getElementById(state.dswStyleId);
          if (old) old.remove();
          state.dswStyleId = null;
        }
        state.appliedId = state.snapshot.skinId;
        state.snapshot = null;
      }
    }

    // ---- 持久化 ----
    const PERSIST_KEY = 'dsh-desktop.skin.v1';
    function loadApplied() {
      try {
        const v = localStorage.getItem(PERSIST_KEY);
        return v ? JSON.parse(v) : null;
      } catch { return null; }
    }
    function saveApplied(id) {
      try { localStorage.setItem(PERSIST_KEY, JSON.stringify({ id, ts: Date.now() })); } catch { /* ignore */ }
    }

    // ---- 启动时恢复 ----
    if (typeof document !== 'undefined') {
      const saved = loadApplied();
      if (saved && saved.id) {
        // 注册表可能还没准备好（皮肤包异步加载），给一个微任务重试
        const tryRestore = () => {
          const s = getSkin(saved.id);
          if (s) applySkin(s);
        };
        tryRestore();
        Promise.resolve().then(tryRestore).then(() => setTimeout(tryRestore, 0));
      } else {
        // 写默认 token
        writeVars(DEFAULT_VARS);
      }
    }

    // ---- 样式（用新的 --dsh-* token，不依赖 --dsw-alias-*） ----
    const CSS_ID = 'dsh-desktop-skin-center-css';
    if (typeof document !== 'undefined' && document.getElementById(CSS_ID) === null) {
      const tag = document.createElement('style');
      tag.id = CSS_ID;
      tag.dataset.plugin = '@dsh-desktop/skin-center';
      tag.textContent = `
.ddsc-section{display:flex;flex-direction:column;gap:14px;width:100%;max-width:780px;color:var(--dsh-fg-primary);font-family:inherit;font-size:13px}
.ddsc-hint{font-size:12px;line-height:1.7;color:var(--dsh-fg-secondary);padding:8px 12px;border:1px dashed var(--dsh-border-strong);border-radius:10px}
.ddsc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.ddsc-card{display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--dsh-bg-secondary);border:1px solid var(--dsh-border);border-radius:12px;transition:border-color .12s,box-shadow .12s}
.ddsc-card.on{border-color:var(--dsh-accent);box-shadow:0 0 0 1px var(--dsh-accent)}
.ddsc-card.trying{box-shadow:0 0 0 2px var(--dsh-accent)}
.ddsc-prev{height:96px;border-radius:8px;overflow:hidden;position:relative;border:1px solid var(--dsh-border);flex:none;background:var(--dsh-bg-elevated)}
.ddsc-prev-tag{position:absolute;top:6px;left:8px;font-size:10px;padding:1px 6px;border-radius:4px;background:var(--dsh-bg-elevated);color:var(--dsh-fg-tertiary);font-family:"Cascadia Code",Consolas,monospace;letter-spacing:.04em}
.ddsc-prev-glow{position:absolute;inset:0;background:radial-gradient(120% 90% at 88% -10%, var(--dsh-glow-1), transparent 60%),radial-gradient(100% 80% at -8% 110%, var(--dsh-glow-2), transparent 55%)}
.ddsc-prev-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dsh-fg-primary);font-size:18px;font-weight:600;letter-spacing:.04em}
.ddsc-name{font-size:13px;font-weight:600;line-height:1.4;color:var(--dsh-fg-primary)}
.ddsc-name-en{font-size:11px;color:var(--dsh-fg-tertiary);font-family:"Cascadia Code",Consolas,monospace;letter-spacing:.04em}
.ddsc-tagline{font-size:12px;color:var(--dsh-fg-secondary);line-height:1.5;min-height:2.6em}
.ddsc-actions{display:flex;gap:6px;margin-top:auto}
.ddsc-btn{font-family:inherit;font-size:12px;background:var(--dsh-bg-elevated);color:var(--dsh-fg-primary);border:1px solid var(--dsh-border);border-radius:8px;padding:4px 10px;cursor:pointer;line-height:1.5;transition:background .1s,border-color .1s}
.ddsc-btn:hover{background:var(--dsh-bg-secondary);border-color:var(--dsh-border-strong)}
.ddsc-btn.primary{background:var(--dsh-accent);color:var(--dsh-accent-fg);border-color:transparent}
.ddsc-btn.primary:hover{filter:brightness(1.08)}
.ddsc-btn.sm{padding:2px 8px;font-size:11px}
.ddsc-notice{font-size:12px;color:var(--dsh-fg-secondary);padding:6px 10px;background:var(--dsh-bg-secondary);border-radius:8px;border-left:2px solid var(--dsh-accent)}
.ddsc-bar{position:sticky;bottom:0;display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:4px;background:var(--dsh-bg-elevated);border:1px dashed var(--dsh-border-strong);border-radius:10px;font-size:12px;color:var(--dsh-fg-primary)}
.ddsc-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.ddsc-pill{font-size:10px;padding:1px 6px;border-radius:5px;background:var(--dsh-bg-elevated);color:var(--dsh-fg-tertiary);font-family:"Cascadia Code",Consolas,monospace}
.ddsc-empty{font-size:12px;color:var(--dsh-fg-tertiary);padding:24px 12px;text-align:center;line-height:1.8}
`;
      document.head.appendChild(tag);
    }

    // ---- 卡片组件 ----
    function SkinCenterCard() {
      const [trying, setTrying] = useState(/** @type {string|null} */ (null));
      const [appliedId, setAppliedId] = useState(() => {
        const saved = loadApplied();
        return (saved && saved.id) || null;
      });
      const [notice, setNotice] = useState('');
      // 拉一次注册表；如未来注册表动态变化，可加 useSyncExternalStore
      const [skins, setSkins] = useState(() => listSkins());
      useEffect(() => {
        // 简单的轮询：注册表可能在皮肤包加载完后变化
        const t = setInterval(() => {
          const next = listSkins();
          if (next.length !== skins.length) setSkins(next);
        }, 200);
        return () => clearInterval(t);
      }, [skins.length]);

      useEffect(() => () => restore(), []);

      const onTry = useCallback((skin) => {
        tryOn(skin);
        setTrying(skin.id);
        setNotice('正在试穿「' + skin.name + '」');
      }, []);
      const onRestore = useCallback(() => {
        restore();
        setTrying(null);
        setNotice('已完全还原为应用前的样式');
      }, []);
      const onApply = useCallback((skin) => {
        applySkin(skin);
        saveApplied(skin.id);
        setAppliedId(skin.id);
        setTrying(null);
        setNotice('已应用「' + skin.name + '」');
      }, []);

      if (skins.length === 0) {
        return h('div', { className: 'ddsc-section' }, [
          h('div', { className: 'ddsc-hint' }, '皮肤中心已启用，但当前未注册任何皮肤。安装任一 @dsh-desktop/skin-* 包后刷新即可在此选择。'),
        ]);
      }

      return h('div', { className: 'ddsc-section' }, [
        h('div', { className: 'ddsc-hint' },
          '6 款极简 editorial 原创皮肤，支持先试穿再应用：点「试穿」即时生效，离开本页或点「退出试穿」完全还原，满意再点「应用」一键保存。'),
        notice ? h('div', { className: 'ddsc-notice' }, notice) : null,
        h('div', { className: 'ddsc-grid' },
          skins.map((s) => {
            const isApplied = trying === null && appliedId === s.id;
            const isTrying = trying === s.id;
            const mode = s.vars && s.vars['--dsh-mode'] === 'dark' ? 'dark' : 'light';
            return h('div', {
              className: 'ddsc-card' + (isApplied ? ' on' : '') + (isTrying ? ' trying' : ''),
              key: s.id,
            }, [
              h('div', { className: 'ddsc-prev' }, [
                h('div', { className: 'ddsc-prev-glow' }),
                h('div', { className: 'ddsc-prev-tag' }, s.id + ' · ' + mode),
                h('div', { className: 'ddsc-prev-text' }, s.name),
              ]),
              h('div', { className: 'ddsc-name' }, s.name + (isApplied ? ' · 当前' : '') + (isTrying ? ' · 试穿中' : '')),
              h('div', { className: 'ddsc-name-en' }, s.nameEn),
              h('div', { className: 'ddsc-tagline' }, s.tagline),
              h('div', { className: 'ddsc-tags' },
                (s.tags || []).map((t) => h('span', { className: 'ddsc-pill', key: t }, t))
              ),
              h('div', { className: 'ddsc-actions' }, [
                h('button', { className: 'ddsc-btn sm', onClick: () => onTry(s) }, '试穿'),
                h('button', { className: 'ddsc-btn sm primary', onClick: () => onApply(s) }, '应用'),
              ]),
            ]);
          })),
        trying ? h('div', { className: 'ddsc-bar' }, [
          h('span', null, '试穿中 —— 离开本页或点「退出试穿」即完全还原'),
          h('button', { className: 'ddsc-btn sm', onClick: onRestore }, '退出试穿'),
        ]) : null,
      ]);
    }

    // ---- i18n ----
    const NS = '@dsh-desktop/skin-center';
    const zh = {
      'settings.skins': '皮肤中心',
      'skins.empty': '皮肤中心已启用，但当前未注册任何皮肤。安装任一 @dsh-desktop/skin-* 包后刷新即可在此选择。',
      'skins.hint': '6 款极简 editorial 原创皮肤，支持先试穿再应用：点「试穿」即时生效，离开本页或点「退出试穿」完全还原，满意再点「应用」一键保存。',
      'skins.try': '试穿',
      'skins.apply': '应用',
      'skins.restore': '退出试穿',
      'skins.current': '当前',
      'skins.trying': '试穿中',
      'skins.applied': '已应用',
      'skins.restored': '已完全还原为应用前的样式',
      'skins.tryingBar': '试穿中 —— 离开本页或点「退出试穿」即完全还原',
    };
    const en = {
      'settings.skins': 'Skins',
      'skins.empty': 'Skin center is enabled, but no skins are registered. Install any @dsh-desktop/skin-* package and reload to choose here.',
      'skins.hint': '6 original minimal editorial skins, all try-before-apply: Try applies instantly, leaving this page or Restore fully reverts, Apply saves with one click.',
      'skins.try': 'Try',
      'skins.apply': 'Apply',
      'skins.restore': 'Exit try-on',
      'skins.current': 'current',
      'skins.trying': 'trying',
      'skins.applied': 'Applied',
      'skins.restored': 'Fully restored to the previous style',
      'skins.tryingBar': 'Trying on - leaving this page or Exit try-on fully reverts',
    };

    const inject = ['slots', 'locale'];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-desktop-skin-center: dictionaries');
      // 注入设置项
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'skins',
        order: 9,
        label: () => ctx.locale.t('@dsh-desktop/skin-center', 'settings.skins'),
      }, () => h(SkinCenterCard)));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
