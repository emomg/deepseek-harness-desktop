//! @dsh-pro/core · dashboard：项目仪表盘聚合。
//! 数据来源：workspaceRegistry（工作区→会话）、ctx.sessions（live 会话）、
//! sessionProjections（goal/todos/sessionStats 投影）、summaries.json（Pro 摘要）、
//! 磁盘会话日志（已关闭会话的基础信息）。

import { encodeWorkspaceDir } from "./store.js";
import { readClosedLog, parseSessionLog, summaryOf } from "./summarize.js";

/** 一个 live 会话的投影快照（容错：投影缺失时返回空）。 */
function projectionsOf(sessionProjections, session) {
  try {
    const snap = sessionProjections?.snapshot?.(session);
    return snap?.values ?? {};
  } catch {
    return {};
  }
}

function sessionBase(session) {
  const header = session?.header ?? {};
  return {
    id: session.id,
    title: session.title ?? null,
    createdAt: header.createdAt ?? null,
    cwd: header.cwd ?? null,
    seq: session.seq ?? 0,
    live: true,
  };
}

/** 单个 live 会话的仪表盘行。 */
export function liveSessionRow(deps, session, summary) {
  const values = projectionsOf(deps.sessionProjections, session);
  const stats = values.sessionStats ?? {};
  const goal = values.goal ?? null;
  const todos = Array.isArray(values.todos) ? values.todos : [];
  return {
    ...sessionBase(session),
    stats: {
      steps: stats.steps ?? 0,
      turns: stats.turns ?? 0,
      llmMs: stats.llmMs ?? 0,
      toolMs: stats.toolMs ?? 0,
      decodeTokens: stats.decodeTokens ?? 0,
    },
    goal: goal
      ? {
          objective: goal.objective ?? null,
          phase: goal.phase ?? null,
          roundsStarted: goal.roundsStarted ?? 0,
          maxGoalRounds: goal.maxGoalRounds ?? null,
          blockedReason: goal.blockedReason ?? null,
          activation: goal.activation ?? null,
        }
      : null,
    todos: todos.map((t) => ({
      content: t?.content ?? "",
      status: t?.status ?? "pending",
    })),
    summary: summary ?? null,
  };
}

/** 已关闭会话的行（来自摘要存储 + 磁盘日志基础解析；带 60s 缓存）。 */
const closedCache = new Map(); // sessionId -> { at, row }

export async function closedSessionRow(deps, sessionId, summary) {
  const now = Date.now();
  const hit = closedCache.get(sessionId);
  if (hit && now - hit.at < 60000) {
    return { ...hit.row, summary: summary ?? hit.row.summary };
  }
  const content = await readClosedLog(deps, sessionId);
  let row = {
    id: sessionId,
    title: summary?.sessionTitle ?? null,
    createdAt: null,
    live: false,
    stats: { steps: 0, turns: 0, llmMs: 0, toolMs: 0, decodeTokens: 0 },
    goal: null,
    todos: [],
    summary: summary ?? null,
    parsed: null,
  };
  if (content) {
    const info = await parseSessionLog(content);
    row = {
      ...row,
      title: summary?.sessionTitle ?? info.title ?? null,
      stats: { steps: 0, turns: info.turns, llmMs: 0, toolMs: 0, decodeTokens: 0 },
      parsed: { turns: info.turns, messages: info.messages, firstUser: info.firstUser },
    };
  }
  closedCache.set(sessionId, { at: now, row });
  return row;
}

/** 聚合全部工作区 → 会话仪表盘。 */
export async function buildDashboard(deps) {
  const registry = deps.workspaceRegistry;
  const out = [];
  for (const ws of registry.list()) {
    const sessions = [];
    const sessionIds = Array.isArray(ws.sessionIds) ? ws.sessionIds : [];
    for (const sessionId of sessionIds.slice(0, 60)) {
      try {
        const session = deps.sessions?.get?.(sessionId);
        const summary = await summaryOf(deps.summariesDoc, sessionId);
        if (session) {
          sessions.push(liveSessionRow(deps, session, summary));
        } else {
          sessions.push(await closedSessionRow(deps, sessionId, summary));
        }
      } catch {
        /* 单个会话失败不拖垮整个仪表盘 */
      }
    }
    sessions.sort((a, b) => {
      const ta = a.updatedAt ?? a.createdAt ?? 0;
      const tb = b.updatedAt ?? b.createdAt ?? 0;
      return tb - ta;
    });
    const totals = sessions.reduce(
      (acc, s) => {
        acc.turns += s.stats?.turns ?? 0;
        acc.steps += s.stats?.steps ?? 0;
        acc.llmMs += s.stats?.llmMs ?? 0;
        acc.blocked += s.goal?.phase === "blocked" ? 1 : 0;
        acc.active += s.goal?.phase === "active" ? 1 : 0;
        acc.summarized += s.summary ? 1 : 0;
        return acc;
      },
      { turns: 0, steps: 0, llmMs: 0, blocked: 0, active: 0, summarized: 0 }
    );
    out.push({
      workspaceId: ws.id,
      path: ws.path,
      title: ws.title ?? ws.path,
      encodedDir: encodeWorkspaceDir(ws.path),
      sessionIds,
      sessions,
      totals,
      updatedAt: ws.updatedAt ?? null,
    });
  }
  // 空工作区不展示；有会话的工作区按最近活动排序
  return out.filter((w) => w.sessions.length > 0);
}
