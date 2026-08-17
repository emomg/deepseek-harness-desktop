//! @dsh-pro/core · summarize：会话自动摘要。
//! 触发：turn 停止且会话有新活动 → 异步调用 ctx.llm.stream 生成 3 行摘要，写入 summaries.json。
//! 路由：取会话最近 request/header 的 provider/model；无路由则跳过（不报错）。
//! 摘要不写入会话日志（DSH 持久化拒绝未知事件），只存 Pro 数据目录。

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { jsonDoc, dataDir } from "./store.js";

/**
 * 极简 StreamChunk 组装器（零依赖）。
 * 适配 dsh-llm 的 adapter 契约：{type:'text-delta',text} 累积正文，
 * {type:'finish',reason} 记录终态；reason ∈ stop|error|aborted|max-tokens|tool-calls。
 */
export class MinimalAssembler {
  constructor() {
    this.parts = [];
    this._finish = null;
  }
  push(chunk) {
    if (!chunk || typeof chunk !== "object") return;
    if (chunk.type === "text-delta" && typeof chunk.text === "string") {
      this.parts.push(chunk.text);
    } else if (chunk.type === "finish") {
      this._finish = chunk;
    }
  }
  get finish() {
    return this._finish;
  }
  blocks() {
    return [{ type: "text", text: this.parts.join("") }];
  }
}

export const SUMMARY_PROMPT = [
  "你是开发者的 AI 会话摘要助手。",
  "根据提供的会话对话，写一份 3 行的中文摘要：",
  "第 1 行：用户要求做什么（目标）；",
  "第 2 行：实际完成了什么（含关键产出文件/决定）；",
  "第 3 行：未完成事项或下一步建议。",
  "只输出这 3 行，每行以「- 」开头，不要任何额外说明、Markdown 代码块或引用。",
].join("\n");

export const MAX_INPUT_BYTES = 24000;
export const MAX_OUTPUT_TOKENS = 240;
export const TIMEOUT_MS = 45000;
/** 每次摘要取最近的多少条消息。 */
export const MESSAGES_LIMIT = 24;
/** 单条消息截断字符数。 */
export const MESSAGE_TRIM = 1400;

export function summariesDoc() {
  return jsonDoc(dataDir(), "summaries.json", { bySession: {} });
}

/**
 * 从会话解析模型路由（provider/model）。
 * 优先级：1) live Session 的官方缓存折叠 requestContext()/requestHeader()；
 *         2) 回退扫描事件日志（真实形状）：
 *            - request/context:  data = { provider, model, contextWindow }
 *            - request/header:   data = { header: { config: { provider, model, ... } }, reason }
 */
export function routeOfSession(session) {
  // 1) 官方折叠（live 会话，避免手扫事件）
  try {
    const rc = session.requestContext?.();
    if (rc?.provider && rc?.model) return { provider: rc.provider, model: rc.model };
    const hdr = session.requestHeader?.();
    const cfg = hdr?.config;
    if (cfg?.provider && cfg?.model) return { provider: cfg.provider, model: cfg.model };
  } catch {
    /* 回退扫描 */
  }
  // 2) 事件日志回退（真实形状，从后往前取最新）
  const events = session?.events;
  if (Array.isArray(events)) {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      const d = ev?.data;
      if (!d) continue;
      if (ev.type === "request/context") {
        if (d.provider && d.model) return { provider: d.provider, model: d.model };
      } else if (ev.type === "request/header") {
        const c = d.header?.config ?? d.config;
        if (c?.provider && c?.model) return { provider: c.provider, model: c.model };
      }
    }
  }
  return null;
}

/** 从会话派生的消息中提取最近文本（user/assistant），返回 JSON 安全的数组。 */
export function recentMessages(session) {
  let messages = [];
  try {
    messages = session.deriveMessages ? session.deriveMessages() : [];
  } catch {
    messages = [];
  }
  const out = [];
  for (let i = Math.max(0, messages.length - MESSAGES_LIMIT); i < messages.length; i++) {
    const m = messages[i];
    if (!m) continue;
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : "system";
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
    if (!text) continue;
    if (text.length > MESSAGE_TRIM) text = text.slice(0, MESSAGE_TRIM) + "…";
    out.push({ role, text });
  }
  return out;
}

/** 把消息帧成输入文本（JSON 数组），并做字节预算检查。 */
export function frameInput(messages) {
  return "会话对话（JSON 数组，role: user/assistant）:\n" + JSON.stringify(messages);
}

