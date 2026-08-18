// @dsh-desktop/skin-bone-white · 浏览器端
// 唯一动作：register() 把 骨白 元数据塞进共享注册表。
// skin-center 卡的 list() 拉到后自动出现在「皮肤中心」。

window.__ModuleLoader__.load({
  id: '@dsh-desktop/skin-bone-white',
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
      "id": "bone-white",
      "name": "骨白",
      "nameEn": "Bone White",
      "order": 1,
      "tagline": "冷白底 + 大量负空间 + 一抹墨黑",
      "description": "极简 clean editorial 基线：冷白底配上一抹墨黑，大量负空间留给工作本身。默认皮肤，最克制的入门。",
      "tags": [
        "light",
        "minimal",
        "editorial",
        "default"
      ],
      "vars": {
        "--dsh-bg-primary": "#fafaf7",
        "--dsh-bg-secondary": "#f3f1ec",
        "--dsh-bg-elevated": "#ffffff",
        "--dsh-fg-primary": "#1a1a1a",
        "--dsh-fg-secondary": "#4a4a48",
        "--dsh-fg-tertiary": "#8a8a86",
        "--dsh-fg-disabled": "#b8b8b4",
        "--dsh-border": "rgba(0, 0, 0, 0.06)",
        "--dsh-border-strong": "rgba(0, 0, 0, 0.12)",
        "--dsh-accent": "#1a1a1a",
        "--dsh-accent-fg": "#ffffff",
        "--dsh-glass-bg": "rgba(250, 250, 247, 0.78)",
        "--dsh-glass-border": "rgba(0, 0, 0, 0.06)",
        "--dsh-glass-blur": 22,
        "--dsh-shadow": "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.04)",
        "--dsh-glow-1": "rgba(0, 0, 0, 0.03)",
        "--dsh-glow-2": "rgba(0, 0, 0, 0.015)",
        "--dsh-mode": "light"
      }
    };

    var off = register(__skin);
    exports.dispose = off;
    exports.skin = __skin;
    return module.exports;
  },
});
