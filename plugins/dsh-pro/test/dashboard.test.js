//! dashboard 测试：工作区 → 会话聚合（live 投影 + 摘要 + 关闭会话降级）。
import { strict as assert } from "node:assert";
import * as dashboard from "../lib/dashboard.js";
import { tempDataDir, fakeSession } from "./helpers.js";

export async function run() {
  const t = await tempDataDir();
  try {
    const live = fakeSession({
      id: "s1",
      seq: 50,
      title: "修复登录",
      messages: [],
    });
    const registry = {
      list: () => [{ id: "w1", path: "C:\\proj", title: "proj", sessionIds: ["s1", "s2"] }],
    };
    const sessions = { get: (id) => (id === "s1" ? live : undefined) };
    const sessionProjections = {
      snapshot: (s) => ({
        values: {
          sessionStats: { steps: 5, turns: 2, llmMs: 100, toolMs: 50, decodeTokens: 10 },
          goal: { objective: "修复登录", phase: "blocked", roundsStarted: 3, maxGoalRounds: 10, blockedReason: "等待确认", activation: "disarmed" },
          todos: [{ content: "改 auth.js", status: "in_progress" }, { content: "跑测试", status: "pending" }],
        },
      }),
    };
    const summariesDoc = {
      load: async () => ({ bySession: { s1: { sessionId: "s1", summary: "摘要内容", turnCount: 2 } } }),
    };
    const deps = {
      workspaceRegistry: registry,
      sessions,
      sessionProjections,
      summariesDoc,
      sessionPersistence: { readRaw: async () => null },
      logger: console,
    };
    const dash = await dashboard.buildDashboard(deps);
    assert.equal(dash.length, 1);
    const ws = dash[0];
    assert.equal(ws.path, "C:\\proj");
    assert.equal(ws.sessions.length, 2);
    const row = ws.sessions.find((s) => s.id === "s1");
    assert.equal(row.goal.phase, "blocked");
    assert.equal(row.goal.blockedReason, "等待确认");
    assert.equal(row.stats.turns, 2);
    assert.equal(row.todos.length, 2);
    assert.ok(row.summary.summary.includes("摘要"));
    const closed = ws.sessions.find((s) => s.id === "s2");
    assert.equal(closed.live, false);
    assert.equal(ws.totals.blocked, 1);
    assert.equal(ws.totals.active, 0);
    return "dashboard OK";
  } finally {
    await t.restore();
  }
}
