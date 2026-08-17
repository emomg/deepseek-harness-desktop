//! @dsh-pro/core · 宿主插件 v2
//!
//! 四个能力：任务模板库 / 项目仪表盘 / 会话自动摘要 / 评审门禁。
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

  // ---- 会话基线：会话创建时捕获该会话开始时的 git 提交（按会话评审用） ----
  ctx.on("session/created", (session) => {
    try {
      const sid = session?.sessionId ?? session?.id;
      if (!sid) return;
      const ws = workspaceOfSession(sid);
      if (!ws) return;
      review.captureSessionBaseline(deps, sid, ws.path).catch(() => {});
    } catch {
      /* ignore */
    }
  });

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

    // ---- 评审门禁 ----
    {
      kind: "exact",
      path: "/api/pro/review/start",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          let workspacePath = body.workspacePath;
          let sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
          // 按会话评审：只传 sessionId 时自动解析其工作区
          if ((typeof workspacePath !== "string" || !workspacePath) && sessionId) {
            const ws = workspaceOfSession(sessionId);
            if (!ws) throw new Error("会话不属于任何工作区，无法定位评审目录");
            workspacePath = ws.path;
          }
          if (typeof workspacePath !== "string" || !workspacePath) {
            throw new Error("缺少 workspacePath 或 sessionId");
          }
          const rev = await review.startReview(deps, { workspacePath, sessionId });
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    {
      kind: "exact",
      path: "/api/pro/review/list",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const revs = await review.listReviews(deps);
          // 补充会话标题（单列表/按工作区展示"会话内容"用）
          for (const rev of revs) {
            rev.sessionTitle = rev.sessionId ? sessionTitleOf(rev.sessionId) : null;
          }
          writeJson(res, 200, { ok: true, reviews: revs });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },

    // 评审详情（GET ?id=）——含刷新后的文件差异清单
    {
      kind: "exact",
      path: "/api/pro/review",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const id = queryOf(req).get("id") ?? "";
          const rev = await review.getReview(deps, id);
          const files = Object.entries(rev.files ?? {}).map(([path, f]) => ({
            path,
            status: f.status,
            decision: f.decision,
          }));
          writeJson(res, 200, { ok: true, review: { ...rev, files } });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 单文件差异（GET ?id=&file=）
    {
      kind: "exact",
      path: "/api/pro/review/diff",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const id = queryOf(req).get("id") ?? "";
          const file = queryOf(req).get("file") ?? "";
          const rev = await review.getReview(deps, id);
          const text = await review.reviewFileDiff(deps, rev, file);
          writeJson(res, 200, { ok: true, diff: text });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 接受文件（body: { id, file }）
    {
      kind: "exact",
      path: "/api/pro/review/accept",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const rev = await review.getReview(deps, body.id);
          await review.acceptFile(deps, rev, body.file);
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 拒绝文件（body: { id, file }）
    {
      kind: "exact",
      path: "/api/pro/review/reject",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const rev = await review.getReview(deps, body.id);
          await review.rejectFile(deps, rev, body.file);
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 提交（body: { id, message? }）
    {
      kind: "exact",
      path: "/api/pro/review/commit",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const rev = await review.getReview(deps, body.id);
          await review.commitReview(deps, rev, body.message);
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 放弃（body: { id }）
    {
      kind: "exact",
      path: "/api/pro/review/discard",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const rev = await review.getReview(deps, body.id);
          await review.discardReview(deps, rev);
          writeJson(res, 200, { ok: true, review: rev });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
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
