//! @dsh-pro/core · review：评审门禁（按会话评审）。
//! 基线：git 仓库 → 会话开始时的提交（baselines.json 记录，无记录退化为当前 HEAD）；
//!       非 git 仓库 → 数据目录下的复制基线。
//! 差异：git → git diff <基线提交> -- <file>（= 该会话期间改了什么）；
//!       非 git → 复制基线 vs 当前文件（纯 JS 行 diff）。
//! 接受 = git add / 记录；拒绝 = git checkout <基线提交> / 恢复基线；提交 = git commit（仅已接受）。
//! 规则：同一工作区同时只允许一个进行中的评审。
//! deps.git 可注入（无头测试用 fake），默认真实 git.js。

import { promises as fs } from "node:fs";
import path from "node:path";
import { jsonDoc, dataDir, newId } from "./store.js";
import * as realGit from "./git.js";

function gitOps(deps) {
  return deps?.git ?? realGit;
}

export function reviewsDoc() {
  return jsonDoc(dataDir(), "reviews.json", { reviews: [] });
}

/** 会话基线：sessionId → { workspacePath, commit, capturedAt }（git 仓库）。 */
export function baselinesDoc() {
  return jsonDoc(dataDir(), "baselines.json", { bySession: {} });
}

/** 捕获某会话的 git 基线（会话开始时的 HEAD 提交）。非 git 仓库返回 null。 */
export async function captureSessionBaseline(deps, sessionId, workspacePath) {
  try {
    const G = gitOps(deps);
    const resolved = path.resolve(workspacePath);
    if (!(await fs.stat(resolved).catch(() => null))?.isDirectory()) return null;
    if (!(await G.isGitRepo(resolved))) return null;
    if (await G.isEmptyRepo(resolved)) return null;
    const commit = await G.headOf(resolved);
    if (!commit) return null;
    const doc = baselinesDoc();
    const data = await doc.load();
    data.bySession[sessionId] = { workspacePath: resolved, commit, capturedAt: Date.now() };
    await doc.save(data);
    return data.bySession[sessionId];
  } catch {
    return null;
  }
}

/** 读某会话已捕获的基线（无则 null）。 */
export async function sessionBaselineOf(deps, sessionId) {
  if (!sessionId) return null;
  const data = await baselinesDoc().load();
  return data.bySession[sessionId] ?? null;
}

function baselineDir(id) {
  return path.join(dataDir(), "reviews", id, "baseline");
}

/** 工作区是否已存在进行中的评审。 */
export function hasOpenReview(data, workspacePath) {
  const p = path.resolve(workspacePath).toLowerCase();
  return data.reviews.some((r) => r.status === "open" && path.resolve(r.workspacePath).toLowerCase() === p);
}

/** 开始评审：捕获基线。 */
export async function startReview(deps, { workspacePath, sessionId }) {
  const G = gitOps(deps);
  const resolved = path.resolve(workspacePath);
  if (!(await fs.stat(resolved).catch(() => null))?.isDirectory()) {
    throw new Error("工作区目录不存在: " + workspacePath);
  }
  const data = await reviewsDoc().load();
  if (hasOpenReview(data, resolved)) {
    throw new Error("该工作区已有进行中的评审，请先提交或放弃");
  }
  const review = {
    id: newId("rev"),
    workspacePath: resolved,
    sessionId: sessionId ?? null,
    createdAt: Date.now(),
    status: "open",
    baseline: null,
    files: {},
    message: null,
    committedAt: null,
  };
  const git = await G.isGitRepo(resolved);
  if (git) {
    const empty = await G.isEmptyRepo(resolved);
    if (empty) {
      review.baseline = await captureCopyBaseline(deps, review.id, resolved);
    } else {
      // 按会话评审：优先用会话开始时的提交（该会话期间改了什么）；
      // 无会话基线记录时退化为当前 HEAD。
      const sessionBase = sessionId ? await sessionBaselineOf(deps, sessionId) : null;
      const commit = sessionBase?.commit && sessionBase.workspacePath
        ? path.resolve(sessionBase.workspacePath).toLowerCase() === resolved.toLowerCase()
          ? sessionBase.commit
          : null
        : null;
      const base = commit ?? (await G.headOf(resolved));
      review.baseline = { type: "git", commit: base, sessionBaseline: !!commit };
    }
  } else {
    review.baseline = await captureCopyBaseline(deps, review.id, resolved);
  }
  await refreshFiles(deps, review, resolved);
  data.reviews.push(review);
  await reviewsDoc().save(data);
  return review;
}

