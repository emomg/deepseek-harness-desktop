// @dsh-desktop/skin-graphite · 浏览器端
// 唯一动作：register() 把 石墨 元数据塞进共享注册表。
// skin-center 卡的 list() 拉到后自动出现在「皮肤中心」。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-graphite',
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
    var __skin = {
      "id": "graphite",
      "name": "石墨",
      "nameEn": "Graphite",
      "order": 2,
      "tagline": "极简灰阶 + 一抹墨黑 + 高对比",
      "description": "更深的冷灰底 + 强对比。编辑工作、文字密集、想集中注意力时的默认。",
      "tags": [
        "light",
        "minimal",
        "editorial",
        "focus"
      ],
      "vars": {
        "--dsh-bg-primary": "#ececeb",
        "--dsh-bg-secondary": "#dededd",
        "--dsh-bg-elevated": "#f4f4f3",
        "--dsh-fg-primary": "#0e0e0e",
        "--dsh-fg-secondary": "#3a3a3a",
        "--dsh-fg-tertiary": "#6e6e6e",
        "--dsh-fg-disabled": "#a4a4a4",
        "--dsh-border": "rgba(0, 0, 0, 0.10)",
        "--dsh-border-strong": "rgba(0, 0, 0, 0.18)",
        "--dsh-accent": "#0e0e0e",
        "--dsh-accent-fg": "#ffffff",
        "--dsh-glass-bg": "rgba(236, 236, 235, 0.82)",
        "--dsh-glass-border": "rgba(0, 0, 0, 0.10)",
        "--dsh-glass-blur": 24,
        "--dsh-shadow": "0 1px 2px rgba(0,0,0,.06), 0 8px 28px rgba(0,0,0,.06)",
        "--dsh-glow-1": "rgba(0, 0, 0, 0.04)",
        "--dsh-glow-2": "rgba(0, 0, 0, 0.02)",
        "--dsh-mode": "light"
      }
    };

    var off = register(__skin);
    exports.dispose = off;
    exports.skin = __skin;
    return module.exports;
  },
});
