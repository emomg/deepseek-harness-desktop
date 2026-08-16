//! @dsh-pro/desktop · 客户端插件 v2（手写 loader 格式，无构建）
//!
//! 产品模型（用户确认）：
//!   - 功能框 = 一个 DSH 会话；会话头部 = 该功能的版本控制器（快照/版本/上传）
//!   - 自动快照：每轮任务完成自动打一次（宿主端监听 agent/turn-stopping）
//!   - 总版本控制器（侧边栏底部入口）：按工作区归类 → 会话（功能框）→ 版本；统一上传/删除/回滚
//!   - AI 生成内容：快照自动排除（宿主累积交付物），源码用 DSH 原生 chips 查看
//! 界面使用 DSH 主题 CSS 变量（--dsw-alias-*），原生观感。

window.__ModuleLoader__.load({
  id: "@dsh-pro/desktop",
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
    const { useState, useEffect, useCallback, useSyncExternalStore, createElement: h } = react;

    // ------------------------------------------------------------ 样式注入
    const CSS_ID = "dsh-pro-css";
    if (document.getElementById(CSS_ID) === null) {
      const tag = document.createElement("style");
      tag.id = CSS_ID;
      tag.dataset.plugin = "@dsh-pro/desktop";
      tag.textContent = `
.dsp-root{font-family:Inter,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;color:var(--dsw-alias-label-primary,#f9fafb)}
.dsp-footerBtn{display:flex;align-items:center;gap:8px;width:100%;height:36px;padding:0 8px 0 6px;border:0;background:transparent;color:var(--dsw-alias-label-primary,#f9fafb);border-radius:10px;cursor:pointer;font-size:13px;font-family:inherit}
.dsp-footerBtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsp-footerBtn.dsp-narrow{width:36px;justify-content:center;padding:0}
.dsp-footerBtn svg{flex:none;color:var(--dsw-alias-label-tertiary,#adb2b8)}
.dsp-panel{position:fixed;z-index:1200;left:12px;bottom:120px;width:460px;max-width:calc(100vw - 24px);max-height:66vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#151517);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:12px;box-shadow:var(--dsw-shadow-lv2,0 8px 30px rgba(0,0,0,.5));overflow:hidden}
.dsp-panelHead{flex:none;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12))}
.dsp-panelTitle{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,#f9fafb)}
.dsp-panelClose{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#adb2b8);cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;border-radius:6px}
.dsp-panelClose:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsp-panelBody{flex:1;min-height:0;overflow-y:auto;padding:8px 12px 12px}
.dsp-hint{color:var(--dsw-alias-label-tertiary,#adb2b8);font-size:12px;line-height:1.7;padding:10px 12px;border:1px dashed var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:10px;margin-bottom:8px}
.dsp-ws{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));background:var(--dsw-alias-bg-layer-1,#232324);border-radius:10px;margin-bottom:8px;overflow:hidden}
.dsp-wsHead{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer}
.dsp-wsHead:hover{background:var(--dsw-alias-bg-layer-2,#2c2c2e)}
.dsp-wsName{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#f9fafb);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp-wsMeta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);font-family:"Cascadia Code",Consolas,monospace}
.dsp-wsPath{font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);padding:0 12px 8px;font-family:"Cascadia Code",Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp-wsBody{border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))}
.dsp-box{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.04))}
.dsp-box:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsp-box.dsp-sel{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsp-boxGlyph{flex:none;width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:rgba(65,118,230,.14);color:#9db9f2;font-size:12px}
.dsp-boxName{flex:1;min-width:0;font-size:13px;color:var(--dsw-alias-label-primary,#f9fafb);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp-boxMeta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8)}
.dsp-boxDetail{padding:4px 12px 10px;background:var(--dsw-alias-bg-base,#151517)}
.dsp-secTitle{font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);margin:8px 2px 6px;letter-spacing:.4px}
.dsp-btn{font-family:inherit;font-size:12px;background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-primary,#f9fafb);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:8px;padding:3px 10px;cursor:pointer}
.dsp-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsp-btn.dsp-primary{background:var(--dsw-alias-state-business-primary,#4176e6);border-color:transparent;color:#fff}
.dsp-btn.dsp-danger{color:var(--dsw-alias-state-error-primary,#f25a5a)}
.dsp-btn.dsp-sm{padding:2px 8px;font-size:11px}
.dsp-ver{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:8px;font-size:12px}
.dsp-ver:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsp-verB{flex:none;background:rgba(65,118,230,.14);color:#9db9f2;border-radius:6px;font-family:"Cascadia Code",Consolas,monospace;font-size:11px;padding:2px 7px}
.dsp-verAuto{flex:none;font-size:10px;color:var(--dsw-alias-state-warn-primary,#f59e0b);border:1px solid var(--dsw-alias-state-warn-primary,#f59e0b);border-radius:5px;padding:0 5px}
.dsp-verM{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#cfd3d6)}
.dsp-verT{flex:none;color:var(--dsw-alias-label-tertiary,#adb2b8);font-size:11px}
.dsp-uploadRow{display:flex;gap:6px;align-items:center;margin-top:8px}
.dsp-uploadRow select{background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-primary,#f9fafb);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:8px;font-size:12px;padding:3px 8px;font-family:inherit}
.dsp-note{font-size:11px;color:var(--dsw-alias-state-warn-primary,#f59e0b);margin-top:6px;line-height:1.6}
.dsp-status{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);padding:8px 12px}
.dsp-status .dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#22c55e);flex:none}
.dsp-headBtn{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#adb2b8);cursor:pointer;font-size:13px;font-family:inherit;padding:4px 8px;border-radius:8px}
.dsp-headBtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-secondary,#cfd3d6)}
/* 最终版 */
.dsp-finals{border:1px solid rgba(65,118,230,.25);background:rgba(65,118,230,.06);border-radius:10px;padding:8px 10px;margin-bottom:8px}
.dsp-finalsTitle{font-size:11px;color:#9db9f2;letter-spacing:.4px;margin-bottom:6px}
.dsp-finalRow{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 2px;color:var(--dsw-alias-label-secondary,#cfd3d6)}
.dsp-finalTag{flex:none;font-size:10px;border-radius:5px;padding:0 6px}
.dsp-finalTag.dsp-final{background:rgba(65,118,230,.25);color:#9db9f2}
.dsp-finalTag.dsp-latest{background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-tertiary,#adb2b8)}
/* 右侧总文件区 */
.dsp-files{position:fixed;z-index:1200;right:12px;top:64px;bottom:120px;width:420px;max-width:60vw;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#151517);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:12px;box-shadow:var(--dsw-shadow-lv2,0 8px 30px rgba(0,0,0,.5));overflow:hidden}
.dsp-filesHead{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12))}
.dsp-filesTitle{flex:1;min-width:0;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,#f9fafb);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp-gitBadge{flex:none;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-family:"Cascadia Code",Consolas,monospace;color:#9db9f2;background:rgba(65,118,230,.14);border-radius:6px;padding:1px 7px}
.dsp-filesClose{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#adb2b8);cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;border-radius:6px}
.dsp-filesClose:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsp-crumbs{flex:none;display:flex;align-items:center;gap:4px;padding:6px 12px;font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);font-family:"Cascadia Code",Consolas,monospace;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));overflow-x:auto;white-space:nowrap}
.dsp-crumbs button{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#cfd3d6);cursor:pointer;font-size:11px;font-family:inherit;padding:1px 4px;border-radius:4px}
.dsp-crumbs button:hover{color:var(--dsw-alias-label-primary,#f9fafb);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsp-tree{flex:1;min-height:0;overflow-y:auto;padding:4px 8px 8px}
.dsp-fitem{display:flex;align-items:center;gap:7px;padding:4px 8px;border-radius:7px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-secondary,#cfd3d6)}
.dsp-fitem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#f9fafb)}
.dsp-fitem .ic{flex:none;width:16px;text-align:center;color:var(--dsw-alias-label-tertiary,#adb2b8)}
.dsp-fitem .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp-fitem .sz{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#adb2b8)}
.dsp-fitem.dsp-dir{color:var(--dsw-alias-label-primary,#f9fafb)}
.dsp-code{flex:1;min-height:0;overflow:auto;margin:0;padding:10px 14px;font-family:"Cascadia Code",Consolas,monospace;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary,#cfd3d6);white-space:pre;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));background:var(--dsw-alias-bg-base,#151517)}
.dsp-codeHead{flex:none;display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);font-family:"Cascadia Code",Consolas,monospace;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))}
.dsp-codeHead .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp-codeClose{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#adb2b8);cursor:pointer;font-size:12px;padding:0 4px;border-radius:4px}
.dsp-codeClose:hover{color:var(--dsw-alias-label-primary,#f9fafb)}
`;
      document.head.appendChild(tag);
    }

    // ------------------------------------------------------------ 小 store
    const store = { open: false, sessionId: null, listeners: new Set() };
    function getSnapshot() {
      return store.open ? (store.sessionId ?? "open") : "closed";
    }
    function emit() {
      for (const l of store.listeners) l();
    }
    function subscribe(listener) {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    }
    function setPanel(open, sessionId) {
      store.open = open;
      store.sessionId = sessionId ?? null;
      emit();
    }

    // ---- 右侧总文件区 store（源管理：git 仓库 + 本地文件夹） ----
    const fstore = { open: false, listeners: new Set() };
    function fGet() {
      return fstore.open ? "open" : "";
    }
    function fEmit() {
      for (const l of fstore.listeners) l();
    }
    function fSubscribe(listener) {
      fstore.listeners.add(listener);
      return () => fstore.listeners.delete(listener);
    }
    function setFiles(open) {
      fstore.open = open;
      fEmit();
    }

    // ------------------------------------------------------------ API
    async function api(path, opts) {
      const r = await fetch(path, {
        method: (opts && opts.method) || "GET",
        headers: opts && opts.body ? { "Content-Type": "application/json" } : undefined,
        body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
      });
      let data = null;
      try {
        data = await r.json();
      } catch {
        /* ignore */
      }
      if (!r.ok || !data || data.ok === false) {
        throw new Error((data && data.error) || `HTTP ${r.status}`);
      }
      return data;
    }

    function fmtTime(ms) {
      const d = new Date(ms);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    function shortId(id) {
      return id ? id.replace(/^session-/, "").slice(0, 8) : "?";
    }

    // ---- 版本快照文件浏览 store（查看某个版本里的文件） ----
    const vstore = { open: false, wsPath: null, version: null, semver: null, listeners: new Set() };
    function vGet() {
      return vstore.open ? vstore.version : "";
    }
    function vEmit() {
      for (const l of vstore.listeners) l();
    }
    function vSubscribe(listener) {
      vstore.listeners.add(listener);
      return () => vstore.listeners.delete(listener);
    }
    function setVersionView(open, wsPath, version, semver) {
      vstore.open = open;
      vstore.wsPath = wsPath;
      vstore.version = version;
      vstore.semver = semver;
      vEmit();
    }

    /** 版本快照文件浏览（vtree/vfile，安全根 = 该版本目录）。 */
    function VersionBrowser({ wsPath, version, semver }) {
      const [dir, setDir] = useState(null); // null = 版本根
      const [data, setData] = useState(null);
      const [file, setFile] = useState(null);
      const [err, setErr] = useState("");

      const load = useCallback(
        async (d) => {
          setErr("");
          try {
            const q = new URLSearchParams({ path: wsPath, version });
            if (d) q.set("dir", d);
            const r = await api(`/api/pro/vtree?${q}`);
            setData(r);
            setFile(null);
          } catch (e) {
            setErr(e.message);
          }
        },
        [wsPath, version]
      );

      useEffect(() => {
        load(null);
      }, [load]);

      const openFile = async (fpath) => {
        try {
          const q = new URLSearchParams({ path: wsPath, version, file: fpath });
          const r = await api(`/api/pro/vfile?${q}`);
          setFile(r);
        } catch (e) {
          setErr(e.message);
        }
      };

      // 面包屑：根 = 版本目录
      const crumbs = [{ label: `v${semver}`, dir: null }];
      if (dir) {
        const parts = dir.split(/[\\/]+/).filter(Boolean);
        let acc = "";
        parts.forEach((p, i) => {
          acc = acc ? acc + "\\" + p : p;
          crumbs.push({ label: p, dir: acc });
        });
      }

      return h(
        "div",
        { className: "dsp-files dsp-root", role: "dialog", "aria-label": "版本文件" },
        h(
          "div",
          { className: "dsp-filesHead" },
          h("span", { className: "dsp-filesTitle" }, `版本 v${semver} 文件`),
          h("button", { className: "dsp-filesClose", "aria-label": "关闭", onClick: () => setVersionView(false) }, "×")
        ),
        h(
          "div",
          { className: "dsp-crumbs" },
          crumbs.map((c, i) => h("button", { key: c.dir ?? "root", onClick: () => load(c.dir) }, (i > 0 ? " / " : "") + c.label))
        ),
        err ? h("div", { className: "dsp-hint", style: { margin: 8 } }, err) : null,
        file
          ? h(
              "div",
              { style: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 } },
              h(
                "div",
                { className: "dsp-codeHead" },
                h("span", { className: "nm" }, file.name),
                h("button", { className: "dsp-codeClose", onClick: () => setFile(null) }, "× 返回")
              ),
              file.tooLarge
                ? h("div", { className: "dsp-hint", style: { margin: 8 } }, `文件过大（${fmtSize(file.size)}），已跳过预览。`)
                : file.binary
                  ? h("div", { className: "dsp-hint", style: { margin: 8 } }, "二进制文件，无法预览。")
                  : h("pre", { className: "dsp-code" }, file.content ?? "")
            )
          : h(
              "div",
              { className: "dsp-tree" },
              (data?.entries ?? []).map((e) =>
                h(
                  "div",
                  {
                    key: e.name,
                    className: "dsp-fitem" + (e.dir ? " dsp-dir" : ""),
                    onClick: () => {
                      if (e.dir) {
                        const next = dir ? dir + "\\" + e.name : e.name;
                        setDir(next);
                        load(next);
                      } else {
                        const fpath = dir ? dir + "\\" + e.name : e.name;
                        openFile(fpath);
                      }
                    },
                  },
                  h("span", { className: "ic" }, e.dir ? "▸" : "·"),
                  h("span", { className: "nm" }, e.name),
                  e.dir ? null : h("span", { className: "sz" }, fmtSize(e.size))
                )
              )
            )
      );
    }

    function VersionViewRoot() {
      const version = useSyncExternalStore(vSubscribe, vGet);
      const open = version !== "";
      if (!open) return null;
      return h(VersionBrowser, { wsPath: vstore.wsPath, version: vstore.version, semver: vstore.semver });
    }

    // ------------------------------------------------------------ 总文件区（源管理）
    function fmtSize(n) {
      if (n == null) return "";
      if (n < 1024) return `${n}B`;
      if (n < 1048576) return `${(n / 1024).toFixed(1)}K`;
      return `${(n / 1048576).toFixed(1)}M`;
    }

    /** 源内文件树浏览。 */
    function SourceBrowser({ source, onBack }) {
      const [dir, setDir] = useState(source.path);
      const [data, setData] = useState(null);
      const [file, setFile] = useState(null);
      const [err, setErr] = useState("");

      const load = useCallback(
        async (d) => {
          setErr("");
          try {
            const r = await api(`/api/pro/tree?source=${encodeURIComponent(source.id)}&dir=${encodeURIComponent(d)}`);
            setData(r);
            setFile(null);
          } catch (e) {
            setErr(e.message);
          }
        },
        [source.id]
      );

      useEffect(() => {
        setDir(source.path);
        load(source.path);
      }, [source, load]);

      const openFile = async (fpath) => {
        try {
          const r = await api(`/api/pro/file?source=${encodeURIComponent(source.id)}&path=${encodeURIComponent(fpath)}`);
          setFile(r);
        } catch (e) {
          setErr(e.message);
        }
      };

      const crumbs = [];
      {
        const root = source.path;
        const rel = dir.startsWith(root) ? dir.slice(root.length).replace(/\\/g, "/").replace(/^\//, "") : dir;
        const parts = rel ? rel.split("/") : [];
        crumbs.push({ label: source.name, dir: root });
        let acc = root;
        parts.forEach((p, i) => {
          acc = acc + "\\" + p;
          crumbs.push({ label: p, dir: acc });
        });
      }

      const repo = data?.repo;
      return h(
        "div",
        { className: "dsp-files dsp-root", role: "dialog", "aria-label": "总文件区" },
        h(
          "div",
          { className: "dsp-filesHead" },
          h("button", { className: "dsp-codeClose", onClick: onBack, title: "返回源列表" }, "‹"),
          h("span", { className: "dsp-filesTitle" }, source.name),
          repo && repo.isRepo
            ? h("span", { className: "dsp-gitBadge", title: repo.lastCommit || "" }, `git ${repo.branch || "(detached)"}${repo.dirty ? ` · ${repo.dirty} 改动` : ""}`)
            : null,
          h("button", { className: "dsp-filesClose", "aria-label": "关闭", onClick: () => setFiles(false) }, "×")
        ),
        h(
          "div",
          { className: "dsp-crumbs" },
          crumbs.map((c, i) => h("button", { key: c.dir + i, onClick: () => load(c.dir) }, (i > 0 ? " / " : "") + c.label))
        ),
        err ? h("div", { className: "dsp-hint", style: { margin: 8 } }, err) : null,
        file
          ? h(
              "div",
              { style: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 } },
              h(
                "div",
                { className: "dsp-codeHead" },
                h("span", { className: "nm" }, file.name),
                h("button", { className: "dsp-codeClose", onClick: () => setFile(null) }, "× 返回")
              ),
              file.tooLarge
                ? h("div", { className: "dsp-hint", style: { margin: 8 } }, `文件过大（${fmtSize(file.size)}），已跳过预览。`)
                : file.binary
                  ? h("div", { className: "dsp-hint", style: { margin: 8 } }, "二进制文件，无法预览。")
                  : h("pre", { className: "dsp-code" }, file.content ?? "")
            )
          : h(
              "div",
              { className: "dsp-tree" },
              (data?.entries ?? []).map((e) =>
                h(
                  "div",
                  {
                    key: e.name,
                    className: "dsp-fitem" + (e.dir ? " dsp-dir" : ""),
                    onClick: () => (e.dir ? load(dir + "\\" + e.name) : openFile(dir + "\\" + e.name)),
                  },
                  h("span", { className: "ic" }, e.dir ? "▸" : "·"),
                  h("span", { className: "nm" }, e.name),
                  e.dir ? null : h("span", { className: "sz" }, fmtSize(e.size))
                )
              )
            )
      );
    }

    /** 总文件区：源列表（拉取的 git 仓库 + 本地文件夹）。 */
    function FilesRoot() {
      const open = useSyncExternalStore(fSubscribe, fGet) !== "";
      const [sources, setSources] = useState(null);
      const [browse, setBrowse] = useState(null);
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState("");
      const [adding, setAdding] = useState(false);
      const [addType, setAddType] = useState("git");
      const [addValue, setAddValue] = useState("");

      const load = useCallback(async () => {
        setErr("");
        try {
          const d = await api("/api/pro/sources");
          setSources(d.sources || []);
        } catch (e) {
          setErr(e.message);
        }
      }, []);

      useEffect(() => {
        if (open) load();
      }, [open, load]);

      if (!open) return null;

      const confirmAdd = async () => {
        const value = addValue.trim();
        if (!value) {
          window.alert(addType === "git" ? "请输入 git 仓库地址" : "请输入本地文件夹路径");
          return;
        }
        setBusy(true);
        try {
          await api("/api/pro/sources", {
            method: "POST",
            body: addType === "git" ? { type: "git", url: value } : { type: "folder", path: value },
          });
          setAdding(false);
          setAddValue("");
          load();
        } catch (e) {
          window.alert("添加失败：" + e.message);
        } finally {
          setBusy(false);
        }
      };

      const removeSource = async (s) => {
        if (!window.confirm(`删除源「${s.name}」？（本地目录保留）`)) return;
        setBusy(true);
        try {
          await api("/api/pro/sources/delete", { method: "POST", body: { id: s.id } });
          load();
        } catch (e) {
          window.alert("删除失败：" + e.message);
        } finally {
          setBusy(false);
        }
      };

      const pullSource = async (s) => {
        setBusy(true);
        try {
          const r = await api("/api/pro/sources/pull", { method: "POST", body: { id: s.id } });
          window.alert("拉取完成：" + (r.out || "ok"));
          load();
        } catch (e) {
          window.alert("拉取失败：" + e.message);
        } finally {
          setBusy(false);
        }
      };

      if (browse) {
        return h(SourceBrowser, { source: browse, onBack: () => setBrowse(null) });
      }

      return h(
        "div",
        { className: "dsp-files dsp-root", role: "dialog", "aria-label": "总文件区" },
        h(
          "div",
          { className: "dsp-filesHead" },
          h("span", { className: "dsp-filesTitle" }, "总文件区（仓库 / 本地文件夹）"),
          h("button", { className: "dsp-btn dsp-sm", disabled: busy, onClick: () => { setAdding(!adding); setAddValue(""); } }, adding ? "取消" : "＋ 添加"),
          h("button", { className: "dsp-filesClose", "aria-label": "关闭", onClick: () => setFiles(false) }, "×")
        ),
        adding
          ? h(
              "div",
              { className: "dsp-uploadRow", style: { padding: "8px 12px", borderBottom: "1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))" } },
              h(
                "select",
                {
                  value: addType,
                  onChange: (e) => {
                    setAddType(e.target.value);
                    setAddValue("");
                  },
                  style: { flex: "none", width: 130 },
                },
                h("option", { value: "git" }, "git 仓库（拉取）"),
                h("option", { value: "folder" }, "本地文件夹")
              ),
              h("input", {
                type: "text",
                value: addValue,
                placeholder: addType === "git" ? "https://github.com/... 或 git@..." : "D:\\path\\to\\folder",
                onChange: (e) => setAddValue(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter") confirmAdd();
                },
              }),
              h("button", { className: "dsp-btn dsp-primary dsp-sm", disabled: busy, onClick: confirmAdd }, "添加")
            )
          : null,
        h(
          "div",
          { className: "dsp-tree" },
          err ? h("div", { className: "dsp-hint", style: { margin: 8 } }, err) : null,
          sources === null
            ? h("div", { className: "dsp-hint" }, "加载中…")
            : sources.length === 0
              ? h(
                  "div",
                  { className: "dsp-hint" },
                  "还没有源。点「＋ 添加」，用下拉列表选择 git 仓库或本地文件夹；点击源名即可浏览文件与源码。"
                )
              : sources.map((s) =>
                  h(
                    "div",
                    { key: s.id, className: "dsp-ws" },
                    h(
                      "div",
                      { className: "dsp-wsHead", onClick: () => setBrowse(s) },
                      h("span", { className: "dsp-boxGlyph" }, s.type === "git" ? "git" : "档"),
                      h("span", { className: "dsp-wsName" }, s.name),
                      h("span", { className: "dsp-wsMeta" }, s.type === "git" ? (s.repo && s.repo.isRepo ? `git ${s.repo.branch || ""}${s.repo.dirty ? "·" + s.repo.dirty : ""}` : "git") : "本地")
                    ),
                    h("div", { className: "dsp-wsPath" }, s.url || s.path),
                    h(
                      "div",
                      { className: "dsp-arcActs", style: { display: "flex", gap: 6, padding: "0 12px 10px" } },
                      h("button", { className: "dsp-btn dsp-primary dsp-sm", onClick: () => setBrowse(s) }, "打开"),
                      s.type === "git"
                        ? h("button", { className: "dsp-btn dsp-sm", disabled: busy, onClick: () => pullSource(s) }, "拉取")
                        : null,
                      h("button", { className: "dsp-btn dsp-sm dsp-danger", disabled: busy, onClick: () => removeSource(s) }, "删除")
                    )
                  )
                )
        )
      );
    }

    // ------------------------------------------------------------ 总控制器
    function ControllerPanel({ sessionId }) {
      const [archives, setArchives] = useState(null);
      const [selWs, setSelWs] = useState(null);
      const [selBox, setSelBox] = useState(null);
      const [busy, setBusy] = useState(false);
      const [uploadWs, setUploadWs] = useState(null);
      const [uploadVer, setUploadVer] = useState(null);
      const [uploadInclude, setUploadInclude] = useState("both");
      const [uploadNote, setUploadNote] = useState("");

      const load = useCallback(async () => {
        try {
          setArchives(null);
          const d = await api("/api/pro/archives");
          setArchives(d.archives || []);
          if (sessionId) {
            const a = await api(`/api/pro/archive?sessionId=${encodeURIComponent(sessionId)}`).catch(() => null);
            if (a && a.archive) {
              setSelWs(a.archive.path);
              setSelBox(sessionId);
            }
          }
        } catch (e) {
          setArchives([]);
          window.alert("项目控制器加载失败：" + e.message);
        }
      }, [sessionId]);

      useEffect(() => {
        load();
      }, [load]);

      const refresh = () => load();

      const doSnapshot = async (arc, box) => {
        const semver = window.prompt("版本号（X.Y.Z，留空自动 +0.0.1）", "");
        if (semver === null) return;
        const message = window.prompt("版本说明", "");
        if (message === null) return;
        setBusy(true);
        try {
          const body = box && box.sessionId ? { sessionId: box.sessionId, semver, message } : { path: arc.path, semver, message };
          const d = await api("/api/pro/snapshot", { method: "POST", body });
          window.alert(`快照完成：${d.version.semver}（文件 ${d.version.fileCount}，对话 ${d.version.dialogCount ?? 0}${d.version.auto ? "，自动" : ""}）`);
          refresh();
        } catch (e) {
          window.alert("快照失败：" + e.message);
        } finally {
          setBusy(false);
        }
      };

      const doRestore = async (arc, ver) => {
        if (!window.confirm(`回滚到 ${ver.semver}（${ver.message || "无说明"}）？\n将覆盖 ${arc.path} 与相关对话，回滚前自动备份当前状态。`)) return;
        setBusy(true);
        try {
          await api("/api/pro/restore", { method: "POST", body: { path: arc.path, versionId: ver.id } });
          window.alert("回滚完成。若对话区被还原，可能需要刷新页面/重启 dsh 后完全生效。");
          refresh();
        } catch (e) {
          window.alert("回滚失败：" + e.message);
        } finally {
          setBusy(false);
        }
      };

      const doDelete = async (arc, ver) => {
        if (!window.confirm(`删除版本 ${ver.semver}？`)) return;
        setBusy(true);
        try {
          await api("/api/pro/version", { method: "DELETE", body: { path: arc.path, versionId: ver.id } });
          refresh();
        } catch (e) {
          window.alert("删除失败：" + e.message);
        } finally {
          setBusy(false);
        }
      };

      const doFinalize = async (arc, ver, final) => {
        setBusy(true);
        try {
          await api("/api/pro/finalize", { method: "POST", body: { path: arc.path, versionId: ver.id, final } });
          refresh();
        } catch (e) {
          window.alert("操作失败：" + e.message);
        } finally {
          setBusy(false);
        }
      };
      // 上传 = 总控制器操作：真 GitHub 上传（需先配置仓库/Token）
      const doUpload = (arc, ver) => {
        if (!ghHasToken) {
          window.alert("请先在下方「GitHub 设置」里配置仓库与 Token。");
          return;
        }
        const label = ver ? `${ver.semver}` : "（最新）";
        if (!window.confirm(`将「${arc.title}」的 ${label} 作为测试版上传到 GitHub（${ghRepo}）？`)) return;
        setUploadWs(arc.path);
        setUploadVer(ver ? ver.id : null);
        setUploadInclude("both");
        setUploadNote("");
      };
      const confirmUpload = async (arc) => {
        setBusy(true);
        try {
          const body = { path: arc.path, include: uploadInclude };
          if (uploadVer) body.versionId = uploadVer;
          const d = await api("/api/pro/upload", { method: "POST", body });
          setUploadNote(`上传成功（测试版 v${d.version}）→ ${d.release.url}`);
          setUploadWs(null);
          window.alert(`上传成功！\n测试版 v${d.version}\n${d.release.url}`);
        } catch (e) {
          window.alert("上传失败：" + e.message);
        } finally {
          setBusy(false);
        }
      };

      // GitHub 设置
      const [ghRepo, setGhRepo] = useState("");
      const [ghToken, setGhToken] = useState("");
      const [ghHasToken, setGhHasToken] = useState(false);
      const [ghSaving, setGhSaving] = useState(false);
      useEffect(() => {
        api("/api/pro/config")
          .then((c) => {
            setGhRepo(c.github?.repo ?? "");
            setGhHasToken(!!c.github?.hasToken);
          })
          .catch(() => {});
      }, []);
      const saveGh = async () => {
        setGhSaving(true);
        try {
          await api("/api/pro/config", { method: "POST", body: { github: { repo: ghRepo, token: ghToken } } });
          setGhHasToken(ghToken.length > 0 || ghHasToken);
          setGhToken("");
          window.alert("GitHub 配置已保存。");
        } catch (e) {
          window.alert("保存失败：" + e.message);
        } finally {
          setGhSaving(false);
        }
      };

      const wsList = archives || [];
      const selectedWs = wsList.find((a) => a.path === selWs) || null;

      return h(
        "div",
        { className: "dsp-panel dsp-root", role: "dialog", "aria-label": "总版本控制器" },
        h(
          "div",
          { className: "dsp-panelHead" },
          h("span", { className: "dsp-panelTitle" }, "总版本控制器 · 最终版"),
          h("button", { className: "dsp-panelClose", "aria-label": "关闭", onClick: () => setPanel(false) }, "×")
        ),
        h(
          "div",
          { className: "dsp-panelBody" },
          h(
            "div",
            { className: "dsp-status" },
            h("span", { className: "dot" }),
            h("span", null, "每个会话 = 一个子版本控制器；这里是管理各子控制器最终版的总控制器。自动快照：每轮任务完成自动存档（AI 生成内容一并纳入，点会话里文件 chips 看源码）")
          ),
          archives === null
            ? h("div", { className: "dsp-hint" }, "加载中…")
            : wsList.length === 0
              ? h(
                  "div",
                  { className: "dsp-hint" },
                  "还没有项目档案。在 DSH 侧边栏「工作区」中新建工作区（选择一个目录），会话就会自动成为它的子版本控制器；每完成一轮任务自动打一次快照。"
                )
              : h(
                  "div",
                  null,
                  wsList.map((arc) => {
                    const open = selectedWs && selectedWs.path === arc.path;
                    const finals = arc.finals ?? [];
                    return h(
                      "div",
                      { key: arc.path, className: "dsp-ws" },
                      h(
                        "div",
                        { className: "dsp-wsHead", onClick: () => { setSelWs(open ? null : arc.path); setSelBox(null); } },
                        h("span", { className: "dsp-wsName" }, arc.title),
                        h("span", { className: "dsp-wsMeta" }, `${arc.boxes.length} 框 · ${arc.versions.length} 版本`)
                      ),
                      // 最终版总览（主视图，始终显示）
                      h(
                        "div",
                        { className: "dsp-finals" },
                        h("div", { className: "dsp-finalsTitle" }, "最终版（各子控制器）"),
                        finals.length === 0
                          ? h("div", { className: "dsp-hint", style: { margin: 0 } }, "暂无最终版。展开工作区，在版本行点「设最终」把某个版本定为最终版。")
                          : finals.map((f) =>
                              f.version
                                ? h(
                                    "div",
                                    { key: (f.sessionId ?? "ws") + f.version.id, className: "dsp-finalRow", style: { flexWrap: "wrap" } },
                                    h("span", { className: "dsp-finalTag " + (f.finalized ? "dsp-final" : "dsp-latest") }, f.finalized ? "最终" : "最新"),
                                    h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, f.sessionTitle || "工作区级"),
                                    h("span", { className: "dsp-verB" }, f.version.semver),
                                    h("span", { className: "dsp-verT" }, fmtTime(f.version.createdAt)),
                                    h("button", { className: "dsp-btn dsp-sm", disabled: busy, onClick: () => setVersionView(true, arc.path, f.version.id, f.version.semver) }, "查看"),
                                    h("button", { className: "dsp-btn dsp-sm dsp-primary", disabled: busy, onClick: () => doUpload(arc, f.version) }, "上传"),
                                    h("button", { className: "dsp-btn dsp-sm", disabled: busy, onClick: () => doRestore(arc, f.version) }, "回滚"),
                                    h("button", { className: "dsp-btn dsp-sm dsp-danger", disabled: busy, onClick: () => doDelete(arc, f.version) }, "删除")
                                  )
                                : null
                            )
                      ),
                      open
                        ? h(
                            "div",
                            { className: "dsp-wsBody" },
                            arc.boxes.map((box) => {
                              const boxSel = selBox === box.sessionId;
                              return h(
                                "div",
                                { key: box.sessionId ?? "ws-level", className: "dsp-box" + (boxSel ? " dsp-sel" : ""), onClick: () => setSelBox(boxSel ? null : box.sessionId) },
                                h("span", { className: "dsp-boxGlyph" }, box.sessionId ? "功" : "档"),
                                h("span", { className: "dsp-boxName" }, box.sessionId ? (box.sessionTitle || `会话 ${shortId(box.sessionId)}`) : "工作区级"),
                                h("span", { className: "dsp-boxMeta" }, `${box.versions.length} 版本`)
                              );
                            }),
                            h(
                              "div",
                              { className: "dsp-boxDetail" },
                              h(
                                "div",
                                { className: "dsp-arcActs", style: { display: "flex", gap: 6, margin: "6px 0" } },
                                h("button", { className: "dsp-btn dsp-primary dsp-sm", disabled: busy, onClick: () => doSnapshot(arc, null) }, "工作区级快照"),
                                h("button", { className: "dsp-btn dsp-sm", disabled: busy, onClick: () => setFiles(true) }, "文件区")
                              ),
                              uploadWs === arc.path
                                ? h(
                                    "div",
                                    { className: "dsp-uploadRow" },
                                    h(
                                      "select",
                                      { value: uploadInclude, onChange: (e) => setUploadInclude(e.target.value) },
                                      h("option", { value: "both" }, "文件区 + 对话区"),
                                      h("option", { value: "files" }, "仅文件区"),
                                      h("option", { value: "dialogs" }, "仅对话区")
                                    ),
                                    h("button", { className: "dsp-btn dsp-primary dsp-sm", disabled: busy, onClick: () => confirmUpload(arc) }, "确认上传")
                                  )
                                : null,
                              uploadNote ? h("div", { className: "dsp-note" }, uploadNote) : null,
                              h("div", { className: "dsp-secTitle" }, "版本历史（子控制器）"),
                              arc.versions.length === 0
                                ? h("div", { className: "dsp-hint" }, "暂无版本。完成一轮任务会自动存档，或点「打快照」手动存档。")
                                : arc.versions
                                    .filter((ver) => selBox === null || ver.sessionId === selBox)
                                    .map((ver) =>
                                      h(
                                        "div",
                                        { key: ver.id, className: "dsp-ver" },
                                        h("span", { className: "dsp-verB" }, ver.semver),
                                        ver.auto ? h("span", { className: "dsp-verAuto" }, "自动") : null,
                                        ver.final ? h("span", { className: "dsp-verAuto", style: { color: "#9db9f2", borderColor: "#9db9f2" } }, "最终") : null,
                                        h("span", { className: "dsp-verM", title: ver.message }, ver.message || (ver.auto ? "自动快照（任务完成）" : "（无说明）")),
                                        h("span", { className: "dsp-verT" }, fmtTime(ver.createdAt)),
                                        h("button", { className: "dsp-btn dsp-sm", disabled: busy, onClick: () => doFinalize(arc, ver, !ver.final) }, ver.final ? "取消最终" : "设最终"),
                                        h("button", { className: "dsp-btn dsp-sm", disabled: busy, onClick: () => doRestore(arc, ver) }, "回滚"),
                                        h("button", { className: "dsp-btn dsp-sm dsp-danger", disabled: busy, onClick: () => doDelete(arc, ver) }, "删除")
                                      )
                                    )
                            )
                          )
                        : null
                    );
                  })
                ),
          h(
            "div",
            { className: "dsp-finals", style: { marginTop: 8 } },
            h("div", { className: "dsp-finalsTitle" }, "GitHub 设置（上传目标）"),
            h(
              "div",
              { className: "dsp-uploadRow", style: { marginTop: 6 } },
              h("input", {
                type: "text",
                value: ghRepo,
                placeholder: "owner/repo，如 emomg/deepseek-harness-desktop",
                onChange: (e) => setGhRepo(e.target.value),
                style: { flex: 1 },
              }),
              h("input", {
                type: "password",
                value: ghToken,
                placeholder: ghHasToken ? "Token 已配置（输入可替换）" : "GitHub Token（仅存本地）",
                onChange: (e) => setGhToken(e.target.value),
                style: { flex: 1 },
              }),
              h("button", { className: "dsp-btn dsp-primary dsp-sm", disabled: ghSaving, onClick: saveGh }, "保存")
            ),
            h("div", { className: "dsp-note" }, "上传会以「测试版」（prerelease）发布到该仓库 Releases；Token 只保存在本机配置文件中，接口不会回传。")
          )
        )
      );
    }

    function FooterEntry({ wide }) {
      const snap = useSyncExternalStore(subscribe, getSnapshot);
      const open = snap !== "closed";
      const sessionId = snap === "closed" ? null : snap === "open" ? null : snap;
      return h(
        "div",
        { className: "dsp-root" },
        h(
          "button",
          {
            type: "button",
            className: "dsp-footerBtn" + (wide ? "" : " dsp-narrow"),
            "aria-label": "总版本控制器",
            "aria-expanded": open,
            onClick: () => setPanel(!open, null),
            title: "总版本控制器",
          },
          h(
            "svg",
            { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.6 },
            h("path", { d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" })
          ),
          wide ? h("span", null, "总版本控制器") : null
        ),
        open ? h(ControllerPanel, { sessionId }) : null
      );
    }

    // ------------------------------------------------------------ 会话头部（功能框版本控制器）
    function SessionActions({ sessionId, t }) {
      const openPanel = () => setPanel(true, sessionId);

      return h(
        "div",
        { className: "dsp-root", style: { display: "inline-flex", alignItems: "center", gap: 2 } },
        h("button", { type: "button", className: "dsp-headBtn", onClick: openPanel, title: "打开总版本控制器（快照/最终版/上传在这里管理）" }, "版本"),
        h("button", { type: "button", className: "dsp-headBtn", onClick: () => setFiles(true), title: "打开右侧总文件区（拉取的 git 仓库 / 本地文件夹）" }, "文件区")
      );
    }

    // ------------------------------------------------------------ 插件
    const inject = ["slots", "locale"];
    const NS = "dshPro";
    const zh = { "controller": "总版本控制器", "snapshot": "快照", "versions": "版本", "upload": "上传" };
    const en = { "controller": "Version Controller", "snapshot": "Snapshot", "versions": "Versions", "upload": "Upload" };

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-pro: dictionaries");
      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register({ name: "sidebar.footer.action", id: "dsh-pro", locale: NS }, FooterEntry)
      );
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          { name: "conversation.session.header.actions", id: "dsh-pro", order: 30, locale: NS },
          SessionActions
        )
      );
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register({ name: "shell.overlay", id: "dsh-pro-files" }, FilesRoot)
      );
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register({ name: "shell.overlay", id: "dsh-pro-version-view" }, VersionViewRoot)
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
