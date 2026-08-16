//! @dsh-pro/core · git：execFile 封装 + 工作区状态/差异查询。
//! 评审门禁的数据基础：基线 = HEAD，差异 = 工作区 vs HEAD。

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

/** 执行 git（超时 60s）；沙箱/环境不允许时返回错误对象而非抛出。 */
export function runGit(args, cwd, timeoutMs = 60000) {
  return new Promise((resolve) => {
    try {
      execFile("git", args, { cwd, timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          resolve({
            ok: false,
            error: String(stderr || err.message || "").trim() || "git error",
            code: typeof err.code === "number" ? err.code : undefined,
          });
        } else {
          resolve({ ok: true, out: String(stdout || "").trim() });
        }
      });
    } catch (e) {
      resolve({ ok: false, error: String(e?.message ?? e) });
    }
  });
}

/** 目录是否是 git 仓库（有 .git 或位于仓库内）。 */
export async function isGitRepo(dir) {
  const r = await runGit(["rev-parse", "--is-inside-work-tree"], dir, 15000);
  return r.ok && r.out === "true";
}

/** 当前 HEAD 短哈希（非仓库返回 null）。 */
export async function headOf(dir) {
  const r = await runGit(["rev-parse", "--short", "HEAD"], dir, 15000);
  return r.ok ? r.out : null;
}

/** 工作区 vs HEAD 的变更文件清单：[{path, status}]，status ∈ M/A/D/R。 */
export async function changedFiles(dir) {
  const r = await runGit(["diff", "--name-status", "HEAD", "--"], dir, 30000);
  if (!r.ok) return { ok: false, error: r.error };
  const files = [];
  for (const line of r.out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    // 格式: <XY>	<path>   (R 还有 \t<old>\t<new>)
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const statusRaw = line.slice(0, tab).trim();
    const p = line.slice(tab + 1).replace(/\r$/, "");
    const status = statusRaw[0];
    const pathPart = status === "R" ? p.split("\t").pop() : p;
    if (pathPart && pathPart !== "\"") {
      files.push({ path: pathPart, status });
    }
  }
  return { ok: true, files };
}

/** 单个文件的工作区 vs HEAD 统一差异（截断输出，避免超大）。 */
export async function fileDiff(dir, file, maxBytes = 60000) {
  const r = await runGit(["diff", "HEAD", "--", file], dir, 30000);
  if (!r.ok) return { ok: false, error: r.error };
  let text = r.out;
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    text = text.slice(0, maxBytes) + "\n... (diff 过长已截断)";
  }
  return { ok: true, text };
}

/** 暂存（接受）文件。 */
export async function stageFile(dir, file) {
  return runGit(["add", "--", file], dir, 30000);
}

/** 丢弃（拒绝）文件：恢复到 HEAD。 */
export async function discardFile(dir, file) {
  const r = await runGit(["checkout", "--", file], dir, 30000);
  if (!r.ok) {
    // 可能是新增文件（不在 HEAD 中）：直接删除
    const del = await runGit(["rm", "-f", "--", file], dir, 30000);
    if (!del.ok) {
      try {
        await fs.rm(path.join(dir, file), { force: true });
        return { ok: true, note: "removed-untracked" };
      } catch {
        return { ok: false, error: del.error || r.error };
      }
    }
    return { ok: true, note: "removed" };
  }
  return { ok: true };
}

/** 提交已暂存改动。 */
export async function commit(dir, message) {
  const r = await runGit(["commit", "-m", message], dir, 60000);
  if (!r.ok) {
    if (/nothing to commit|no changes added|no changes yet/i.test(r.error)) {
      return { ok: false, error: "没有已接受的改动可提交" };
    }
    return { ok: false, error: r.error };
  }
  return { ok: true, out: r.out };
}

/** 目录是否为空 git 仓库（无任何提交）。 */
export async function isEmptyRepo(dir) {
  const r = await runGit(["rev-parse", "--verify", "HEAD"], dir, 15000);
  return !r.ok;
}

/** 忽略清单：评审/快照不纳入的目录与文件（构建产物纳入，工具链/缓存排除）。 */
export const EXCLUDES = [
  ".git", ".hg", ".svn", "node_modules", "target", ".venv", "venv", "__pycache__",
  ".idea", ".vscode", ".DS_Store", "Thumbs.db", ".cargo", ".rustup", ".pnpm-store",
  ".cache", ".tmp-remote-ui", "mingw64", "crates-cache",
];

export function shouldExclude(name) {
  return (
    EXCLUDES.includes(name) ||
    name.endsWith(".log") ||
    name.endsWith(".tmp") ||
    name.endsWith(".cache")
  );
}

/** 递归收集目录下所有文件（排除忽略项），返回相对路径列表。 */
export async function listFilesRecursive(root, prefix = "") {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (shouldExclude(entry.name)) continue;
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(abs, rel)));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/** 文件内容哈希（sha1）。 */
export async function hashFile(file) {
  const { createHash } = await import("node:crypto");
  const data = await fs.readFile(file);
  return createHash("sha1").update(data).digest("hex");
}

/**
 * 纯 JS 行级 diff（LCS）：不 spawn 任何进程，沙箱/离线环境都可用。
 * 输入两段文本，输出 unified 风格的 +/- 行。超大输入（O(n*m) 超预算）退化为全文前后对照。
 */
export function linesDiff(aText, bText, aLabel, bLabel, maxBytes = 60000) {
  const a = String(aText ?? "").split("\n");
  const b = String(bText ?? "").split("\n");
  let out;
  if (a.length * b.length > 4_000_000) {
    out = "--- a/" + aLabel + "\n+++ b/" + bLabel + "\n@@ (文件过大，显示全文对照) @@\n"
      + a.map((l) => "-" + l).join("\n") + "\n" + b.map((l) => "+" + l).join("\n");
  } else {
    const n = a.length;
    const m = b.length;
    // LCS 表（Uint32 内存可控）
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const lines = ["--- a/" + aLabel, "+++ b/" + bLabel, "@@ diff @@"];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        lines.push(" " + a[i]);
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        lines.push("-" + a[i]);
        i++;
      } else {
        lines.push("+" + b[j]);
        j++;
      }
    }
    while (i < n) lines.push("-" + a[i++]);
    while (j < m) lines.push("+" + b[j++]);
    out = lines.join("\n");
  }
  if (Buffer.byteLength(out, "utf8") > maxBytes) {
    out = out.slice(0, maxBytes) + "\n... (diff 过长已截断)";
  }
  return out;
}
