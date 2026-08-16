//! summarize 测试：路由解析、消息抽取、LLM 调用、自动摘要存储。
import { strict as assert } from "node:assert";
import * as summarize from "../lib/summarize.js";
import { tempDataDir, fakeSession, fakeLlmKit } from "./helpers.js";

export async function run() {
  const t = await tempDataDir();
  try {
    // 路由解析
    const session = fakeSession({
      events: [
        { type: "request/header", data: { provider: "deepseek", model: "deepseek-chat" } },
        { type: "turn/end" },
      ],
      messages: [
        { role: "user", content: [{ type: "text", text: "请修复登录 bug" }] },
        { role: "assistant", content: [{ type: "text", text: "已修复，改了 auth.js" }] },
      ],
    });
    const route = summarize.routeOfSession(session);
    assert.deepEqual(route, { provider: "deepseek", model: "deepseek-chat" });
    const msgs = summarize.recentMessages(session);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, "user");
    assert.equal(msgs[1].text, "已修复，改了 auth.js");

    // LLM 调用
    const { llm, kit } = fakeLlmKit("- 目标：修复登录\n- 完成：已修复 auth.js\n- 下一步：无");
    const result = await summarize.summarizeSession({ llm, llmKit: kit, logger: console }, session);
    assert.ok(result.ok, "摘要成功");
    assert.ok(result.summary.includes("目标"), "摘要内容");

    // 无路由 → 跳过
    const noRoute = fakeSession({ events: [], messages: [{ role: "user", content: "hi" }] });
    const r2 = await summarize.summarizeSession({ llm, llmKit: kit }, noRoute);
    assert.equal(r2.ok, false);

    // 自动摘要：新活动 + 节流通过
    const deps = { llm, llmKit: kit, logger: console };
    const entry = await summarize.maybeAutoSummarize(deps, session, "C:\\proj");
    assert.ok(entry, "生成并入库");
    assert.equal(entry.workspacePath, "C:\\proj");
    assert.equal(entry.turnCount, 1);
    // 无新活动 → 不再生成
    const again = await summarize.maybeAutoSummarize(deps, session, "C:\\proj");
    assert.equal(again, null, "无新活动跳过");
    return "summarize OK";
  } finally {
    await t.restore();
  }
}