/** 核心：对 live Session 生成摘要。deps = { llm, logger }。 */
export async function summarizeSession(deps, session) {
  const messages = recentMessages(session);
  if (messages.length === 0) {
    return { ok: false, error: "会话没有可摘要的消息" };
  }
  const route = routeOfSession(session);
  if (!route) {
    return { ok: false, error: "会话没有已记录的模型路由（request/header），无法发起摘要调用" };
  }
  const framed = frameInput(messages);
  const inputBytes = Buffer.byteLength(framed, "utf8");
  if (inputBytes > MAX_INPUT_BYTES) {
    return { ok: false, error: "输入超过字节预算 " + inputBytes + "/" + MAX_INPUT_BYTES };
  }
  let llm = deps?.llm;
  if (!llm || typeof llm.stream !== "function") {
    return { ok: false, error: "LLM 服务不可用" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const assembler = new MinimalAssembler();
    // 与线上已验证的标题生成器（generateSessionTitleWithLlm）调用模式一致：
    //   - purpose 必须是合法枚举 'compaction' | 'session-title'（session-title 还会让 DeepSeek 适配器关思考，适合小摘要）
    //   - 消息需带 id（createUserMessage 会补 uuid，手写必须自带）
    const options = Object.freeze({
      provider: route.provider,
      model: route.model,
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user",
          content: [{ type: "text", text: framed }],
          source: { kind: "plugin", plugin: "dsh-pro" },
        },
      ],
      system: SUMMARY_PROMPT,
      maxTokens: MAX_OUTPUT_TOKENS,
      sessionId: session.id,
      purpose: "session-title",
      signal: controller.signal,
    });
    for await (const chunk of llm.stream(options)) {
      if (controller.signal.aborted) break;
      assembler.push(chunk);
    }
    const finish = assembler.finish;
    if (controller.signal.aborted) {
      return { ok: false, error: "摘要生成超时" };
    }
    if (finish) {
      const reason = typeof finish.reason === "string" ? finish.reason : finish.reason?.kind;
      if (reason === "error") {
        return { ok: false, error: "摘要生成失败: " + String(finish.failure?.message ?? finish.reason?.failure?.message ?? finish.reason?.failure?.code ?? "llm error") };
      }
      if (reason === "aborted") {
        return { ok: false, error: "摘要生成被中止" };
      }
      if (reason === "tool-calls") {
        return { ok: false, error: "摘要模型意外请求了工具" };
      }
    }
    const blocks = assembler.blocks();
    const text = blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) {
      return { ok: false, error: "摘要模型没有产出文本" };
    }
    return { ok: true, summary: text, model: route };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

/** turn 停止后的自动摘要入口：有活动 + 节流通过才生成，失败静默。 */
export async function maybeAutoSummarize(deps, session, workspacePath) {
  try {
    const doc = summariesDoc();
    const data = await doc.load();
    const entry = data.bySession[session.id];
    const now = Date.now();
    const turnCount = countTurns(session);
    if (entry && entry.lastSeq != null && entry.lastSeq >= session.seq) return null; // 无新活动
    if (entry && now - (entry.updatedAt ?? 0) < 60000) return null; // 节流：1 分钟内不重复
    const result = await summarizeSession(deps, session);
    if (!result.ok) {
      deps?.logger?.warn?.("[dsh-pro] summary skipped: " + result.error);
      return null;
    }
    data.bySession[session.id] = {
      sessionId: session.id,
      workspacePath,
      summary: result.summary,
      model: result.model,
      turnCount,
      lastSeq: session.seq,
      createdAt: entry?.createdAt ?? now,
      updatedAt: now,
    };
    await doc.save(data);
    return data.bySession[session.id];
  } catch (e) {
    deps?.logger?.warn?.("[dsh-pro] auto summary failed: " + String(e?.message ?? e));
    return null;
  }
}

/** 会话内 turn 数量（turn/end 事件计数）。 */
export function countTurns(session) {
  const events = session?.events;
  if (!Array.isArray(events)) return 0;
  let n = 0;
  for (const ev of events) if (ev?.type === "turn/end") n++;
  return n;
}

/** 读取某会话的摘要（无则 null）。 */
export async function summaryOf(doc, sessionId) {
  const data = await doc.load();
  return data.bySession[sessionId] ?? null;
}

/** 全部摘要列表（按更新时间倒序）。 */
export async function listSummaries(doc) {
  const data = await doc.load();
  return Object.values(data.bySession).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/** 从磁盘会话 JSONL 解析基础信息（标题/消息数/turn 数），用于已关闭会话。 */
export async function parseSessionLog(content) {
  const info = { title: null, turns: 0, messages: 0, updatedAt: null, firstUser: null };
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    const t = ev?.type;
    if (t === "session/title" && !info.title && ev?.data?.title) info.title = ev.data.title;
    if (t === "turn/end") info.turns++;
    if (t === "user/message" || t === "assistant/message") info.messages++;
    if (t === "user/message" && !info.firstUser) {
      info.firstUser = extractText(ev?.data?.content ?? ev?.data);
    }
    if (ev?.seq != null) info.updatedAt = Math.max(info.updatedAt ?? 0, ev.seq);
  }
  return info;
}

function extractText(content) {
  if (Array.isArray(content)) {
    return content.filter((b) => b && typeof b.text === "string").map((b) => b.text).join(" ").slice(0, 120);
  }
  if (typeof content === "string") return content.slice(0, 120);
  return "";
}

/** 已关闭会话的 jsonl 读取（sessionPersistence.readRaw 已解压）。 */
export async function readClosedLog(deps, sessionId) {
  try {
    const raw = await deps.sessionPersistence?.readRaw?.(sessionId);
    if (!raw || typeof raw.content !== "string") return null;
    return raw.content;
  } catch {
    return null;
  }
}
