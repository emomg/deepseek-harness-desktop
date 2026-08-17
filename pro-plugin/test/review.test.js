//! review 测试：git 基线（fake git 注入，无进程）与非 git 复制基线（真实 fs）。
import { strict as assert } from "node:assert";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as review from "../lib/review.js";
import { listFilesRecursive, hashFile, linesDiff } from "../lib/git.js";
import { tempDataDir } from "./helpers.js";

async function listFiles(dir) {
  return listFilesRecursive(dir);
}
async function stat(p) {
  return fs.stat(p).catch(() => null);
}
async function read(p) {
  return fs.readFile(p, "utf8").catch(() => "");
}
async function hash(p) {
  return hashFile(p).catch(() => null);
}

/** fake git：baseDir 视为 HEAD 状态，操作作用于真实磁盘（不 spawn）。 */
function fakeGit(baseDir) {
  const staged = new Set();
  let commits = 0;
  return {
    staged,
    commits: () => commits,
    async isGitRepo() { return true; },
    async isEmptyRepo() { return false; },
    async headOf() { return "abc1234"; },
    async changedFiles(dir, _base) {
      const base = await listFiles(baseDir);
      const cur = await listFiles(dir);
      const files = [];
      for (const rel of base) {
        const curP = path.join(dir, rel);
        if (!(await stat(curP))) files.push({ path: rel, status: "D" });
        else if ((await hash(curP)) !== (await hash(path.join(baseDir, rel)))) files.push({ path: rel, status: "M" });
      }
      for (const rel of cur) if (!base.includes(rel)) files.push({ path: rel, status: "A" });
      return { ok: true, files };
    },
    async fileDiff(_dir, file, _base) {
      const a = await read(path.join(baseDir, file));
      const b = await read(path.join(_dir, file));
      return { ok: true, text: linesDiff(a, b, file, file) };
    },
    async stageFile(_dir, file) { staged.add(file); return { ok: true }; },
    async discardFile(dir, file, _base) {
      const base = path.join(baseDir, file);
      const cur = path.join(dir, file);
      if (await stat(base)) {
        await fs.mkdir(path.dirname(cur), { recursive: true });
        await fs.copyFile(base, cur);
      } else {
        await fs.rm(cur, { force: true });
      }
      return { ok: true };
    },
    async commit() { commits++; return { ok: true, out: "committed" }; },
    listFilesRecursive,
    hashFile,
    linesDiff,
  };
}

