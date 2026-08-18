//! @dsh-pro/core · 宿主插件 v2
//!
//! 四个能力：任务模板库 / 项目仪表盘 / 会话自动摘要 / 评审任务（测试+安全，可终止/结束）。
//! 复用 DSH 原生服务：workspaceRegistry（工作区→会话）、sessions、sessionPersistence、
//! sessionProjections（goal/todos/sessionStats）、llm（摘要生成）、webServer（/api/pro/*）。
//! 数据目录：DSH_PRO_DATA_DIR 或 %LOCALAPPDATA%\DeepSeek Harness Pro\data。

import path from "node:path";
import { promises as fs } from "node:fs";
import { dataDir, jsonDoc, newId } from "./store.js";
import * as templates from "./templates.js";
import * as summarize from "./summarize.js";
import * as dashboard from "./dashboard.js";
import * as review from "./review.js";

export const name = "dsh-pro";

export const inject = [
  "workspaceRegistry",
  "webServer",
  "sessions",
  "agents",
  "sessionPersistence",
  "llm",
  "sessionProjections",
];

// ---------------------------------------------------------------- helpers

function writeJson(res, code, body) {
  try {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  } catch {
    /* connection closed */
  }
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function methodOf(req, res, method) {
  if (req.method === method) return true;
  writeJson(res, 405, { error: "method " + req.method + " not allowed" });
  return false;
}

function queryOf(req) {
  try {
    return new URL(req.url, "http://127.0.0.1").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

// ---------------------------------------------------------------- plugin

export function apply(ctx) {
  const registry = ctx.workspaceRegistry;
  const templatesDoc = jsonDoc(dataDir(), "templates.json", { templates: [] });
  const summariesDoc = summarize.summariesDoc();
  const reviewsDoc = review.reviewsDoc();

  const deps = {
    llm: ctx.llm,
    sessions: ctx.sessions,
    agents: ctx.agents,
    sessionPersistence: ctx.sessionPersistence,
    sessionProjections: ctx.sessionProjections,
    workspaceRegistry: registry,
    summariesDoc,
    reviewsDoc,
    logger: ctx.logger,
  };

  // 首次运行播种内置模板
  templates.ensureSeeded(templatesDoc).catch(() => {});

  /** 会话 → 工作区实体。 */
  function workspaceOfSession(sessionId) {
    if (!sessionId) return null;
    try {
      for (const ws of registry.list()) {
        const ids = ws.sessionIds;
        if (Array.isArray(ids) && ids.includes(sessionId)) return ws;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /** 会话标题（尽力而为）。 */
  function sessionTitleOf(sessionId) {
    try {
      const s = ctx.sessions?.get?.(sessionId);
      const t = s?.title ?? s?.name;
      if (typeof t === "string" && t) return t;
    } catch {
      /* ignore */
    }
    return null;
  }


  // ---- 自动摘要：每轮任务收尾时触发（有新活动 + 节流通过才生成） ----
  ctx.on("agent/turn-stopping", (payload) => {
    try {
      const agent = payload?.agent;
      const sessionId = agent?.sessionId ?? agent?.id;
      if (!sessionId) return;
      const ws = workspaceOfSession(sessionId);
      if (!ws) return; // 会话不属于任何工作区，跳过（Pro 只跟踪项目会话）
      const session = ctx.sessions?.get?.(sessionId);
      if (!session) return;
      // 异步生成，不阻塞回合收尾
      summarize.maybeAutoSummarize(deps, session, ws.path).catch((e) => {
        ctx.logger?.warn?.("[dsh-pro] auto summary failed: " + String(e?.message ?? e));
      });
    } catch (e) {
      ctx.logger?.warn?.("[dsh-pro] turn-stopping handler failed: " + String(e?.message ?? e));
    }
  });

  const routes = [
    // 面板一次性数据：模板 + 摘要 + 评审 + 仪表盘
    {
      kind: "exact",
      path: "/api/pro/state",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const [tpls, sums, revs, dash] = await Promise.all([
            templates.listTemplates(templatesDoc),
            summarize.listSummaries(summariesDoc),
            review.listReviews(deps),
            dashboard.buildDashboard(deps),
          ]);
          writeJson(res, 200, { ok: true, templates: tpls, summaries: sums, reviews: revs, dashboard: dash, dataDir: dataDir() });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },

    // ---- 任务模板库 ----
    {
      kind: "exact",
      path: "/api/pro/templates",
      handler: async (req, res) => {
        if (req.method === "GET") {
          try {
            writeJson(res, 200, { ok: true, templates: await templates.listTemplates(templatesDoc) });
          } catch (e) {
            writeJson(res, 500, { error: String(e?.message ?? e) });
          }
          return;
        }
        if (req.method === "POST") {
          try {
            const tpl = await templates.createTemplate(templatesDoc, await readJsonBody(req));
            writeJson(res, 200, { ok: true, template: tpl });
          } catch (e) {
            writeJson(res, 400, { error: String(e?.message ?? e) });
          }
          return;
        }
        writeJson(res, 405, { error: "method not allowed" });
      },
    },

    // 更新模板（body: { id, ... }）
    {
      kind: "exact",
      path: "/api/pro/template",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          if (typeof body.id !== "string" || !body.id) throw new Error("缺少模板 id");
          const tpl = await templates.updateTemplate(templatesDoc, body.id, body);
          writeJson(res, 200, { ok: true, template: tpl });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 删除模板（body: { id }）
    {
      kind: "exact",
      path: "/api/pro/template/delete",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          if (typeof body.id !== "string" || !body.id) throw new Error("缺少模板 id");
          await templates.deleteTemplate(templatesDoc, body.id);
          writeJson(res, 200, { ok: true });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 模板变量填充预览（body: { id, values } → { text }）
    {
      kind: "exact",
      path: "/api/pro/template/fill",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const tpl = await templates.getTemplate(templatesDoc, body.id);
          if (!tpl) throw new Error("模板不存在: " + body.id);
          const text = templates.fillTemplate(tpl, body.values ?? {});
          writeJson(res, 200, { ok: true, text });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // ---- 会话自动摘要 ----
    {
      kind: "exact",
      path: "/api/pro/summaries",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          writeJson(res, 200, { ok: true, summaries: await summarize.listSummaries(summariesDoc) });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },

    // 手动生成某会话摘要（body: { sessionId }）
    {
      kind: "exact",
      path: "/api/pro/summaries/generate",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const sessionId = body.sessionId;
          const session = ctx.sessions?.get?.(sessionId);
          if (!session) throw new Error("会话不存在或未加载: " + sessionId);
          const ws = workspaceOfSession(sessionId);
          const result = await summarize.summarizeSession(deps, session);
          if (!result.ok) throw new Error(result.error);
          const data = await summariesDoc.load();
          const entry = data.bySession[sessionId];
          const now = Date.now();
          data.bySession[sessionId] = {
            sessionId,
            workspacePath: ws?.path ?? null,
            summary: result.summary,
            model: result.model,
            turnCount: summarize.countTurns(session),
            lastSeq: session.seq,
            createdAt: entry?.createdAt ?? now,
            updatedAt: now,
          };
          await summariesDoc.save(data);
          writeJson(res, 200, { ok: true, summary: data.bySession[sessionId] });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // ---- 项目仪表盘 ----
    {
      kind: "exact",
      path: "/api/pro/dashboard",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          writeJson(res, 200, { ok: true, dashboard: await dashboard.buildDashboard(deps) });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },

    // ---- 评审：任务式（跑测试 + 安全检查，可随时终止/结束） ----
    // 开始评审（body: { sessionId, templateId?, values? }）
    {
      kind: "exact",
      path: "/api/pro/review/start",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const rev = await review.startReview(deps, {
            sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
            templateId: typeof body.templateId === "string" && body.templateId ? body.templateId : undefined,
            values: body.values && typeof body.values === "object" ? body.values : undefined,
          });
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 评审列表（GET；running 的评审先刷新状态）
    {
      kind: "exact",
      path: "/api/pro/review/list",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const revs = await review.listReviews(deps);
          for (const rev of revs) {
            rev.sessionTitle = rev.sessionId ? sessionTitleOf(rev.sessionId) : null;
          }
          writeJson(res, 200, { ok: true, reviews: revs });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },

    // 评审详情（GET ?id=）
    {
      kind: "exact",
      path: "/api/pro/review",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const id = queryOf(req).get("id") ?? "";
          const rev = await review.getReview(deps, id);
          rev.sessionTitle = rev.sessionId ? sessionTitleOf(rev.sessionId) : null;
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 终止（body: { id }）——中断 AI 回合
    {
      kind: "exact",
      path: "/api/pro/review/terminate",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const rev = await review.terminateReview(deps, body.id);
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 结束（body: { id }）——任何时候手动收尾
    {
      kind: "exact",
      path: "/api/pro/review/end",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const rev = await review.endReview(deps, body.id);
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // ---- 设置页：技能（Skill）管理 ----
    {
      kind: "exact",
      path: "/api/pro/skills",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const skills = ctx.get("skills");
          let rows = [];
          if (skills && typeof skills.list === "function") {
            const out = await skills.list({});
            rows = (out?.skills ?? []).map((s) => ({
              name: s.name,
              description: s.description,
              provider: s.provider,
              source: s.source,
              whenToUse: s.whenToUse,
              modelInvocable: !!s.invocation?.modelInvocable,
              userInvocable: !!s.invocation?.userInvocable,
            }));
          }
          // 预设技能库：agent-presets 目录下的 skills/*/SKILL.md（管理视角）
          const presets = [];
          const presetsService = ctx.get("agentPresets");
          let roster = [];
          try {
            roster = typeof presetsService?.list === "function" ? await presetsService.list() : [];
          } catch {
            roster = [];
          }
          for (const preset of roster) {
            const presetFile = preset?.path ?? preset?.dir;
            if (typeof presetFile !== "string") continue;
            // roster 的 path 指向 preset 目录内的 agent.cordis.yml，目录取 dirname
            const presetDir = path.dirname(presetFile);
            const presetSkills = [];
            const skillsDir = path.join(presetDir, "skills");
            let entries = [];
            try {
              entries = await fs.readdir(skillsDir, { withFileTypes: true });
            } catch {
              entries = [];
            }
            for (const e of entries) {
              if (!e.isDirectory()) continue;
              const skillDir = path.join(skillsDir, e.name);
              let description = "";
              try {
                const head = (await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8")).slice(0, 400);
                description =
                  head.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith("#"))?.trim() ?? "";
              } catch {
                continue;
              }
              presetSkills.push({ name: e.name, description });
            }
            presets.push({
              id: preset?.id ?? preset?.name ?? path.basename(presetDir),
              name: preset?.name ?? path.basename(presetDir),
              path: presetDir,
              skills: presetSkills,
            });
          }
          // 用户技能根：$DSH_HOME/skills（所有带 skill-filesystem 预设的 agent 都会读到）
          const userSkills = [];
          const dshHome = process.env.DSH_HOME || path.join(process.env.USERPROFILE || "", ".dsh");
          const userSkillsDir = path.join(dshHome, "skills");
          let userSkillEntries = [];
          try {
            userSkillEntries = await fs.readdir(userSkillsDir, { withFileTypes: true });
          } catch {
            userSkillEntries = [];
          }
          for (const e of userSkillEntries) {
            if (!e.isDirectory()) continue;
            const skillDir = path.join(userSkillsDir, e.name);
            let description = "";
            try {
              const head = (await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8")).slice(0, 400);
              description =
                head.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith("#"))?.trim() ?? "";
            } catch {
              continue;
            }
            userSkills.push({ name: e.name, description, path: skillDir });
          }
          writeJson(res, 200, { ok: true, skills: rows, presets, userSkills });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },

    // ---- 设置页：MCP 服务器管理 ----
    {
      kind: "exact",
      path: "/api/pro/mcp",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const loader = ctx.get("loader");
          const tools = ctx.get("tools");
          const fiberLabel = (state) =>
            ({ 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: "unloading", 5: "disposed" }[state] ?? "unknown");
          let toolNames = [];
          try {
            if (tools && typeof tools.schemas === "function") {
              for (const s of tools.schemas() ?? []) toolNames.push(s?.name ?? "");
            }
          } catch {
            /* tools 不可用时仅展示配置 */
          }
          const servers = [];
          const seen = new Set();
          for (const entry of loader?.entries?.() ?? []) {
            const name = entry?.options?.name;
            if (name !== "mcp-client") continue;
            const cfg = entry?.options?.config ?? {};
            const serverName = cfg.serverName ?? "unknown";
            if (seen.has(serverName)) continue;
            seen.add(serverName);
            servers.push({
              serverName,
              transport: cfg.transport ?? "unknown",
              command: cfg.command ?? null,
              args: Array.isArray(cfg.args) ? cfg.args : [],
              url: cfg.url ?? null,
              cwd: cfg.cwd ?? null,
              envKeys: cfg.env && typeof cfg.env === "object" ? Object.keys(cfg.env) : [],
              headerKeys: cfg.headers && typeof cfg.headers === "object" ? Object.keys(cfg.headers) : [],
              failOnStartupError: !!cfg.failOnStartupError,
              reconnectEnabled: !!cfg.reconnect?.enabled,
              state: fiberLabel(entry?.fiber?.state),
              disabled: !!entry?.disabled,
              toolCount: toolNames.filter((n) => n.startsWith("mcp__" + serverName + "__")).length,
            });
          }
          writeJson(res, 200, { ok: true, servers });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },
  ];

  const disposers = routes.map((route) => ctx.webServer.register(route));
  ctx.on("dispose", () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        /* ignore */
      }
    }
  });
}
