//! @dsh-pro/core · review v2：任务式评审（跑测试 + 安全检查，可随时终止/结束）。
//! 评审 = 把评审 prompt（来自模板，默认内置「评审：测试+安全」，含预置命令清单）
//!       发给会话 AI（agent.followup），AI 在会话里跑测试/查安全并出报告；
//!       评审页可随时「终止」（agent.cancel 中断 AI 回合）或「结束」（手动收尾）。
//! 状态机：running → done（AI 回合结束）/ terminated（用户终止）/ ended（用户结束）。
//! deps = { agents, sessions } 可注入（无头测试用 fake），默认真实 ctx 服务。
//! 评审记录只存 Pro 数据目录（reviews.json），不写 DSH 会话日志。

import crypto from "node:crypto";
import { jsonDoc, dataDir, newId } from "./store.js";
import * as templates from "./templates.js";

// ---------------------------------------------------------------- 状态

export const STATUS = {
  RUNNING: "running",
  DONE: "done",
  TERMINATED: "terminated",
  ENDED: "ended",
};

/** 评审默认使用的模板 id（内置「评审：测试+安全」）。 */
export const REVIEW_TEMPLATE_ID = "tpl-review-task";

export function reviewsDoc() {
  return jsonDoc(dataDir(), "reviews.json", { reviews: [] });
}

// ---------------------------------------------------------------- 工具

/** 构造投递给 agent 的 user message（形状对齐 dsh-llm createUserMessage，零依赖）。 */
export function makeUserMessage(text) {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content: [{ type: "text", text: String(text ?? "") }],
    source: { kind: "user" },
  };
}

/** 从会话派生的消息里取最后一条 assistant 文本（评审报告）。 */
export function reportOfSession(session) {
  if (!session) return "";
  let messages = [];
  try {
    messages = typeof session.deriveMessages === "function" ? session.deriveMessages() : [];
  } catch {
    messages = [];
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== "assistant") continue;
    let text = "";
    const content = m.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block.text === "string") text += block.text;
      }
    } else if (typeof content === "string") {
      text = content;
    }
    text = text.trim();
    if (text) return text;
  }
  return "";
}

/**
 * 迁移旧版门禁记录（v1：status ∈ open/committed/discarded，带 baseline/files）→ 新格式：
 * 置为 ended（已结束），剥离门禁字段，并尽力清理其复制基线目录（v1 遗留，可能很大）。
 * 返回是否发生变化。
 */
export async function normalizeReview(rev) {
  if (!rev) return false;
  const legacy = rev.baseline !== undefined || rev.files !== undefined || ["open", "committed", "discarded"].includes(rev.status);
  if (!legacy) return false;
  if (rev.status !== "ended") {
    rev.status = "ended";
    rev.endedAt = rev.endedAt ?? Date.now();
  }
  delete rev.baseline;
  delete rev.files;
  delete rev.message;
  delete rev.committedAt;
  // 尽力清理 v1 复制基线目录（reviews/<id>/baseline）
  try {
    const { promises: fs2 } = await import("node:fs");
    const path2 = await import("node:path");
    const dir = path2.join(dataDir(), "reviews", rev.id, "baseline");
    await fs2.rm(dir, { recursive: true, force: true });
  } catch {
    /* 清理失败不影响评审 */
  }
  return true;
}

/** 按 id 取评审记录（纯读，不刷新状态）。 */
async function findReview(id) {
  const data = await reviewsDoc().load();
  const review = data.reviews.find((r) => r.id === id);
  if (!review) throw new Error("评审不存在: " + id);
  return review;
}

async function saveReview(review) {
  const data = await reviewsDoc().load();
  const pos = data.reviews.findIndex((r) => r.id === review.id);
  if (pos >= 0) data.reviews[pos] = review;
  else data.reviews.push(review);
  await reviewsDoc().save(data);
}

// ---------------------------------------------------------------- 状态刷新

/**
 * 刷新评审状态（只处理 running）：按会话 agent 状态 + 最新 assistant 报告推断。
 * - agent 不再运行（回合结束）→ done（finishedAt）；
 * - 同步最新报告文本。
 * 返回是否发生变化（便于调用方决定是否落盘）。
 */
export function refreshReviewState(deps, review) {
  if (!review || review.status !== STATUS.RUNNING) return false;
  const agent = deps?.agents?.get?.(review.sessionId);
  const session = deps?.sessions?.get?.(review.sessionId);
  const running = agent?.status === "running";
  const report = reportOfSession(session);
  let changed = false;
  if (report && report !== review.report) {
    review.report = report;
    changed = true;
  }
  if (!running) {
    review.status = STATUS.DONE;
    review.finishedAt = Date.now();
    changed = true;
  }
  return changed;
}

