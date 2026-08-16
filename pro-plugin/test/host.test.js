//! host 测试：mock ctx 跑真实 apply()，验证 /api/pro/* 路由注册与核心读写。
import { strict as assert } from "node:assert";
import { apply } from "../lib/index.js";
import { tempDataDir, fakeReq, fakeRes, fakeSession } from "./helpers.js";

export async function run() {
  const t = await tempDataDir();
  try {
    const routes = new Map();
    const events = {};
    const live = fakeSession({ id: "s1", title: "会话A", messages: [] });
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
      sessionPersistence: { readRaw: async () => null },
      llm: null,
      sessionProjections: { snapshot: () => ({ values: {} }) },
      logger: console,
      on: (name, fn) => { events[name] = fn; },
    };
    apply(ctx);

    // 路由都注册了
    const expectPaths = [
      "/api/pro/state", "/api/pro/templates", "/api/pro/template", "/api/pro/template/delete",
      "/api/pro/template/fill", "/api/pro/summaries", "/api/pro/summaries/generate",
      "/api/pro/dashboard", "/api/pro/review/start", "/api/pro/review/list",
      "/api/pro/review", "/api/pro/review/diff", "/api/pro/review/accept",
      "/api/pro/review/reject", "/api/pro/review/commit", "/api/pro/review/discard",
    ];
    for (const p of expectPaths) assert.ok(routes.has(p), "路由存在: " + p);

    // 模板 CRUD 往返
    let res = fakeRes();
    await routes.get("/api/pro/templates").handler(fakeReq("GET", "/api/pro/templates"), res);
    assert.equal(res.result().code, 200);
    assert.ok(res.result().body.templates.length >= 4, "内置模板已种子");

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

    // 评审：非 git 目录（用数据目录下建的工作区）
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const ws = path.join(t.dir, "ws");
    await fs.mkdir(ws, { recursive: true });
    await fs.writeFile(path.join(ws, "f.txt"), "v1\n", "utf8");
    res = fakeRes();
    await routes.get("/api/pro/review/start").handler(
      fakeReq("POST", "/api/pro/review/start", { workspacePath: ws }), res);
    assert.equal(res.result().code, 200, "评审开始成功: " + JSON.stringify(res.result().body));
    const revId = res.result().body.review.id;

    res = fakeRes();
    await routes.get("/api/pro/review").handler(fakeReq("GET", "/api/pro/review?id=" + revId), res);
    assert.equal(res.result().code, 200);
    assert.equal(res.result().body.review.status, "open");

    // 修改文件后 diff 路由
    await fs.writeFile(path.join(ws, "f.txt"), "v2\n", "utf8");
    res = fakeRes();
    await routes.get("/api/pro/review").handler(fakeReq("GET", "/api/pro/review?id=" + revId), res);
    const files = res.result().body.review.files;
    assert.ok(files.some((f) => f.path === "f.txt"), "f.txt 出现在差异中");

    res = fakeRes();
    await routes.get("/api/pro/review/diff").handler(
      fakeReq("GET", "/api/pro/review/diff?id=" + revId + "&file=f.txt"), res);
    assert.equal(res.result().code, 200);
    assert.ok(res.result().body.diff.includes("v2"), "diff 包含 v2");

    // 事件订阅存在（自动摘要触发点）
    assert.equal(typeof events["agent/turn-stopping"], "function", "订阅了 agent/turn-stopping");
    return "host OK";
  } finally {
    await t.restore();
  }
}