async function captureCopyBaseline(deps, id, resolved) {
  const G = gitOps(deps);
  const dest = baselineDir(id);
  await fs.mkdir(dest, { recursive: true });
  const files = await G.listFilesRecursive(resolved);
  let copied = 0;
  for (const rel of files) {
    const from = path.join(resolved, rel);
    const to = path.join(dest, rel);
    try {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
      copied++;
    } catch {
      /* 单个文件失败忽略 */
    }
  }
  return { type: "copy", fileCount: copied };
}

/** 刷新评审的文件状态（差异列表）。 */
export async function refreshFiles(deps, review, resolvedPath) {
  const G = gitOps(deps);
  const dir = resolvedPath ?? path.resolve(review.workspacePath);
  if (review.baseline?.type === "git") {
    const r = await G.changedFiles(dir, review.baseline.commit);
    const next = {};
    for (const f of r.ok ? r.files : []) {
      const prev = review.files[f.path];
      next[f.path] = { status: f.status, decision: prev?.decision ?? "pending" };
    }
    review.files = next;
    return review;
  }
  // 复制基线
  const base = baselineDir(review.id);
  const baseFiles = await G.listFilesRecursive(base);
  const currentFiles = await G.listFilesRecursive(dir);
  const next = {};
  for (const rel of baseFiles) {
    const curPath = path.join(dir, rel);
    const curExists = await fs.stat(curPath).catch(() => null);
    const baseHash = await G.hashFile(path.join(base, rel)).catch(() => null);
    if (!curExists) {
      next[rel] = { status: "D", decision: review.files[rel]?.decision ?? "pending" };
    } else {
      const curHash = await G.hashFile(curPath).catch(() => null);
      if (curHash !== baseHash) {
        next[rel] = { status: "M", decision: review.files[rel]?.decision ?? "pending" };
      }
    }
  }
  for (const rel of currentFiles) {
    if (!baseFiles.includes(rel)) {
      next[rel] = { status: "A", decision: review.files[rel]?.decision ?? "pending" };
    }
  }
  review.files = next;
  return review;
}

/** 评审列表（按创建时间倒序）。 */
export async function listReviews(deps) {
  const data = await reviewsDoc().load();
  return [...data.reviews].sort((a, b) => b.createdAt - a.createdAt);
}

/** 取单个评审。 */
export async function getReview(deps, id) {
  const data = await reviewsDoc().load();
  const review = data.reviews.find((r) => r.id === id);
  if (!review) throw new Error("评审不存在: " + id);
  await refreshFiles(deps, review);
  await reviewsDoc().save(data);
  return review;
}

/** 单文件差异文本。 */
export async function reviewFileDiff(deps, review, file) {
  const G = gitOps(deps);
  await refreshFiles(deps, review);
  if (!review.files[file]) throw new Error("文件不在评审差异中: " + file);
  if (review.baseline?.type === "git") {
    const r = await G.fileDiff(path.resolve(review.workspacePath), file, review.baseline.commit);
    return r.ok ? r.text : "无法生成差异: " + r.error;
  }
  const base = path.join(baselineDir(review.id), file);
  const cur = path.join(path.resolve(review.workspacePath), file);
  const baseExists = await fs.stat(base).catch(() => null);
  const curExists = await fs.stat(cur).catch(() => null);
  if (!baseExists && !curExists) return "(文件不存在)";
  if (!baseExists) return "(新增文件，无基线版本)\n\n[当前内容]\n" + (await fs.readFile(cur, "utf8").catch(() => ""));
  if (!curExists) return "(已删除文件)\n\n[基线内容]\n" + (await fs.readFile(base, "utf8").catch(() => ""));
  const [aText, bText] = await Promise.all([
    fs.readFile(base, "utf8").catch(() => ""),
    fs.readFile(cur, "utf8").catch(() => ""),
  ]);
  return G.linesDiff(aText, bText, "baseline/" + file, file);
}