// ---------------------------------------------------------------- 动作

/** 评审列表（按创建时间倒序）；running 的评审先刷新状态。 */
export async function listReviews(deps) {
  const data = await reviewsDoc().load();
  let changed = false;
  for (const review of data.reviews) {
    if (await normalizeReview(review)) changed = true;
    if (refreshReviewState(deps, review)) changed = true;
  }
  if (changed) await reviewsDoc().save(data);
  return [...data.reviews].sort((a, b) => b.createdAt - a.createdAt);
}

/** 取单个评审（含刷新）。 */
export async function getReview(deps, id) {
  const review = await findReview(id);
  let changed = await normalizeReview(review);
  if (refreshReviewState(deps, review)) changed = true;
  if (changed) await saveReview(review);
  return review;
}

/**
 * 开始评审：填模板 prompt → 投递会话 AI（queue 模式）→ 记录 running。
 * 同一会话同时只允许一个进行中的评审。
 */
export async function startReview(deps, { sessionId, templateId, values } = {}) {
  if (!sessionId) throw new Error("缺少 sessionId");
  const session = deps?.sessions?.get?.(sessionId);
  if (!session) throw new Error("会话不存在或未加载: " + sessionId);
  const agent = deps?.agents?.get?.(sessionId);
  if (!agent) throw new Error("会话没有活动的 agent，无法发起评审（会话需处于打开状态）");

  const data = await reviewsDoc().load();
  if (data.reviews.some((r) => r.status === STATUS.RUNNING && r.sessionId === sessionId)) {
    throw new Error("该会话已有进行中的评审，请先终止或结束");
  }

  // 评审 prompt：来自模板（默认内置「评审：测试+安全」），未填变量用模板默认值
  const templateIdResolved = templateId || REVIEW_TEMPLATE_ID;
  const templatesDoc = templates.templatesDoc();
  await templates.ensureSeeded(templatesDoc);
  const tpl = await templates.getTemplate(templatesDoc, templateIdResolved);
  let prompt;
  if (tpl) {
    prompt = templates.fillTemplate(tpl, values ?? {});
  } else {
    prompt = String(values?.prompt ?? "").trim();
    if (!prompt) throw new Error("模板不存在: " + templateIdResolved);
  }

  const review = {
    id: newId("rev"),
    sessionId,
    workspacePath: typeof session.header?.cwd === "string" ? session.header.cwd : null,
    templateId: tpl?.id ?? null,
    templateName: tpl?.name ?? null,
    prompt,
    createdAt: Date.now(),
    status: STATUS.RUNNING,
    startedAt: Date.now(),
    finishedAt: null,
    terminatedAt: null,
    endedAt: null,
    report: "",
  };

  try {
    agent.followup(makeUserMessage(prompt));
  } catch (e) {
    throw new Error("投递评审任务失败: " + String(e?.message ?? e));
  }

  data.reviews.push(review);
  await reviewsDoc().save(data);
  return review;
}

/** 终止：中断 AI 回合（agent.cancel），记录置为 terminated。 */
export async function terminateReview(deps, id) {
  const review = await findReview(id);
  if (review.status !== STATUS.RUNNING) throw new Error("评审已结束，无需终止");
  const agent = deps?.agents?.get?.(review.sessionId);
  if (agent) {
    try {
      agent.cancel({ kind: "user" }, { keepInbox: true });
    } catch {
      /* 尽力中断 */
    }
  }
  review.status = STATUS.TERMINATED;
  review.terminatedAt = Date.now();
  review.report = reportOfSession(deps?.sessions?.get?.(review.sessionId)) || review.report || "";
  await saveReview(review);
  return review;
}

/** 结束：任何时候手动收尾（保留报告）；若还在运行则一并中断任务。 */
export async function endReview(deps, id) {
  const review = await findReview(id);
  if (review.status === STATUS.ENDED) throw new Error("评审已结束");
  if (review.status === STATUS.RUNNING) {
    const agent = deps?.agents?.get?.(review.sessionId);
    if (agent) {
      try {
        agent.cancel({ kind: "user" }, { keepInbox: true });
      } catch {
        /* 尽力中断 */
      }
    }
  }
  review.status = STATUS.ENDED;
  review.endedAt = Date.now();
  review.report = reportOfSession(deps?.sessions?.get?.(review.sessionId)) || review.report || "";
  await saveReview(review);
  return review;
}
