//! host 测试：mock ctx 跑真实 apply()，验证 /api/pro/* 路由注册与核心读写。
import { strict as assert } from "node:assert";
import { apply } from "../lib/index.js";
import { tempDataDir, fakeReq, fakeRes, fakeSession } from "./helpers.js";

export async function run() {
  const t = await tempDataDir();
  try {
    const routes = new Map();
    const events = {};
    const msgs = [];
    const live = fakeSession({ id: "s1", title: "会话A", messages: msgs });
    const fakeAgent = {
      status: "inactive",
      followups: [],
      cancels: 0,
      followup(m) { this.followups.push(m); this.status = "running"; },
      cancel() { this.cancels++; this.status = "inactive"; },
    };
    const ctx = {
      workspaceRegistry: {
        list: () => [{ id: "w1", path: "C:\\proj", title: "proj", sessionIds: ["s1"] }],
      },
      webServer: {
        register: (route) => {
          routes.set(route.path, route);
          return () => routes.delete(route.path);
        },
      },
      sessions: { get: (id) => (id === "s1" ? live : undefined), list: () => [live] },
      agents: { get: (id) => (id === "s1" ? fakeAgent : undefined) },
      sessionPersistence: { readRaw: async () => null },
      llm: null,
      sessionProjections: { snapshot: () => ({ values: {} }) },
      logger: console,
      on: (name, fn) => { events[name] = fn; },
    };
    apply(ctx);

    // 路由都注册了（评审为任务式：start/list/detail/terminate/end）
    const expectPaths = [
      "/api/pro/state", "/api/pro/templates", "/api/pro/template", "/api/pro/template/delete",
      "/api/pro/template/fill", "/api/pro/summaries", "/api/pro/summaries/generate",
      "/api/pro/dashboard", "/api/pro/review/start", "/api/pro/review/list",
      "/api/pro/review", "/api/pro/review/terminate", "/api/pro/review/end",
    ];
    for (const p of expectPaths) assert.ok(routes.has(p), "路由存在: " + p);

    // 模板 CRUD 往返
    let res = fakeRes();
    await routes.get("/api/pro/templates").handler(fakeReq("GET", "/api/pro/templates"), res);
    assert.equal(res.result().code, 200);
    assert.ok(res.result().body.templates.length >= 5, "内置模板已种子（>=5）");

    res = fakeRes();
    await routes.get("/api/pro/templates").handler(
      fakeReq("POST", "/api/pro/templates", { name: "接口模板", prompt: "做 {{x}}", variables: [{ key: "x", label: "X" }] }), res);
    assert.equal(res.result().code, 200);
    const createdId = res.result().body.template.id;

    res = fakeRes();
    await routes.get("/api/pro/template/fill").handler(
      fakeReq("POST", "/api/pro/template/fill", { id: createdId, values: { x: "测试" } }), res);
    assert.equal(res.result().body.text, "做 测试");

    // 仪表盘
    res = fakeRes();
    await routes.get("/api/pro/dashboard").handler(fakeReq("GET", "/api/pro/dashboard"), res);
    assert.equal(res.result().code, 200);
    assert.equal(res.result().body.dashboard.length, 1);

    // 摘要生成（无 llm 服务 → 优雅报错而非崩溃）
    res = fakeRes();
    await routes.get("/api/pro/summaries/generate").handler(
      fakeReq("POST", "/api/pro/summaries/generate", { sessionId: "s1" }), res);
    assert.ok(res.result().code === 400, "无 llm 时返回 400 而非 500");

    // 评审：任务式（默认模板「评审：测试+安全」投递会话 AI）
    res = fakeRes();
    await routes.get("/api/pro/review/start").handler(
      fakeReq("POST", "/api/pro/review/start", { sessionId: "s1" }), res);
    assert.equal(res.result().code, 200, "评审开始成功: " + JSON.stringify(res.result().body));
    const revId = res.result().body.review.id;
    assert.equal(res.result().body.review.status, "running");
    assert.ok(fakeAgent.followups.length === 1, "已投递评审任务到会话 agent");
    assert.ok(fakeAgent.followups[0].content[0].text.includes("npm test"), "prompt 含预置测试命令");

    res = fakeRes();
    await routes.get("/api/pro/review").handler(fakeReq("GET", "/api/pro/review?id=" + revId), res);
    assert.equal(res.result().code, 200);
    assert.equal(res.result().body.review.status, "running");

    // 评审列表应补充会话标题（单列表展示会话内容用）
    res = fakeRes();
    await routes.get("/api/pro/review/list").handler(fakeReq("GET", "/api/pro/review/list"), res);
    assert.equal(res.result().code, 200);
    const listed = res.result().body.reviews.find((rv) => rv.id === revId);
    assert.equal(listed.sessionTitle, "会话A", "review list 携带 sessionTitle");

    // AI 完成（agent inactive + 会话出现 assistant 报告）→ 状态 done
    msgs.push({ role: "assistant", content: [{ type: "text", text: "测试通过\n结论：通过" }] });
    fakeAgent.status = "inactive";
    res = fakeRes();
    await routes.get("/api/pro/review").handler(fakeReq("GET", "/api/pro/review?id=" + revId), res);
    assert.equal(res.result().body.review.status, "done", "AI 回合结束 → done");
    assert.ok(res.result().body.review.report.includes("测试通过"), "报告已提取");

    // 终止：中断 AI 回合
    res = fakeRes();
    await routes.get("/api/pro/review/start").handler(
      fakeReq("POST", "/api/pro/review/start", { sessionId: "s1" }), res);
    const revId2 = res.result().body.review.id;
    res = fakeRes();
    await routes.get("/api/pro/review/terminate").handler(
      fakeReq("POST", "/api/pro/review/terminate", { id: revId2 }), res);
    assert.equal(res.result().code, 200);
    assert.equal(res.result().body.review.status, "terminated");
    assert.ok(fakeAgent.cancels >= 1, "调用了 agent.cancel");

    // 事件订阅存在（自动摘要触发点）
    assert.equal(typeof events["agent/turn-stopping"], "function", "订阅了 agent/turn-stopping");
    return "host OK";
  } finally {
    await t.restore();
  }
}
