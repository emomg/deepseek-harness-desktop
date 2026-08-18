// @dsh-desktop/skin-mint · 浏览器端
// 唯一动作：register() 把 薄荷 元数据塞进共享注册表。
// skin-center 卡的 list() 拉到后自动出现在「皮肤中心」。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-mint',
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
      "id": "mint",
      "name": "薄荷",
      "nameEn": "Mint",
      "order": 6,
      "tagline": "米白 + 极低饱和薄荷",
      "description": "米白底配一抹极低饱和薄荷。最轻的「冷色 accent」，适合长时间轻量阅读。",
      "tags": [
        "light",
        "minimal",
        "editorial",
        "cool",
        "accent"
      ],
      "vars": {
        "--dsh-bg-primary": "#f4f6f3",
        "--dsh-bg-secondary": "#e5ebe4",
        "--dsh-bg-elevated": "#fbfcf9",
        "--dsh-fg-primary": "#141a16",
        "--dsh-fg-secondary": "#3c4540",
        "--dsh-fg-tertiary": "#737e76",
        "--dsh-fg-disabled": "#a5aea6",
        "--dsh-border": "rgba(20, 26, 22, 0.07)",
        "--dsh-border-strong": "rgba(20, 26, 22, 0.14)",
        "--dsh-accent": "#5e9275",
        "--dsh-accent-fg": "#ffffff",
        "--dsh-glass-bg": "rgba(244, 246, 243, 0.80)",
        "--dsh-glass-border": "rgba(20, 26, 22, 0.07)",
        "--dsh-glass-blur": 22,
        "--dsh-shadow": "0 1px 2px rgba(20,26,22,.04), 0 8px 24px rgba(20,26,22,.04)",
        "--dsh-glow-1": "rgba(94, 146, 117, 0.06)",
        "--dsh-glow-2": "rgba(94, 146, 117, 0.03)",
        "--dsh-mode": "light"
      }
    };

    var off = register(__skin);
    exports.dispose = off;
    exports.skin = __skin;
    return module.exports;
  },
});
