// @dsh-desktop/skin-mist · 浏览器端
// 唯一动作：register() 把 雾 元数据塞进共享注册表。
// skin-center 卡的 list() 拉到后自动出现在「皮肤中心」。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-mist',
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
      "id": "mist",
      "name": "雾",
      "nameEn": "Mist",
      "order": 4,
      "tagline": "冷感湿润 · 雨意蓝灰 + 墨黑",
      "description": "近冷蓝灰的雨意底色 + 强对比墨黑。安静、专注、不抢戏。",
      "tags": [
        "light",
        "minimal",
        "editorial",
        "cool"
      ],
      "vars": {
        "--dsh-bg-primary": "#eef0f2",
        "--dsh-bg-secondary": "#dfe2e6",
        "--dsh-bg-elevated": "#f6f7f8",
        "--dsh-fg-primary": "#0c1014",
        "--dsh-fg-secondary": "#2c333b",
        "--dsh-fg-tertiary": "#5b6770",
        "--dsh-fg-disabled": "#8a949c",
        "--dsh-border": "rgba(12, 16, 20, 0.08)",
        "--dsh-border-strong": "rgba(12, 16, 20, 0.16)",
        "--dsh-accent": "#0c1014",
        "--dsh-accent-fg": "#ffffff",
        "--dsh-glass-bg": "rgba(238, 240, 242, 0.80)",
        "--dsh-glass-border": "rgba(12, 16, 20, 0.08)",
        "--dsh-glass-blur": 26,
        "--dsh-shadow": "0 1px 2px rgba(12,16,20,.05), 0 8px 28px rgba(12,16,20,.06)",
        "--dsh-glow-1": "rgba(60, 90, 140, 0.05)",
        "--dsh-glow-2": "rgba(60, 90, 140, 0.025)",
        "--dsh-mode": "light"
      }
    };

    var off = register(__skin);
    exports.dispose = off;
    exports.skin = __skin;
    return module.exports;
  },
});
