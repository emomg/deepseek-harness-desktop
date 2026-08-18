// dsh-plugin-image-input client half — 手写 loader 格式（零构建）。
// 原生 composer 已支持图片粘贴/拖拽（draft images），本插件主要工作在 Host 端
// （prompt admission 桥接 + vision 工具）。客户端补充：
//   1. conversation.input.dock：显示当前会话视觉端点配置状态（未配置时提示）
//   2. 说明文案：纯文本模型下粘贴图片会被自动保存并交由 vision 工具识图

window.__ModuleLoader__.load({
  id: 'dsh-plugin-image-input',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __copyProps = (to, from, except, desc) => {
      if (from && (typeof from === "object" || typeof from === "function")) {
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
      __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod)
    );

    let react = require("react");
    react = __toESM(react, 1);
    const { useState, useEffect, createElement: h } = react;

    const CSS = `
.dsh-image-input-note{display:flex;align-items:center;gap:8px;max-width:100%;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,rgba(127,127,127,.22));background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08));color:var(--dsw-alias-label-secondary,#adb2b8);border-radius:10px;padding:6px 8px 6px 10px;font-size:12.5px}
.dsh-image-input-note strong{color:var(--dsw-alias-label-primary,inherit)}
.dsh-image-input-note .warn{color:var(--dsw-alias-state-warn-primary,#e6a23c)}
`;

    function injectCss() {
      if (typeof document === 'undefined') return;
      if (document.querySelector('style[data-plugin="dsh-plugin-image-input"]')) return;
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-plugin-image-input';
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // 视觉端点状态（Host 端提供 /api/image-input/status）
    let visionStatus = { checked: false, ready: false, baseUrl: '', model: '' };
    const statusListeners = new Set();
    function subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => { statusListeners.delete(listener); };
    }
    function setStatus(s) {
      visionStatus = { checked: true, ...s };
      for (const l of [...statusListeners]) l();
    }

    function ImageInputDock() {
      const [status, setLocalStatus] = useState(visionStatus);
      useEffect(() => {
        const off = subscribeStatus(setLocalStatus);
        if (!visionStatus.checked) {
          fetch('/api/image-input/status').then((r) => r.json()).then((s) => setStatus(s)).catch(() => setStatus({ checked: true, ready: false }));
        }
        return off;
      }, []);
      if (!status.checked) return null;
      if (status.ready) {
        return h('div', { className: 'dsh-image-input-note', style: { marginBottom: '6px' } },
          h('span', null, '🖼️ '),
          h('span', null,
            h('strong', null, '图片识图已就绪'),
            `：粘贴/拖拽图片后将由视觉模型 ${status.model || '(未命名)'} 分析`
          )
        );
      }
      return h('div', { className: 'dsh-image-input-note', style: { marginBottom: '6px' } },
        h('span', null, '🖼️ '),
        h('span', null,
          h('strong', { className: 'warn' }, '图片识图未配置'),
          '：可直接粘贴/拖拽图片（会保存为本地路径），但要获得视觉描述需设置 IMAGE_VISION_BASE_URL / IMAGE_VISION_MODEL / IMAGE_VISION_API_KEY'
        )
      );
    }

    const inject = ['slots'];

    function apply(ctx) {
      injectCss();
      const slots = ctx.get('slots');
      if (!slots) return;
      slots.inject('conversation.input.dock', () =>
        slots.register({
          name: 'conversation.input.dock',
          id: 'dsh-image-input-note',
          order: 4
        }, ImageInputDock)
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
