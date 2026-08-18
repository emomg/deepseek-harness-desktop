// @dsh-desktop/skin-lilac · 浏览器端
// 唯一动作：register() 把 丁香 元数据塞进共享注册表。
// skin-center 卡的 list() 拉到后自动出现在「皮肤中心」。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-lilac',
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
      "id": "lilac",
      "name": "丁香",
      "nameEn": "Lilac",
      "order": 5,
      "tagline": "冷白 + 一抹极低饱和丁香紫",
      "description": "冷白底配一抹极低饱和丁香紫。安静中的一点冷色，绝不抢戏。",
      "tags": [
        "light",
        "minimal",
        "editorial",
        "cool",
        "accent"
      ],
      "vars": {
        "--dsh-bg-primary": "#f7f5f8",
        "--dsh-bg-secondary": "#ece8ef",
        "--dsh-bg-elevated": "#fdfcfe",
        "--dsh-fg-primary": "#1c1820",
        "--dsh-fg-secondary": "#4a4350",
        "--dsh-fg-tertiary": "#857d8c",
        "--dsh-fg-disabled": "#b3acb8",
        "--dsh-border": "rgba(28, 24, 32, 0.07)",
        "--dsh-border-strong": "rgba(28, 24, 32, 0.14)",
        "--dsh-accent": "#7a6592",
        "--dsh-accent-fg": "#ffffff",
        "--dsh-glass-bg": "rgba(247, 245, 248, 0.80)",
        "--dsh-glass-border": "rgba(28, 24, 32, 0.07)",
        "--dsh-glass-blur": 22,
        "--dsh-shadow": "0 1px 2px rgba(28,24,32,.04), 0 8px 24px rgba(28,24,32,.04)",
        "--dsh-glow-1": "rgba(122, 101, 146, 0.06)",
        "--dsh-glow-2": "rgba(122, 101, 146, 0.03)",
        "--dsh-mode": "light"
      }
    };

    var off = register(__skin);
    exports.dispose = off;
    exports.skin = __skin;
    return module.exports;
  },
});
