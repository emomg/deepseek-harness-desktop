//! @dsh-pro/core · 客户端插件 v2（手写 loader 格式，无构建）
//!
//! 界面：侧边栏底部「Pro 面板」入口（sidebar.footer.action）+ 覆盖层（shell.overlay）
//!   - 仪表盘：项目 × 会话 × 目标 × todo × 统计 × 摘要 × 阻塞
//!   - 任务模板：CRUD + 填充复制；composer 内 /tpl 命令直接发送
//!   - 评审门禁：开始评审 / 逐文件差异 / 接受 / 拒绝 / 提交 / 放弃
//! 数据：同源 fetch /api/pro/*（无跨域、无桥接）。

window.__ModuleLoader__.load({
  id: "@dsh-pro/core",
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
    const { useState, useEffect, useRef, useCallback, useSyncExternalStore, createElement: h } = react;

    // ------------------------------------------------------------ 样式
    const CSS_ID = "dsh-pro-v2-css";
    if (document.getElementById(CSS_ID) === null) {
      const tag = document.createElement("style");
      tag.id = CSS_ID;
      tag.dataset.plugin = "@dsh-pro/core";
      tag.textContent = `
.dsp2-root{font-family:Inter,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;color:var(--dsw-alias-label-primary,#f9fafb);font-size:13px}
.dsp2-btn{font-family:inherit;font-size:12px;background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-primary,#f9fafb);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:8px;padding:3px 10px;cursor:pointer;line-height:1.5}
.dsp2-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsp2-btn.primary{background:var(--dsw-alias-state-business-primary,#4176e6);border-color:transparent;color:#fff}
.dsp2-btn.danger{color:var(--dsw-alias-state-error-primary,#f25a5a)}
.dsp2-btn.sm{padding:1px 7px;font-size:11px}
.dsp2-btn:disabled{opacity:.45;cursor:not-allowed}
.dsp2-footerBtn{display:flex;align-items:center;gap:8px;width:100%;height:36px;padding:0 8px 0 6px;border:0;background:transparent;color:var(--dsw-alias-label-primary,#f9fafb);border-radius:10px;cursor:pointer;font-size:13px;font-family:inherit}
.dsp2-footerBtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsp2-footerBtn.narrow{width:36px;justify-content:center;padding:0}
.dsp2-footerBtn svg{flex:none;color:var(--dsw-alias-label-tertiary,#adb2b8)}
.dsp2-panel{position:fixed;z-index:1200;left:12px;bottom:120px;width:520px;max-width:calc(100vw - 24px);max-height:70vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#151517);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:12px;box-shadow:var(--dsw-shadow-lv2,0 8px 30px rgba(0,0,0,.5));overflow:hidden}
.dsp2-head{flex:none;display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12))}
.dsp2-tab{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#adb2b8);cursor:pointer;font-size:12px;font-family:inherit;padding:4px 10px;border-radius:8px}
.dsp2-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-secondary,#cfd3d6)}
.dsp2-tab.on{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f9fafb)}
.dsp2-close{margin-left:auto;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#adb2b8);cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;border-radius:6px}
.dsp2-body{flex:1;min-height:0;overflow-y:auto;padding:8px 12px 12px}
.dsp2-ws{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));background:var(--dsw-alias-bg-layer-1,#232324);border-radius:10px;margin-bottom:8px;overflow:hidden}
.dsp2-wsHead{display:flex;align-items:center;gap:8px;padding:8px 12px}
.dsp2-wsName{flex:1;min-width:0;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp2-wsMeta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);font-family:"Cascadia Code",Consolas,monospace}
.dsp2-wsPath{font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);padding:0 12px 6px;font-family:"Cascadia Code",Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp2-sess{border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.04));padding:8px 12px}
.dsp2-sessHead{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dsp2-sessTitle{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
.dsp2-badge{flex:none;font-size:10px;border-radius:5px;padding:0 6px;line-height:16px}
.dsp2-badge.active{background:rgba(65,118,230,.2);color:#9db9f2}
.dsp2-badge.blocked{background:rgba(242,90,90,.18);color:#f59c9c}
.dsp2-badge.paused{background:rgba(245,158,11,.18);color:#f5c26b}
.dsp2-badge.complete{background:rgba(34,197,94,.18);color:#7ee2a8}
.dsp2-badge.none{background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-tertiary,#adb2b8)}
.dsp2-sessMeta{font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8)}
.dsp2-summary{margin-top:6px;font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary,#cfd3d6);white-space:pre-wrap;background:var(--dsw-alias-bg-layer-2,#2c2c2e);border-radius:8px;padding:8px 10px}
.dsp2-empty{color:var(--dsw-alias-label-tertiary,#adb2b8);font-size:12px;text-align:center;padding:18px 8px;line-height:1.8}
.dsp2-row{display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.04))}
.dsp2-rowName{flex:1;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp2-rowDesc{font-size:11px;color:var(--dsp2,#adb2b8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsp2-input{background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-primary,#f9fafb);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:8px;font-size:12px;padding:4px 8px;font-family:inherit;width:100%;box-sizing:border-box;margin:3px 0}
.dsp2-textarea{background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-primary,#f9fafb);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:8px;font-size:12px;padding:6px 8px;font-family:"Cascadia Code",Consolas,monospace;width:100%;box-sizing:border-box;min-height:90px;margin:3px 0}
.dsp2-select{background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-primary,#f9fafb);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:8px;font-size:12px;padding:3px 8px;font-family:inherit}
.dsp2-file{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;font-size:12px;cursor:pointer}
.dsp2-file:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsp2-file.on{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.1))}
.dsp2-filePath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"Cascadia Code",Consolas,monospace;font-size:11px}
.dsp2-stM{color:#f5c26b}.dsp2-stA{color:#7ee2a8}.dsp2-stD{color:#f59c9c}
.dsp2-dec{font-size:10px;border-radius:5px;padding:0 5px;line-height:15px}
.dsp2-dec.pending{background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-tertiary,#adb2b8)}
.dsp2-dec.accepted{background:rgba(34,197,94,.18);color:#7ee2a8}
.dsp2-dec.rejected{background:rgba(242,90,90,.18);color:#f59c9c}
.dsp2-diff{flex:1;min-height:0;overflow:auto;margin:0;padding:10px 14px;font-family:"Cascadia Code",Consolas,monospace;font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary,#cfd3d6);white-space:pre;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));background:var(--dsw-alias-bg-base,#151517)}
.dsp2-note{font-size:11px;color:var(--dsw-alias-state-warn-primary,#f59e0b);margin-top:6px;line-height:1.6}
.dsp2-hint{color:var(--dsw-alias-label-tertiary,#adb2b8);font-size:11px;line-height:1.7;padding:8px 10px;border:1px dashed var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:10px;margin-bottom:8px}
`;
      document.head.appendChild(tag);
    }

    // ---- 设置页（个性化 / 技能 / MCP）样式 ----
    const SET_CSS_ID = "dsh-pro-settings-css";
    if (document.getElementById(SET_CSS_ID) === null) {
      const tag = document.createElement("style");
      tag.id = SET_CSS_ID;
      tag.dataset.plugin = "@dsh-pro/core";
      tag.textContent = `
.dsp2-setSection{width:100%;max-width:760px;color:var(--dsw-alias-label-primary,#f9fafb);flex-direction:column;gap:14px;display:flex}
.dsp2-setCard{background:var(--dsw-alias-bg-layer-2,#2c2c2e);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));border-radius:12px;padding:14px 16px}
.dsp2-setTitle{font-size:14px;font-weight:600;margin-bottom:10px}
.dsp2-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.04))}
.dsp2-row:last-child{border-bottom:none}
.dsp2-rowLabel{flex:1;min-width:0;font-size:13px}
.dsp2-rowHint{font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);line-height:1.7}
.dsp2-range{flex:none;width:160px;accent-color:#5b8cff;cursor:pointer}
.dsp2-val{flex:none;width:46px;text-align:right;font-size:12px;color:var(--dsw-alias-label-tertiary,#adb2b8);font-family:"Cascadia Code",Consolas,monospace}
.dsp2-check{accent-color:#5b8cff;width:16px;height:16px;cursor:pointer}
.dsp2-skillName{font-family:"Cascadia Code",Consolas,monospace;font-size:12px;font-weight:600}
.dsp2-tag{display:inline-flex;font-size:10px;border-radius:5px;padding:0 6px;line-height:16px;margin-right:6px;background:var(--dsw-alias-bg-layer-2,#2c2c2e);color:var(--dsw-alias-label-secondary,#cfd3d6)}
.dsp2-tag.ok{background:rgba(34,197,94,.16);color:#7ee2a8}
.dsp2-tag.warn{background:rgba(245,158,11,.16);color:#f5c26b}
.dsp2-stateDot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#adb2b8);flex:none;display:inline-block}
.dsp2-stateDot.active{background:#22c55e}
.dsp2-stateDot.failed{background:#f25a5a}
.dsp2-stateDot.pending,.dsp2-stateDot.loading{background:#5b8cff}
.dsp2-serverName{font-family:"Cascadia Code",Consolas,monospace;font-size:13px;font-weight:600}
.dsp2-mono{font-family:"Cascadia Code",Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary,#adb2b8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
      document.head.appendChild(tag);
    }

    // ------------------------------------------------------------ API 助手
    async function api(path, options) {
      const res = await fetch(path, {
        method: options?.method ?? "GET",
        headers: options?.body ? { "Content-Type": "application/json" } : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || (data && data.ok === false)) {
        throw new Error((data && data.error) || ("请求失败 " + res.status));
      }
      return data;
    }

    function fmtTime(ts) {
      if (!ts) return "";
      const d = new Date(ts);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const pad = (n) => String(n).padStart(2, "0");
      const hm = pad(d.getHours()) + ":" + pad(d.getMinutes());
      return sameDay ? hm : (d.getMonth() + 1) + "-" + d.getDate() + " " + hm;
    }

    // ------------------------------------------------------------ 面板 store
    const store = { open: false, tab: "dash", listeners: new Set() };
    function getSnapshot() {
      return store.open ? store.tab : "closed";
    }
    function subscribe(listener) {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    }
    function setPanel(open, tab) {
      store.open = open;
      if (tab) store.tab = tab;
      for (const l of store.listeners) l();
    }

    const NS = "dsh-pro";
    const zh = {
      "entry.label": "Pro 面板",
      "tab.dash": "仪表盘",
      "tab.tpl": "模板",
      "tab.review": "评审",
      "dash.refresh": "刷新",
      "dash.empty": "还没有项目会话。\n在 DSH 工作区里新建会话并跑任务后，这里会自动聚合：目标进度、todo、token、文件与阻塞。",
      "dash.sessions": "会话",
      "dash.turns": "轮次",
      "dash.blocked": "阻塞",
      "dash.active": "进行中",
      "dash.summarized": "已摘要",
      "dash.goal": "目标",
      "dash.noGoal": "无目标",
      "dash.noSummary": "还没有摘要",
      "dash.genSummary": "生成摘要",
      "dash.summarizing": "生成中…",
      "dash.todos": "待办",
      "dash.turn": "轮",
      "dash.step": "步",
      "tpl.empty": "还没有模板。点「新建模板」，或直接在输入框输入 /tpl 使用。",
      "tpl.new": "新建模板",
      "tpl.use": "使用",
      "tpl.copy": "复制",
      "tpl.edit": "编辑",
      "tpl.del": "删除",
      "tpl.name": "名称",
      "tpl.desc": "描述",
      "tpl.prompt": "模板内容（{{key}} 为变量占位）",
      "tpl.vars": "变量（每行 key:标签[:默认值]）",
      "tpl.tags": "标签（逗号分隔）",
      "tpl.save": "保存",
      "tpl.cancel": "取消",
      "tpl.copied": "已复制到剪贴板，粘贴到输入框即可使用",
      "tpl.failed": "操作失败",
      "review.start": "开始评审",
      "review.empty": "还没有评审。选择一个会话开始评审：AI 会跑一遍测试并做安全检查，过程可随时终止或结束。",
      "review.open": "打开",
      "review.pickSession": "选择要评审的会话…",
      "review.terminate": "终止",
      "review.end": "结束",
      "review.status.running": "进行中",
      "review.status.done": "已完成",
      "review.status.terminated": "已终止",
      "review.status.ended": "已结束",
      "review.noReport": "还没有报告",
      "review.promptLabel": "评审任务",
      "review.reportLabel": "AI 报告",
      "review.template": "模板",
      "review.confirmTerminate": "终止将中断正在执行的 AI 任务，确定？",
      "review.confirmEnd": "结束将关闭该评审记录（若还在运行会一并中断），确定？",
      "review.starting": "开始中…",
      "common.err": "出错",
      "settings.skill": "技能",
      "settings.mcp": "MCP",
      "skill.title": "技能管理",
      "skill.empty": "暂无可用技能。",
      "skill.presets": "预设技能库",
      "skill.userLib": "用户技能",
      "skill.none": "无",
      "skill.refresh": "刷新",
      "skill.model": "模型可调用",
      "skill.user": "用户可调用",
      "skill.errorHint": "技能数据暂时不可用，请稍后重试；若持续如此，重启应用后生效。",
      "mcp.title": "MCP 服务器管理",
      "mcp.empty": "未配置 MCP 服务器。可在 cordis 配置中添加 mcp-client 插件实例。",
      "mcp.refresh": "刷新",
      "mcp.transport": "传输",
      "mcp.command": "命令",
      "mcp.url": "地址",
      "mcp.args": "参数",
      "mcp.env": "环境变量",
      "mcp.headers": "请求头",
      "mcp.tools": "工具",
      "mcp.reconnect": "自动重连",
      "mcp.failOnStartup": "启动失败即报错",
      "mcp.disabled": "已禁用",
      "mcp.errorHint": "MCP 数据暂时不可用，请稍后重试；若持续如此，重启应用后生效。",
      "common.loading": "加载中…",
    };
    const en = {
      "entry.label": "Pro Panel",
      "tab.dash": "Dashboard",
      "tab.tpl": "Templates",
      "tab.review": "Review",
      "dash.refresh": "Refresh",
      "dash.empty": "No project sessions yet.",
      "dash.sessions": "sessions",
      "dash.turns": "turns",
      "dash.blocked": "blocked",
      "dash.active": "active",
      "dash.goal": "Goal",
      "dash.noGoal": "No goal",
      "dash.noSummary": "No summary yet",
      "dash.genSummary": "Summarize",
      "dash.todos": "todos",
      "tpl.empty": "No templates yet.",
      "tpl.new": "New template",
      "tpl.use": "Use",
      "tpl.copy": "Copy",
      "tpl.edit": "Edit",
      "tpl.del": "Delete",
      "tpl.save": "Save",
      "tpl.cancel": "Cancel",
      "tpl.copied": "Copied to clipboard.",
      "review.start": "Start review",
      "review.empty": "No reviews yet. Pick a session to start: the AI runs tests and a security check; you can terminate or end it anytime.",
      "review.open": "Open",
      "review.pickSession": "Pick a session to review…",
      "review.terminate": "Terminate",
      "review.end": "End",
      "review.status.running": "running",
      "review.status.done": "done",
      "review.status.terminated": "terminated",
      "review.status.ended": "ended",
      "review.noReport": "No report yet",
      "review.promptLabel": "Review task",
      "review.reportLabel": "AI report",
      "review.template": "Template",
      "review.confirmTerminate": "Terminate will interrupt the running AI task. Continue?",
      "review.confirmEnd": "End closes this review (interrupting the task if still running). Continue?",
      "review.starting": "Starting…",
      "settings.skill": "Skills",
      "settings.mcp": "MCP",
      "skill.title": "Skills",
      "skill.empty": "No skills available.",
      "skill.presets": "Preset skill library",
      "skill.userLib": "User skills",
      "skill.none": "none",
      "skill.refresh": "Refresh",
      "skill.model": "model",
      "skill.user": "user",
      "skill.errorHint": "Skill data is temporarily unavailable; retry shortly. If it persists, restart the app.",
      "mcp.title": "MCP Servers",
      "mcp.empty": "No MCP servers configured. Add mcp-client plugin entries in the cordis configuration.",
      "mcp.refresh": "Refresh",
      "mcp.transport": "Transport",
      "mcp.command": "Command",
      "mcp.url": "URL",
      "mcp.args": "Args",
      "mcp.env": "Env",
      "mcp.headers": "Headers",
      "mcp.tools": "tools",
      "mcp.reconnect": "reconnect",
      "mcp.failOnStartup": "fail-fast",
      "mcp.disabled": "disabled",
      "mcp.errorHint": "MCP data is temporarily unavailable; retry shortly. If it persists, restart the app.",
      "common.loading": "Loading…",
    };

    // ------------------------------------------------------------ 通用小组件
    function Badge({ kind, children }) {
      return h("span", { className: "dsp2-badge " + kind }, children);
    }
    function IconBtn({ onClick, children, title, danger }) {
      return h("button", { className: "dsp2-btn sm" + (danger ? " danger" : ""), onClick, title }, children);
    }

    // ------------------------------------------------------------ 仪表盘
    function DashboardTab({ t }) {
      const [dash, setDash] = useState(null);
      const [err, setErr] = useState(null);
      const [busy, setBusy] = useState({});
      const load = useCallback(async () => {
        try {
          setErr(null);
          const d = await api("/api/pro/dashboard");
          setDash(d.dashboard ?? []);
        } catch (e) {
          setErr(String(e?.message ?? e));
        }
      }, []);
      useEffect(() => {
        load();
        const timer = setInterval(load, 30000);
        return () => clearInterval(timer);
      }, [load]);

      const genSummary = async (sessionId) => {
        setBusy((b) => ({ ...b, [sessionId]: true }));
        try {
          await api("/api/pro/summaries/generate", { method: "POST", body: { sessionId } });
          await load();
        } catch (e) {
          window.alert(t("common.err") + ": " + (e?.message ?? e));
        } finally {
          setBusy((b) => ({ ...b, [sessionId]: false }));
        }
      };

      if (err) return h("div", { className: "dsp2-empty" }, err);
      if (!dash) return h("div", { className: "dsp2-empty" }, "…");

      const goalBadge = (g) => {
        if (!g) return Badge({ kind: "none", children: t("dash.noGoal") });
        return Badge({ kind: g.phase ?? "none", children: (g.phase ?? "none") + (g.phase === "blocked" ? " · " + (g.blockedReason ?? "") : "") });
      };

      return h("div", null, [
        h("div", { style: { textAlign: "right", marginBottom: 6 } },
          h("button", { className: "dsp2-btn sm", onClick: load }, t("dash.refresh"))),
        dash.length === 0
          ? h("div", { className: "dsp2-empty" }, t("dash.empty"))
          : dash.map((ws) =>
              h("div", { className: "dsp2-ws", key: ws.workspaceId },
                h("div", { className: "dsp2-wsHead" },
                  h("div", { className: "dsp2-wsName", title: ws.path }, ws.title),
                  h("div", { className: "dsp2-wsMeta" },
                    ws.sessions.length + " " + t("dash.sessions") + " · " +
                    ws.totals.turns + " " + t("dash.turns") + " · " +
                    ws.totals.blocked + " " + t("dash.blocked") + " · " +
                    ws.totals.active + " " + t("dash.active")),
                ),
                h("div", { className: "dsp2-wsPath" }, ws.path),
                ws.sessions.map((s) =>
                  h("div", { className: "dsp2-sess", key: s.id },
                    h("div", { className: "dsp2-sessHead" },
                      h("span", { className: "dsp2-sessTitle", title: s.id }, s.title || s.id.slice(0, 12)),
                      goalBadge(s.goal),
                      h("span", { className: "dsp2-sessMeta" },
                        (s.stats?.turns ?? 0) + " " + t("dash.turn") + " · " +
                        (s.stats?.steps ?? 0) + " " + t("dash.step") +
                        (s.goal?.roundsStarted ? " · R" + s.goal.roundsStarted : "")),
                    ),
                    s.summary
                      ? h("div", { className: "dsp2-summary" }, s.summary.summary)
                      : h("div", { className: "dsp2-sessMeta", style: { marginTop: 4 } },
                          h("button", {
                            className: "dsp2-btn sm",
                            disabled: busy[s.id],
                            onClick: () => genSummary(s.id),
                          }, busy[s.id] ? t("dash.summarizing") : t("dash.genSummary"))),
                    s.todos?.length
                      ? h("div", { className: "dsp2-sessMeta", style: { marginTop: 4 } },
                          t("dash.todos") + ": " + s.todos.filter((x) => x.status === "in_progress").length + "/" + s.todos.length + " · " +
                          s.todos.filter((x) => x.status === "blocked").map((x) => x.content.slice(0, 24)).join("; ").slice(0, 80))
                      : null,
                  ),
                ),
              ),
            ),
      ]);
    }

    // ------------------------------------------------------------ 模板
    function TemplatesTab({ t }) {
      const [tpls, setTpls] = useState(null);
      const [editing, setEditing] = useState(null);
      const [err, setErr] = useState(null);
      const load = useCallback(async () => {
        try {
          setErr(null);
          const d = await api("/api/pro/templates");
          setTpls(d.templates ?? []);
        } catch (e) {
          setErr(String(e?.message ?? e));
        }
      }, []);
      useEffect(() => { load(); }, [load]);

      const save = async () => {
        try {
          const vars = editing.vars
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const parts = line.split(":");
              return { key: parts[0].trim(), label: (parts[1] ?? "").trim(), default: (parts[2] ?? "").trim() || "", required: false };
            });
          const body = {
            id: editing.id,
            name: editing.name,
            description: editing.desc,
            prompt: editing.prompt,
            variables: vars,
            tags: (editing.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          };
          const d = await api("/api/pro/template", { method: "POST", body });
          setEditing(null);
          await load();
        } catch (e) {
          window.alert(t("tpl.failed") + ": " + (e?.message ?? e));
        }
      };

      const remove = async (id) => {
        if (!window.confirm("删除模板？")) return;
        try {
          await api("/api/pro/template/delete", { method: "POST", body: { id } });
          await load();
        } catch (e) {
          window.alert(t("tpl.failed") + ": " + (e?.message ?? e));
        }
      };

      const useIt = async (tpl) => {
        try {
          const d = await api("/api/pro/template/fill", { method: "POST", body: { id: tpl.id, values: {} } });
          await navigator.clipboard.writeText(d.text);
          window.alert(t("tpl.copied"));
        } catch (e) {
          window.alert(t("tpl.failed") + ": " + (e?.message ?? e));
        }
      };

      if (err) return h("div", { className: "dsp2-empty" }, err);

      if (editing) {
        return h("div", null, [
          h("div", { className: "dsp2-hint" }, t("tpl.prompt")),
          h("div", { className: "dsp2-sessMeta" }, t("tpl.name")),
          h("input", { className: "dsp2-input", value: editing.name ?? "", onChange: (e) => setEditing({ ...editing, name: e.target.value }) }),
          h("div", { className: "dsp2-sessMeta" }, t("tpl.desc")),
          h("input", { className: "dsp2-input", value: editing.desc ?? "", onChange: (e) => setEditing({ ...editing, desc: e.target.value }) }),
          h("div", { className: "dsp2-sessMeta" }, t("tpl.prompt")),
          h("textarea", { className: "dsp2-textarea", value: editing.prompt ?? "", onChange: (e) => setEditing({ ...editing, prompt: e.target.value }) }),
          h("div", { className: "dsp2-sessMeta" }, t("tpl.vars")),
          h("textarea", { className: "dsp2-textarea", value: editing.vars ?? "", onChange: (e) => setEditing({ ...editing, vars: e.target.value }) }),
          h("div", { className: "dsp2-sessMeta" }, t("tpl.tags")),
          h("input", { className: "dsp2-input", value: editing.tags ?? "", onChange: (e) => setEditing({ ...editing, tags: e.target.value }) }),
          h("div", { style: { display: "flex", gap: 6, marginTop: 8 } },
            h("button", { className: "dsp2-btn primary", onClick: save }, t("tpl.save")),
            h("button", { className: "dsp2-btn", onClick: () => setEditing(null) }, t("tpl.cancel"))),
        ]);
      }

      return h("div", null, [
        h("div", { style: { textAlign: "right", marginBottom: 6 } },
          h("button", {
            className: "dsp2-btn sm primary",
            onClick: () => setEditing({ id: "", name: "", desc: "", prompt: "", vars: "", tags: "" }),
          }, t("tpl.new"))),
        !tpls
          ? h("div", { className: "dsp2-empty" }, "…")
          : tpls.length === 0
            ? h("div", { className: "dsp2-empty" }, t("tpl.empty"))
            : tpls.map((tpl) =>
                h("div", { className: "dsp2-row", key: tpl.id },
                  h("div", { style: { flex: 1, minWidth: 0 } },
                    h("div", { className: "dsp2-rowName" }, tpl.name + (tpl.tags?.length ? "  " + tpl.tags.map((x) => "#" + x).join(" ") : "")),
                    h("div", { className: "dsp2-rowDesc" }, tpl.description || "")),
                  IconBtn({ onClick: () => useIt(tpl), title: t("tpl.use") }, t("tpl.use")),
                  IconBtn({
                    onClick: () => setEditing({
                      id: tpl.id, name: tpl.name, desc: tpl.description ?? "",
                      prompt: tpl.prompt, tags: (tpl.tags ?? []).join(", "),
                      vars: (tpl.variables ?? []).map((v) => v.key + ":" + (v.label ?? "") + (v.default ? ":" + v.default : "")).join("\n"),
                    }),
                  }, t("tpl.edit")),
                  IconBtn({ onClick: () => remove(tpl.id), danger: true }, t("tpl.del"))),
              ),
      ]);
    }

    // ------------------------------------------------------------ 评审（任务式：测试+安全，可终止/结束）
    function ReviewTab({ t }) {
      const [dash, setDash] = useState(null);
      const [reviews, setReviews] = useState(null);
      const [target, setTarget] = useState("");
      const [openId, setOpenId] = useState(null);
      const [detail, setDetail] = useState(null);
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState(null);

      const loadReviews = useCallback(async () => {
        try {
          const d = await api("/api/pro/review/list");
          setReviews(d.reviews ?? []);
        } catch (e) {
          setErr(String(e?.message ?? e));
        }
      }, []);
      useEffect(() => {
        api("/api/pro/dashboard").then((d) => setDash(d.dashboard ?? [])).catch(() => {});
        loadReviews();
      }, [loadReviews]);

      // 有进行中的评审时轮询刷新（状态 + 报告）
      const hasRunning = (reviews ?? []).some((r) => r.status === "running") || detail?.status === "running";
      useEffect(() => {
        if (!hasRunning) return;
        const timer = setInterval(async () => {
          await loadReviews();
          if (openId) {
            try {
              const d = await api("/api/pro/review?id=" + encodeURIComponent(openId));
              setDetail(d.review);
            } catch { /* ignore */ }
          }
        }, 5000);
        return () => clearInterval(timer);
      }, [hasRunning, openId, loadReviews]);

      const start = async () => {
        if (!target) { window.alert(t("review.pickSession")); return; }
        setBusy(true);
        try {
          const d = await api("/api/pro/review/start", { method: "POST", body: { sessionId: target } });
          setOpenId(d.review.id);
          setDetail(d.review);
          await loadReviews();
        } catch (e) {
          window.alert(t("common.err") + ": " + (e?.message ?? e));
        } finally {
          setBusy(false);
        }
      };

      const openReview = async (id) => {
        setBusy(true);
        try {
          const d = await api("/api/pro/review?id=" + encodeURIComponent(id));
          setOpenId(id);
          setDetail(d.review);
        } catch (e) {
          window.alert(t("common.err") + ": " + (e?.message ?? e));
        } finally {
          setBusy(false);
        }
      };

      const act = async (action, confirmMsg) => {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        setBusy(true);
        try {
          await api("/api/pro/review/" + action, { method: "POST", body: { id: openId } });
          await loadReviews();
          await openReview(openId);
        } catch (e) {
          window.alert(t("common.err") + ": " + (e?.message ?? e));
        } finally {
          setBusy(false);
        }
      };

      const workspaces = dash ?? [];

      const statusBadge = (status) => {
        const kind = status === "running" ? "active"
          : status === "done" ? "complete"
          : status === "terminated" ? "blocked"
          : "none";
        return Badge({ kind, children: t("review.status." + status) });
      };

      const reviewRow = (r) => {
        const title = r.sessionTitle || (r.sessionId ? r.sessionId.slice(0, 12) : null);
        const reportFirst = (r.report || "").split(/\r?\n/)[0] || "";
        return h("div", { className: "dsp2-row", key: r.id },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { className: "dsp2-rowName" },
              statusBadge(r.status),
              "  " + (title ? "💬 " + title : "📁 " + r.workspacePath)),
            h("div", { className: "dsp2-rowDesc" },
              (r.workspacePath ? r.workspacePath + " · " : "") +
              fmtTime(r.createdAt) + " · " + (r.templateName || r.templateId || "评审")),
            reportFirst
              ? h("div", { className: "dsp2-rowDesc", style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, reportFirst)
              : null),
          h("button", { className: "dsp2-btn sm", onClick: () => openReview(r.id) }, t("review.open")),
          r.status === "running" && h("button", { className: "dsp2-btn sm danger", onClick: () => act("terminate", t("review.confirmTerminate")) }, t("review.terminate")),
          r.status !== "ended" && h("button", { className: "dsp2-btn sm", onClick: () => act("end", t("review.confirmEnd")) }, t("review.end")));
      };

      if (detail) {
        const running = detail.status === "running";
        return h("div", null, [
          h("div", { className: "dsp2-hint" },
            (detail.sessionTitle ? "💬 " + detail.sessionTitle + " · " : "") +
            detail.workspacePath + " · " + statusBadge(detail.status) +
            (detail.templateName ? " · " + t("review.template") + ": " + detail.templateName : "")),
          h("div", { className: "dsp2-sessMeta", style: { margin: "4px 0" } }, t("review.promptLabel")),
          h("pre", { className: "dsp2-diff", style: { minHeight: 60, whiteSpace: "pre-wrap" } }, detail.prompt || ""),
          h("div", { className: "dsp2-sessMeta", style: { margin: "8px 0 4px" } }, t("review.reportLabel")),
          h("div", { className: "dsp2-summary", style: { whiteSpace: "pre-wrap" } },
            detail.report ? detail.report : (running ? "…" : t("review.noReport"))),
          h("div", { style: { display: "flex", gap: 6, marginTop: 8 } },
            running && h("button", { className: "dsp2-btn danger", onClick: () => act("terminate", t("review.confirmTerminate")) }, t("review.terminate")),
            detail.status !== "ended" && h("button", { className: "dsp2-btn primary", onClick: () => act("end", t("review.confirmEnd")) }, t("review.end")),
            h("button", { className: "dsp2-btn", onClick: () => { setOpenId(null); setDetail(null); } }, "←")),
        ]);
      }

      if (err) return h("div", { className: "dsp2-empty" }, err);

      return h("div", null, [
        h("div", { className: "dsp2-hint" }, t("review.empty")),
        h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 8 } },
          h("select", { className: "dsp2-select", value: target, onChange: (e) => setTarget(e.target.value), style: { flex: 1, minWidth: 0 } },
            h("option", { value: "" }, t("review.pickSession")),
            workspaces.map((w) => (w.sessions ?? []).map((s) =>
              h("option", { value: s.id, key: s.id },
                "💬 " + (s.title || s.id.slice(0, 12)) + " — " + w.title)))),
          h("button", { className: "dsp2-btn primary", disabled: busy, onClick: start }, busy ? t("review.starting") : t("review.start"))),
        !reviews
          ? h("div", { className: "dsp2-empty" }, "…")
          : reviews.length === 0
            ? h("div", { className: "dsp2-empty" }, t("review.empty"))
            : reviews.map(reviewRow),
      ]);
    }

    // ------------------------------------------------------------ 面板
    function Panel({ t }) {
      const tab = useSyncExternalStore(subscribe, getSnapshot);
      if (tab === "closed") return null;
      return h("div", { className: "dsp2-root" },
        h("div", { className: "dsp2-panel" },
          h("div", { className: "dsp2-head" },
            h("button", { className: "dsp2-tab" + (tab === "dash" ? " on" : ""), onClick: () => setPanel(true, "dash") }, t("tab.dash")),
            h("button", { className: "dsp2-tab" + (tab === "tpl" ? " on" : ""), onClick: () => setPanel(true, "tpl") }, t("tab.tpl")),
            h("button", { className: "dsp2-tab" + (tab === "review" ? " on" : ""), onClick: () => setPanel(true, "review") }, t("tab.review")),
            h("button", { className: "dsp2-close", onClick: () => setPanel(false) }, "✕")),
          h("div", { className: "dsp2-body" },
            tab === "dash" && h(DashboardTab, { t }),
            tab === "tpl" && h(TemplatesTab, { t }),
            tab === "review" && h(ReviewTab, { t })),
        ));
    }

    function FooterEntry() {
      const tab = useSyncExternalStore(subscribe, getSnapshot);
      return h("button", {
        className: "dsp2-footerBtn" + (tab !== "closed" ? " on" : ""),
        title: "DeepSeek Harness Pro",
        onClick: () => setPanel(tab === "closed", tab === "closed" ? "dash" : undefined),
      },
        h("svg", { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M3 3v18h18" }),
          h("path", { d: "M7 14l4-4 3 3 5-6" })),
        tab === "closed" && h("span", null, "Pro 面板"),
      );
    }

    // ------------------------------------------------------------ 设置页：个性化 / 技能 / MCP
    const PREF_KEY = "dsh-personalize-v1";
    const PREF_DEFAULTS = { enabled: true, bg: "whale", opacity: null, blur: null, glass: null, liquid: true };

    function applyPrefsToDom(p) {
      const html = document.documentElement;
      const on = p.enabled !== false;
      const bg = p.bg === "gradient" ? "gradient" : "whale";
      html.classList.toggle("dsh-whale", on);
      html.style.setProperty("--dsh-whale-enabled", on ? "1" : "0");
      if (p.opacity != null) html.style.setProperty("--dsh-whale-opacity", String(p.opacity));
      if (p.blur != null) html.style.setProperty("--dsh-whale-blur", p.blur + "px");
      if (p.glass != null) html.style.setProperty("--dsh-whale-glass", String(p.glass));
      html.style.setProperty("--dsh-whale-liquid", p.liquid === false ? "0" : "1");
      html.setAttribute("data-whale-liquid", p.liquid === false ? "0" : "1");
      if (bg === "gradient") html.style.setProperty("--dsh-whale-img", "none");
      else html.style.removeProperty("--dsh-whale-img");
      if (p.bodyBg) html.style.setProperty("--dsh-body-bg", p.bodyBg);
      else html.style.removeProperty("--dsh-body-bg");
      if (p.glow1) html.style.setProperty("--dsh-glow-1", p.glow1);
      else html.style.removeProperty("--dsh-glow-1");
      if (p.glow2) html.style.setProperty("--dsh-glow-2", p.glow2);
      else html.style.removeProperty("--dsh-glow-2");
    }
    function loadPrefs() {
      try {
        const raw = localStorage.getItem(PREF_KEY);
        return Object.assign({}, PREF_DEFAULTS, raw ? JSON.parse(raw) : {});
      } catch {
        return Object.assign({}, PREF_DEFAULTS);
      }
    }
    function savePrefs(p) {
      try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ }
      applyPrefsToDom(p);
    }
    // ------------------------------------------------------------ 皮肤中心已迁出至 @dsh-desktop/skin-center 包
    // 旧：以下 11 款硬编码皮肤（黑鲸/深空/液态玻璃/极光/赛博/极夜/墨玉/晨曦/薄荷/樱花/纯白）+ 个性化微调已全部移除。
    // 新：皮肤从 @dsh-desktop/shared 注册表读，skin-center 注入设置项。
    // ------------------------------------------------------------ 插件体
    const inject = ["slots", "locale", "commandUi", "sessions"];

    function apply(ctx) {
      const t = ctx.locale.bind(NS);

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-pro: dictionaries");

      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register({ name: "sidebar.footer.action", id: "dsh-pro", locale: NS }, FooterEntry));

      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register({ name: "shell.overlay", id: "dsh-pro-panel" }, () => h(Panel, { t })));

      // ---- 设置 → 左侧列表新增：技能 / MCP（皮肤中心已迁出至 @dsh-desktop/skin-center 包）----
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "skill",
        order: 22,
        label: () => t("settings.skill"),
        locale: NS,
      }, () => h(SkillSection, { t })));
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "mcp",
        order: 32,
        label: () => t("settings.mcp"),
        locale: NS,
      }, () => h(McpSection, { t })));

      // ---- /tpl 命令：选择模板 → 填充变量 → 发送到当前会话 ----
      ctx.inject(["commandUi", "sessions"], (scope) => {
        const command = scope.get("commandUi");
        const sessions = scope.get("sessions");
        scope.effect(() => command.register({
          name: "tpl",
          description: t("tpl.use") + "（模板）",
          available: () => true,
          ui: {
            kind: "popupSelect",
            options: async () => {
              const d = await api("/api/pro/templates");
              return (d.templates ?? []).map((tpl) => ({
                id: tpl.id,
                label: tpl.name,
                detail: tpl.description || undefined,
              }));
            },
            onSelect: async (option) => {
              try {
                const d = await api("/api/pro/templates");
                const tpl = (d.templates ?? []).find((x) => x.id === option.id);
                if (!tpl) throw new Error("模板不存在");
                const values = {};
                for (const v of tpl.variables ?? []) {
                  const def = v.default ?? "";
                  const value = window.prompt((v.label || v.key) + (v.required ? " *" : ""), def);
                  if (value === null) return; // 用户取消
                  if (v.required && !String(value).trim()) throw new Error("缺少必填变量: " + (v.label || v.key));
                  values[v.key] = value;
                }
                const filled = await api("/api/pro/template/fill", { method: "POST", body: { id: tpl.id, values } });
                // 发送到当前会话（按 sessionId 解析 session face）
                const actx = session && session.sessionId ? sessions.scope(session.sessionId) : undefined;
                const face = actx ? sessions.sessionOf(actx) : undefined;
                if (face) {
                  const result = await face.prompt([{ type: "text", text: filled.text }], "queue");
                  if (!result.ok) throw new Error(String(result.error?.message ?? result.error ?? "发送失败"));
                } else {
                  await navigator.clipboard.writeText(filled.text);
                  window.alert(t("tpl.copied"));
                }
              } catch (e) {
                window.alert(t("common.err") + ": " + (e?.message ?? e));
              }
            },
          },
        }), "dsh-pro: /tpl command");
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
