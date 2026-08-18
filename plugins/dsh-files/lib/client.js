// dsh-files client half — 手写 loader 格式（零构建）。
// composer 回形针按钮（conversation.input.left）+ 附件卡片（conversation.input.dock）
// + 整页拖拽上传；上传成功后把文件路径插入输入框（slash/input-insert-reference）。

window.__ModuleLoader__.load({
  id: 'dsh-files',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // ---- rolldown ESM interop shims ----
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
    const { useState, useEffect, useRef, useSyncExternalStore, createElement: h } = react;

    // ------------------------------------------------------------ 常量与样式
    const SOURCE_NAME = 'dsh-files';
    const STYLE_TAG = 'dsh-files/style.css';
    const UPLOAD_URL = '/api/files';

    const CSS = `
.dsh-files-btn{border:none;background:transparent;color:var(--dsw-alias-label-secondary,currentColor);cursor:pointer;border-radius:6px;padding:4px;display:inline-flex;align-items:center;justify-content:center;line-height:0}
.dsh-files-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary,currentColor)}
.dsh-files-btn:disabled{opacity:.45;cursor:default}
.dsh-files-dock{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));max-width:calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));margin:0 auto 6px;padding:0 var(--dsh-composer-dock-inset);display:flex;flex-wrap:wrap;gap:8px;flex:none}
.dsh-files-card{position:relative;flex-direction:column;align-items:center;gap:5px;width:88px;flex:none;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,rgba(127,127,127,.22));background:var(--dsw-specific-input-major,var(--dsw-alias-surface-2,rgba(127,127,127,.08)));border-radius:12px;padding:12px 8px 9px;box-shadow:var(--dsw-shadow-lv1,0 1px 2px rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,inherit)}
.dsh-files-badge{width:44px;height:56px;border-radius:6px;color:#fff;font-size:12px;font-weight:700;font-family:var(--ds-font-family-code,monospace);display:inline-flex;align-items:center;justify-content:center;letter-spacing:.5px;flex:none;box-shadow:inset 0 -10px 14px rgba(0,0,0,.14),inset 0 10px 12px rgba(255,255,255,.16)}
.dsh-files-name{width:100%;font-size:12px;line-height:16px;text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all}
.dsh-files-size{color:var(--dsw-alias-label-tertiary,inherit);font-size:10.5px;flex:none}
.dsh-files-remove{border:none;background:transparent;color:var(--dsw-alias-label-tertiary,inherit);cursor:pointer;padding:2px;border-radius:4px;display:inline-flex;line-height:0;flex:none}
.dsh-files-remove:hover{color:var(--dsw-alias-label-primary,inherit);background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
.dsh-files-card>.dsh-files-remove{position:absolute;top:4px;right:4px}
.dsh-files-error{display:inline-flex;align-items:center;gap:8px;max-width:100%;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,rgba(127,127,127,.22));background:var(--dsw-alias-interactive-bg-hover-danger,rgba(216,97,97,.14));color:var(--dsw-alias-state-error-primary,#d86161);border-radius:10px;padding:6px 8px 6px 10px;font-size:13px}
.dsh-files-error-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px}
body.dsh-files-dragging:after{content:'松开以上传文件';position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:#fff;background:rgba(0,0,0,.45);z-index:9999;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.5)}
`;

    function injectCss() {
      if (typeof document === 'undefined') return;
      if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG)}]`) !== null) return;
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-files';
      tag.dataset.pluginCss = STYLE_TAG;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ------------------------------------------------------------ 上传状态
    const uploadMeta = new Map();
    let uploadError = null;
    let errorSeq = 0;
    const errorListeners = new Set();

    function subscribeErrors(listener) {
      errorListeners.add(listener);
      return () => { errorListeners.delete(listener); };
    }
    function setUploadError(text) {
      uploadError = { seq: ++errorSeq, text };
      for (const l of [...errorListeners]) l();
    }
    function clearUploadError() {
      uploadError = null;
      for (const l of [...errorListeners]) l();
    }

    function badgeStyle(name, sniffed) {
      if (sniffed === 'pdf') return { bg: '#C93B2E', ext: 'PDF' };
      if (sniffed === 'docx') return { bg: '#2B579A', ext: 'DOC' };
      if (sniffed === 'xlsx') return { bg: '#217346', ext: 'XLS' };
      if (sniffed === 'text') return { bg: '#757575', ext: 'TXT' };
      if (sniffed === null) return { bg: '#5B7DB1', ext: 'FILE' };
      const ext = name.slice(name.lastIndexOf('.') + 1).toUpperCase().slice(0, 4);
      const lower = ext.toLowerCase();
      if (lower === 'pdf') return { bg: '#C93B2E', ext: 'PDF' };
      if (lower === 'docx' || lower === 'doc') return { bg: '#2B579A', ext: 'DOC' };
      if (lower === 'xlsx' || lower === 'xls' || lower === 'csv') return { bg: '#217346', ext: 'XLS' };
      if (lower === 'txt' || lower === 'md') return { bg: '#757575', ext: 'TXT' };
      return { bg: '#5B7DB1', ext: ext === '' ? 'FILE' : ext };
    }

    function formatBytes(n) {
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }

    function nameFromPath(path) {
      const base = path.slice(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1);
      return base === '' ? path : base;
    }

    function httpErrorText(status) {
      if (status === 413) return '文件超过大小限制';
      if (status === 415) return '文件类型不被允许';
      if (status === 403) return '会话校验失败，请刷新页面重试';
      if (status === 429) return '上传太频繁，请稍后再试';
      if (status === 507) return '会话存储配额已满，请删除一些文件';
      return `HTTP ${status}`;
    }

    // ------------------------------------------------------------ 上传逻辑
    async function attachFile(actx, file, sessionId) {
      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: {
          'x-file-name': encodeURIComponent(file.name),
          'x-session-id': sessionId
        },
        body: file
      });
      if (!res.ok) {
        let detail = httpErrorText(res.status);
        try {
          const payload = await res.json();
          if (typeof payload.error === 'string') detail = payload.error;
        } catch { /* keep status text */ }
        throw new Error(`${file.name}: ${detail}`);
      }
      const payload = await res.json();
      if (typeof payload.path !== 'string') throw new Error('missing path in response');
      const name = payload.name ?? file.name;
      uploadMeta.set(payload.path, {
        name,
        bytes: payload.bytes ?? file.size,
        sniffed: 'sniffedFormat' in payload ? (payload.sniffedFormat ?? null) : undefined
      });
      clearUploadError();
      const inserted = await insertReference(actx, payload.path, name);
      if (!inserted) setUploadError(`文件已上传但未能加入输入框: ${payload.path}`);
    }

    async function insertReference(actx, ref, label) {
      try {
        const conversation = actx.get('conversation');
        if (!conversation || !conversation.input) return false;
        const input = conversation.input.for(actx);
        const state = input.state.getSnapshot();
        const span = { start: state.draft.length, end: state.draft.length, draftRev: state.draftRev };
        actx.emit('slash/input-insert-reference', {
          reference: { source: SOURCE_NAME, ref, label, clipboardText: ref },
          span
        });
        return true;
      } catch (e) {
        console.error('[dsh-files] insertReference failed:', e);
        return false;
      }
    }

    // ------------------------------------------------------------ 回形针按钮
    function UploadButton(props) {
      const [busy, setBusy] = useState(false);
      const inputRef = useRef(null);
      const attachRef = useRef(props.attach);
      attachRef.current = props.attach;

      useEffect(() => {
        let dragDepth = 0;
        const isFileDrag = (e) => e.dataTransfer?.types?.includes('Files') ?? false;
        const onDragOver = (e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          dragDepth += 1;
          document.body.classList.add('dsh-files-dragging');
        };
        const onDragLeave = (e) => {
          if (!isFileDrag(e)) return;
          if (e.relatedTarget !== null) return;
          dragDepth = Math.max(0, dragDepth - 1);
          if (dragDepth === 0) document.body.classList.remove('dsh-files-dragging');
        };
        const onDrop = (e) => {
          const files = Array.from(e.dataTransfer?.files ?? []);
          if (files.length === 0) return;
          e.preventDefault();
          dragDepth = 0;
          document.body.classList.remove('dsh-files-dragging');
          setBusy(true);
          void (async () => {
            for (const file of files) {
              try { await attachRef.current(file); } catch { /* dock banner */ }
            }
            setBusy(false);
          })();
        };
        const onDragEnd = () => {
          dragDepth = 0;
          document.body.classList.remove('dsh-files-dragging');
        };
        document.addEventListener('dragover', onDragOver);
        document.addEventListener('dragleave', onDragLeave);
        document.addEventListener('drop', onDrop);
        document.addEventListener('dragend', onDragEnd);
        return () => {
          document.removeEventListener('dragover', onDragOver);
          document.removeEventListener('dragleave', onDragLeave);
          document.removeEventListener('drop', onDrop);
          document.removeEventListener('dragend', onDragEnd);
          document.body.classList.remove('dsh-files-dragging');
        };
      }, []);

      const pick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        inputRef.current = input;
        input.onchange = () => {
          const files = Array.from(input.files ?? []);
          input.remove();
          inputRef.current = null;
          if (files.length === 0) return;
          setBusy(true);
          void (async () => {
            for (const file of files) {
              try { await attachRef.current(file); } catch { /* dock banner */ }
            }
            setBusy(false);
          })();
        };
        input.click();
      };

      const icon = h('svg', {
        width: '16', height: '16', viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', style: { display: 'block' }
      }, h('path', {
        d: 'M5.5498 9.75V5H6.9502V9.75C6.9502 10.3299 7.4201 10.7998 8 10.7998C8.5799 10.7998 9.0498 10.3299 9.0498 9.75V4.5C9.0498 2.9536 7.7964 1.7002 6.25 1.7002C4.7036 1.7002 3.4502 2.9536 3.4502 4.5V9.75C3.4502 12.2629 5.4871 14.2998 8 14.2998C10.5129 14.2998 12.5498 12.2629 12.5498 9.75V4H13.9502V9.75C13.9502 13.0361 11.2861 15.7002 8 15.7002C4.71391 15.7002 2.0498 13.0361 2.0498 9.75V4.5C2.04981 2.1804 3.9304 0.299806 6.25 0.299805C8.5696 0.299805 10.4502 2.1804 10.4502 4.5V9.75C10.4502 11.1031 9.3531 12.2002 8 12.2002C6.6469 12.2002 5.5498 11.1031 5.5498 9.75Z',
        fill: 'currentColor'
      }));

      return h('button', {
        type: 'button',
        className: 'dsh-files-btn',
        'aria-label': busy ? '上传中…' : '上传文件',
        title: busy ? '上传中…' : '上传文件（PDF/Word/Excel/TXT，或直接拖拽）',
        disabled: busy,
        onClick: pick
      }, icon);
    }

    // ------------------------------------------------------------ 附件卡片
    function UploadDock(props) {
      const state = props.useInput ? props.useInput((s) => s) : null;
      const error = useSyncExternalStore(subscribeErrors, () => uploadError);
      const draft = state?.draft ?? '';
      const ours = (state?.occurrences ?? []).filter((o) => o.source === SOURCE_NAME);
      const refs = ours.map((o) => o.ref).join('\n');

      useEffect(() => {
        const live = new Set(refs.split('\n').filter((r) => r !== ''));
        for (const key of [...uploadMeta.keys()]) {
          if (!live.has(key)) uploadMeta.delete(key);
        }
      }, [refs]);

      if (ours.length === 0 && error === null) return null;

      const removeCard = (ref, offset) => {
        let end = offset;
        while (end < draft.length && !/\s/.test(draft[end])) end += 1;
        props.inputActions?.setDraft(draft.slice(0, offset) + draft.slice(end));
        uploadMeta.delete(ref);
        void fetch(`${UPLOAD_URL}?path=${encodeURIComponent(ref)}`, { method: 'DELETE' }).catch(() => {});
      };

      return h('div', { className: 'dsh-files-dock' },
        error !== null && h('div', { className: 'dsh-files-error', role: 'alert' },
          h('span', { className: 'dsh-files-error-text', title: error.text }, error.text),
          h('button', { type: 'button', className: 'dsh-files-remove', 'aria-label': '关闭错误提示', onClick: clearUploadError }, h('span', { style: { fontSize: '11px', lineHeight: '11px' } }, '✕'))
        ),
        ours.map((occ) => {
          const meta = uploadMeta.get(occ.ref);
          const name = meta?.name ?? nameFromPath(occ.ref);
          const { bg, ext } = badgeStyle(name, meta?.sniffed);
          return h('div', { className: 'dsh-files-card', key: occ.occurrenceId },
            h('span', { className: 'dsh-files-badge', style: { background: bg } }, ext),
            h('span', { className: 'dsh-files-name', title: occ.ref }, name),
            meta !== undefined && meta.bytes > 0 && h('span', { className: 'dsh-files-size' }, formatBytes(meta.bytes)),
            h('button', { type: 'button', className: 'dsh-files-remove', 'aria-label': '移除', onClick: () => removeCard(occ.ref, occ.offset) }, h('span', { style: { fontSize: '11px', lineHeight: '11px' } }, '✕'))
          );
        })
      );
    }

    // ------------------------------------------------------------ 插件体
    const inject = ['slots', 'sessions'];

    function apply(ctx) {
      injectCss();
      const slots = ctx.get('slots');
      const sessions = ctx.get('sessions');
      if (!slots) return;

      slots.inject('conversation.input.left', () =>
        slots.register({
          name: 'conversation.input.left',
          id: 'dsh-files-button',
          order: 0,
          inject: (sessionId) => ({
            attach: (file) => attachFile(sessions.scope(sessionId), file, sessionId)
          })
        }, UploadButton)
      );

      slots.inject('conversation.input.dock', () =>
        slots.register({
          name: 'conversation.input.dock',
          id: 'dsh-files-dock',
          order: 5
        }, UploadDock)
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