export async function run() {
  const t = await tempDataDir();
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "dsh-pro-rev-"));
  const base = path.join(repo, "__head__");
  await fs.mkdir(base, { recursive: true });
  // HEAD 状态
  await fs.writeFile(path.join(base, "base.txt"), "line1\nline2\n", "utf8");
  await fs.writeFile(path.join(base, "gone.txt"), "to delete\n", "utf8");
  // 工作区（初始=HEAD）
  await fs.writeFile(path.join(repo, "base.txt"), "line1\nline2\n", "utf8");
  await fs.writeFile(path.join(repo, "gone.txt"), "to delete\n", "utf8");

  try {
    // ---- git 基线路径（fake git） ----
    const G = fakeGit(base);
    const deps = { logger: console, git: G };
    const rev = await review.startReview(deps, { workspacePath: repo });
    assert.equal(rev.baseline.type, "git");
    assert.equal(rev.baseline.commit, "abc1234");
    assert.equal(rev.status, "open");

    // 制造改动
    await fs.writeFile(path.join(repo, "base.txt"), "line1\nline2 CHANGED\n", "utf8");
    await fs.writeFile(path.join(repo, "new.txt"), "hello\n", "utf8");
    await fs.rm(path.join(repo, "gone.txt"));

    const refreshed = await review.refreshFiles(deps, rev);
    const files = Object.keys(refreshed.files);
    assert.ok(files.includes("base.txt"), "base.txt M");
    assert.equal(refreshed.files["base.txt"].status, "M");
    assert.ok(files.includes("new.txt"), "new.txt A");
    assert.equal(refreshed.files["new.txt"].status, "A");
    assert.ok(files.includes("gone.txt"), "gone.txt D");
    assert.equal(refreshed.files["gone.txt"].status, "D");

    // diff 文本
    const diff = await review.reviewFileDiff(deps, rev, "base.txt");
    assert.ok(diff.includes("CHANGED"), "diff 含改动行");

    // 拒绝 new.txt → 磁盘删除
    await review.rejectFile(deps, rev, "new.txt");
    assert.equal(rev.files["new.txt"].decision, "rejected");
    assert.equal(await stat(path.join(repo, "new.txt")), null, "new.txt 已删除");

    // 接受 base.txt → fake staged
    await review.acceptFile(deps, rev, "base.txt");
    assert.equal(rev.files["base.txt"].decision, "accepted");
    assert.ok(G.staged.has("base.txt"), "base.txt 已暂存");

    // 评审进行中：同一工作区并发评审被拒
    await assert.rejects(() => review.startReview(deps, { workspacePath: repo }));

    // 提交
    await review.commitReview(deps, rev, "test commit");
    assert.equal(rev.status, "committed");
    assert.equal(G.commits(), 1, "git commit 被调用");

    // ---- 非 git 路径（真实 fs，无 git 注入） ----
    const plain = await fs.mkdtemp(path.join(os.tmpdir(), "dsh-pro-plain-"));
    await fs.writeFile(path.join(plain, "a.txt"), "v1\n", "utf8");
    const rev2 = await review.startReview({ logger: console }, { workspacePath: plain });
    assert.equal(rev2.baseline.type, "copy");
    await fs.writeFile(path.join(plain, "a.txt"), "v2\n", "utf8");
    await fs.writeFile(path.join(plain, "b.txt"), "b\n", "utf8");
    const ref2 = await review.refreshFiles({ logger: console }, rev2);
    assert.equal(ref2.files["a.txt"].status, "M");
    assert.equal(ref2.files["b.txt"].status, "A");
    // 拒绝 b.txt → 删除
    await review.rejectFile({ logger: console }, rev2, "b.txt");
    assert.equal(await stat(path.join(plain, "b.txt")), null);
    // 拒绝 a.txt → 恢复 v1
    await review.rejectFile({ logger: console }, rev2, "a.txt");
    assert.equal(await read(path.join(plain, "a.txt")), "v1\n");
    // 提交（复制基线标记完成）
    await review.commitReview({ logger: console }, rev2, "plain done");
    assert.equal(rev2.status, "committed");

    // ---- 会话基线：capture + 按会话评审使用会话开始时的提交 ----
    const G2 = fakeGit(base);
    const deps2 = { logger: console, git: G2 };
    const captured = await review.captureSessionBaseline(deps2, "sess-1", repo);
    assert.ok(captured && captured.commit === "abc1234", "会话基线已捕获");
    assert.equal((await review.sessionBaselineOf(deps2, "sess-1")).commit, "abc1234");
    assert.equal(await review.sessionBaselineOf(deps2, "nope"), null);
    // 按会话开始评审 → 用会话基线提交
    const rev3 = await review.startReview(deps2, { workspacePath: repo, sessionId: "sess-1" });
    assert.equal(rev3.baseline.type, "git");
    assert.equal(rev3.baseline.commit, "abc1234");
    assert.equal(rev3.baseline.sessionBaseline, true, "标记为会话基线");
    await review.discardReview(deps2, rev3); // 关闭 rev3 释放工作区（无改动时用放弃而非提交）
    // 会话与工作区不匹配时退化为当前 HEAD
    const rev4 = await review.startReview(deps2, { workspacePath: repo, sessionId: "other-ws-sess" });
    assert.equal(rev4.baseline.sessionBaseline, false, "不匹配 → 当前 HEAD");
    // 非 git 工作区捕获返回 null
    assert.equal(await review.captureSessionBaseline({ logger: console }, "sess-p", plain), null);

    return "review OK";
  } finally {
    await t.restore();
    await fs.rm(repo, { recursive: true, force: true });
  }
}
