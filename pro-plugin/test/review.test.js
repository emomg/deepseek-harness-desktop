//! review 测试：任务式评审（跑测试+安全检查，可随时终止/结束）。
//! fake agents/sessions 注入，无头运行；评审记录走临时数据目录。
import { strict as assert } from "node:assert";
import * as review from "../lib/review.js";
import * as templates from "../lib/templates.js";
import { tempDataDir } from "./helpers.js";

function fakeSession({ id = "s1", cwd = "C:\\proj", messages = [] } = {}) {
  return {
    id,
    header: { cwd, id },
    deriveMessages: () => messages,
  };
}

export async function run() {
  const t = await tempDataDir();
  try {
    // 种子模板（含内置「评审：测试+安全」）
    await templates.ensureSeeded(templates.templatesDoc());
    const tpls = await templates.listTemplates(templates.templatesDoc());
    assert.ok(tpls.some((x) => x.id === review.REVIEW_TEMPLATE_ID), "内置评审模板存在");
    assert.ok(tpls.length >= 5, "内置模板 >= 5");

    const messages = [];
    const session = fakeSession({ id: "s1", messages });
    const agent = {
      status: "inactive",
      followups: [],
      cancels: 0,
      followup(m) { this.followups.push(m); },
      cancel() { this.cancels++; },
    };
    const deps = {
      sessions: { get: (id) => (id === "s1" ? session : undefined) },
      agents: { get: (id) => (id === "s1" ? agent : undefined) },
    };

    // 开始评审 → running + 投递含预置命令清单的评审 prompt
    const rev = await review.startReview(deps, { sessionId: "s1" });
    assert.equal(rev.status, "running");
    assert.equal(rev.templateId, review.REVIEW_TEMPLATE_ID);
    assert.equal(rev.sessionId, "s1");
    assert.equal(rev.workspacePath, "C:\\proj");
    assert.ok(rev.prompt.includes("npm test"), "prompt 含预置测试命令");
    assert.ok(rev.prompt.includes("npm audit"), "prompt 含预置安全命令");
    assert.equal(agent.followups.length, 1);
    assert.equal(agent.followups[0].role, "user");
    assert.ok(agent.followups[0].content[0].text.includes("评审"), "投递的是评审任务");

    // 同会话重复开始被拒
    await assert.rejects(() => review.startReview(deps, { sessionId: "s1" }), /已有进行中的评审/);

    // agent 运行中 → 状态保持 running
    agent.status = "running";
    assert.equal(review.refreshReviewState(deps, rev), false, "运行中不结束");

    // agent 停止 + 有报告 → done
    messages.push({ role: "assistant", content: [{ type: "text", text: "测试通过\n安全无漏洞\n结论：通过" }] });
    agent.status = "inactive";
    assert.equal(review.refreshReviewState(deps, rev), true, "状态变化");
    assert.equal(rev.status, "done");
    assert.ok(rev.report.includes("测试通过"), "报告已提取");

    // 列表
    const list = await review.listReviews(deps);
    assert.equal(list.length, 1);
    assert.equal(list[0].status, "done");

    // 新评审 → 终止
    const rev2 = await review.startReview(deps, { sessionId: "s1" });
    assert.equal(rev2.status, "running");
    const term = await review.terminateReview(deps, rev2.id);
    assert.equal(term.status, "terminated");
    assert.ok(term.terminatedAt > 0, "记录终止时间");
    assert.ok(agent.cancels >= 1, "调用了 agent.cancel");

    // 再开始 → 结束（running 中结束会一并中断任务）
    const rev3 = await review.startReview(deps, { sessionId: "s1" });
    const ended = await review.endReview(deps, rev3.id);
    assert.equal(ended.status, "ended");
    assert.ok(agent.cancels >= 2, "结束 running 评审时也中断了任务");

    // 已结束再结束报错
    await assert.rejects(() => review.endReview(deps, rev3.id), /已结束/);

    // 会话不存在报错
    await assert.rejects(() => review.startReview(deps, { sessionId: "nope" }), /会话不存在/);
    // agent 不存在报错
    const deps2 = { sessions: { get: () => session }, agents: { get: () => undefined } };
    await assert.rejects(() => review.startReview(deps2, { sessionId: "s1" }), /没有活动的 agent/);

    // 旧版门禁记录迁移：open + baseline → ended，字段剥离
    const data = await review.reviewsDoc().load();
    data.reviews.push({
      id: "rev-legacy", sessionId: "s1", workspacePath: "C:\\proj",
      createdAt: Date.now() - 1000, status: "open",
      baseline: { type: "copy", fileCount: 23656 }, files: {}, message: null, committedAt: null,
    });
    await review.reviewsDoc().save(data);
    const migrated = await review.getReview(deps, "rev-legacy");
    assert.equal(migrated.status, "ended", "旧记录迁移为 ended");
    assert.equal(migrated.baseline, undefined, "剥离 baseline");
    assert.equal(migrated.files, undefined, "剥离 files");
    const after = (await review.reviewsDoc().load()).reviews;
    assert.ok(after.every((x) => x.status !== "open"), "不再有旧状态记录");

    // makeUserMessage 形状对齐 dsh-llm
    const m = review.makeUserMessage("hi");
    assert.equal(m.role, "user");
    assert.equal(m.content[0].type, "text");
    assert.equal(m.content[0].text, "hi");
    assert.equal(m.source.kind, "user");
    assert.ok(typeof m.id === "string" && m.id.length > 0, "有消息 id");

    // reportOfSession：取最后一条 assistant 文本
    assert.ok(review.reportOfSession(session).includes("测试通过"));
    assert.equal(review.reportOfSession(null), "");

    return "review OK";
  } finally {
    await t.restore();
  }
}