/** 接受单个文件（git → 暂存；复制基线 → 记录）。 */
export async function acceptFile(deps, review, file) {
  const G = gitOps(deps);
  const dir = path.resolve(review.workspacePath);
  if (review.status !== "open") throw new Error("评审已关闭");
  if (!review.files[file]) throw new Error("文件不在评审差异中: " + file);
  if (review.baseline?.type === "git") {
    const r = await G.stageFile(dir, file);
    if (!r.ok) throw new Error("git add 失败: " + r.error);
  }
  review.files[file].decision = "accepted";
  await saveReview(review);
  return review;
}

/** 拒绝单个文件（git → checkout；复制基线 → 恢复）。 */
export async function rejectFile(deps, review, file) {
  const G = gitOps(deps);
  const dir = path.resolve(review.workspacePath);
  if (review.status !== "open") throw new Error("评审已关闭");
  if (!review.files[file]) throw new Error("文件不在评审差异中: " + file);
  if (review.baseline?.type === "git") {
    const r = await G.discardFile(dir, file, review.baseline.commit);
    if (!r.ok) throw new Error("git 恢复失败: " + r.error);
  } else {
    const base = path.join(baselineDir(review.id), file);
    const cur = path.join(dir, file);
    if (await fs.stat(base).catch(() => null)) {
      await fs.mkdir(path.dirname(cur), { recursive: true });
      await fs.copyFile(base, cur);
    } else {
      await fs.rm(cur, { force: true });
    }
  }
  review.files[file].decision = "rejected";
  await saveReview(review);
  return review;
}

/** 提交已接受改动（git → commit；复制基线 → 标记完成）。 */
export async function commitReview(deps, review, message) {
  const G = gitOps(deps);
  const dir = path.resolve(review.workspacePath);
  if (review.status !== "open") throw new Error("评审已关闭");
  const msg = String(message ?? "").trim() || "评审通过: " + review.id;
  if (review.baseline?.type === "git") {
    const accepted = Object.entries(review.files).filter(([, f]) => f.decision === "accepted").map(([p]) => p);
    if (accepted.length === 0) throw new Error("没有已接受的文件可提交");
    const r = await G.commit(dir, msg);
    if (!r.ok) throw new Error("git commit 失败: " + r.error);
  }
  review.status = "committed";
  review.message = msg;
  review.committedAt = Date.now();
  await saveReview(review);
  return review;
}

/** 放弃评审：未接受的文件全部恢复。 */
export async function discardReview(deps, review) {
  const G = gitOps(deps);
  const dir = path.resolve(review.workspacePath);
  if (review.status !== "open") throw new Error("评审已关闭");
  const pending = Object.entries(review.files).filter(([, f]) => f.decision !== "accepted");
  for (const [file] of pending) {
    try {
      if (review.baseline?.type === "git") {
        await G.discardFile(dir, file, review.baseline.commit);
      } else {
        const base = path.join(baselineDir(review.id), file);
        const cur = path.join(dir, file);
        if (await fs.stat(base).catch(() => null)) {
          await fs.mkdir(path.dirname(cur), { recursive: true });
          await fs.copyFile(base, cur);
        } else {
          await fs.rm(cur, { force: true });
        }
      }
    } catch {
      /* 尽力恢复 */
    }
  }
  review.status = "discarded";
  await saveReview(review);
  return review;
}

async function saveReview(review) {
  const data = await reviewsDoc().load();
  const pos = data.reviews.findIndex((r) => r.id === review.id);
  if (pos >= 0) data.reviews[pos] = review;
  else data.reviews.push(review);
  await reviewsDoc().save(data);
}
