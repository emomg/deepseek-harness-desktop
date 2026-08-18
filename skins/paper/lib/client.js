// @dsh-desktop/skin-paper · 浏览器端
// 唯一动作：register() 把 宣纸 元数据塞进共享注册表。
// skin-center 卡的 list() 拉到后自动出现在「皮肤中心」。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-paper',
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
      "id": "paper",
      "name": "宣纸",
      "nameEn": "Paper",
      "order": 3,
      "tagline": "米白 + 朱砂一抹（暖底冷顶）",
      "description": "略带暖意的米白底，配一抹朱砂色 accent。最有手感的「纸」，适合长读与写作。",
      "tags": [
        "light",
        "minimal",
        "editorial",
        "warm"
      ],
      "vars": {
        "--dsh-bg-primary": "#f5efe5",
        "--dsh-bg-secondary": "#ebe4d6",
        "--dsh-bg-elevated": "#fbf8f0",
        "--dsh-fg-primary": "#1f1b16",
        "--dsh-fg-secondary": "#524a3e",
        "--dsh-fg-tertiary": "#8a7f6e",
        "--dsh-fg-disabled": "#b6ad9c",
        "--dsh-border": "rgba(31, 27, 22, 0.08)",
        "--dsh-border-strong": "rgba(31, 27, 22, 0.16)",
        "--dsh-accent": "#b8434a",
        "--dsh-accent-fg": "#ffffff",
        "--dsh-glass-bg": "rgba(245, 239, 229, 0.80)",
        "--dsh-glass-border": "rgba(31, 27, 22, 0.08)",
        "--dsh-glass-blur": 22,
        "--dsh-shadow": "0 1px 2px rgba(31,27,22,.05), 0 8px 24px rgba(31,27,22,.05)",
        "--dsh-glow-1": "rgba(184, 67, 74, 0.08)",
        "--dsh-glow-2": "rgba(184, 67, 74, 0.04)",
        "--dsh-mode": "light"
      }
    };

    var off = register(__skin);
    exports.dispose = off;
    exports.skin = __skin;
    return module.exports;
  },
});
