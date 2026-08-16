//! @dsh-pro/desktop · 版本管理核心（Node 移植，语义与 Rust 版 SNAPCHECK 一致）
//!
//! 项目档案 = 文件区（工作区目录）+ 对话区（该工作区会话对话）。
//! 版本快照 = 文件快照（跳过忽略清单）+ 对话快照（~/.dsh/sessions/<编码>/ 打包），
//! 存于数据目录 versions/<archiveKey>/vX.Y.Z-<seq>/ 并写 manifest.json。

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export const DEFAULT_EXCLUDES = [
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  // 工具链 / 编译缓存 / 环境目录（构建输出目录 dist/build/out 是开发产出，**纳入**快照与文件区）
  "target",
  ".venv",
  "venv",
  "__pycache__",
  ".idea",
  ".vscode",
  ".DS_Store",
  "Thumbs.db",
  ".pre-restore",
  ".cargo",
  ".rustup",
  ".pnpm-store",
  ".cache",
  ".tmp-remote-ui",
  "mingw64",
  "crates-cache",
  "winlibs.zip",
];

function shouldExclude(name) {
  return (
    DEFAULT_EXCLUDES.includes(name) ||
    name.endsWith(".log") ||
    name.endsWith(".tmp") ||
    name.endsWith(".cache")
  );
}

/** 供宿主文件区浏览复用：目录/文件名是否应隐藏。 */
export function isExcludedName(name) {
  return shouldExclude(name);
}

export function dataDir() {
  const override = process.env.DSH_PRO_DATA_DIR;
  if (override && override.trim()) return path.resolve(override);
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(local, "DeepSeek Harness Pro", "data");
}

/** 档案键 = 工作区规范路径的 sha1 前 12 位（安全目录名）。 */
export function archiveKey(workspacePath) {
  return crypto.createHash("sha1").update(path.resolve(workspacePath)).digest("hex").slice(0, 12);
}

export function normalizeSemver(input) {
  if (!input) return null;
  const s = input.trim().replace(/^v/, "");
  const parts = s.split(".");
  if (parts.length !== 3) return null;
  const [a, b, c] = parts.map((x) => Number(x));
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c)) return null;
  return `${a}.${b}.${c}`;
}

export function bumpPatch(semver) {
  const parts = (semver || "0.1.0").replace(/^v/, "").split(".").map(Number);
  while (parts.length < 3) parts.push(0);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}

/** 会话目录编码：D:\dsh -> --D-dsh--（与 dsh 会话存储一致）。 */
export function encodeWorkspaceDir(workspacePath) {
  const segs = workspacePath.split(/[\\/:]+/).filter(Boolean);
  return "--" + segs.join("-") + "--";
}

async function copyTree(src, dst, excludeSet) {
  await fs.mkdir(dst, { recursive: true });
  let files = 0;
  let bytes = 0;
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    if (shouldExclude(entry.name)) continue;
    const from = path.join(src, entry.name);
    if (excludeSet && excludeSet.has(path.resolve(from))) continue;
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      const r = await copyTree(from, to, excludeSet);
      files += r.files;
      bytes += r.bytes;
    } else if (entry.isFile()) {
      const st = await fs.stat(from);
      await fs.copyFile(from, to);
      files += 1;
      bytes += st.size;
    }
  }
  return { files, bytes };
}

/** 递归复制（供宿主打包等场景复用）。 */
export { copyTree };

async function clearDir(dir) {
  if (!(await fs.stat(dir).catch(() => null))) return;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await fs.rm(p, { recursive: true, force: true });
    else await fs.rm(p, { force: true });
  }
}

async function readJson(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(p, value) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(value, null, 2), "utf8");
}

/** 数据目录下某档案的版本索引。 */
export async function loadIndex(dir, key) {
  return (await readJson(path.join(dir, "versions", key, "index.json"))) ?? { key, nextSeq: 1, versions: [] };
}

async function saveIndex(dir, index) {
  await writeJson(path.join(dir, "versions", index.key, "index.json"), index);
}

export async function listVersions(dir, key) {
  const idx = await loadIndex(dir, key);
  return [...idx.versions].sort((a, b) => b.createdAt - a.createdAt);
}

export async function nextSemver(dir, key) {
  const list = await listVersions(dir, key);
  return list.length ? bumpPatch(list[0].semver) : "0.1.0";
}

/**
 * 打版本快照。
 * @param {object} opts
 * @param {string} opts.workspacePath  工作区目录（文件区）
 * @param {string[]} [opts.sessionIds] 该工作区会话（对话区）
 * @param {string} [opts.sessionId]    本次快照所属功能框（会话）；缺省 = 工作区级
 * @param {string} [opts.sessionTitle] 功能框标题
 * @param {boolean} [opts.auto]        是否自动快照（任务完成触发）
 * @param {string[]} [opts.excludeFiles] 排除的 AI 交付物文件（绝对路径）
 * @param {string} [opts.semver]       缺省自动 +patch
 * @param {string} [opts.message]      说明
 * @param {string} [opts.dshHome]      ~/.dsh（默认 DSH_HOME 或 ~/.dsh）
 */
export async function snapshot({ workspacePath, sessionIds = [], sessionId, sessionTitle, auto = false, excludeFiles = [], semver, message = "", dshHome }) {
  const dir = dataDir();
  const key = archiveKey(workspacePath);
  const resolved = path.resolve(workspacePath);
  if (!(await fs.stat(resolved).catch(() => null))?.isDirectory()) {
    throw new Error(`工作区目录不存在: ${workspacePath}`);
  }
  const index = await loadIndex(dir, key);
  const ver = normalizeSemver(semver) || (await nextSemver(dir, key));
  const seq = index.nextSeq++;
  const versionDir = path.join(dir, "versions", key, `v${ver}-${seq}`);
  await fs.mkdir(versionDir, { recursive: true });

  // 排除集：AI 交付物（在工作区内且存在的路径/目录）
  const excludeSet = new Set(
    excludeFiles
      .map((f) => path.resolve(f))
      .filter((f) => f === resolved || f.startsWith(resolved + path.sep))
  );

  // 文件区
  const files = await copyTree(resolved, versionDir, excludeSet);
  // 对话区：功能框（会话）专属对话，缺省则整个工作区会话
  const sessionsRoot = path.join(dshHome ?? process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"), "sessions");
  const encodedDir = encodeWorkspaceDir(resolved);
  let dialogFiles = 0;
  let dialogBytes = 0;
  if (sessionId) {
    const one = path.join(sessionsRoot, encodedDir, sessionId);
    if (await fs.stat(one).catch(() => null)) {
      const d = await copyTree(one, path.join(versionDir, "dialogs", sessionId));
      dialogFiles = d.files;
      dialogBytes = d.bytes;
    }
  } else {
    const dialogsSrc = path.join(sessionsRoot, encodedDir);
    if (await fs.stat(dialogsSrc).catch(() => null)) {
      const d = await copyTree(dialogsSrc, path.join(versionDir, "dialogs"));
      dialogFiles = d.files;
      dialogBytes = d.bytes;
    }
  }

  const meta = {
    id: `${ver}-${seq}`,
    semver: ver,
    seq,
    message: message.trim(),
    createdAt: Date.now(),
    fileCount: files.files,
    sizeBytes: files.bytes,
    dialogCount: dialogFiles,
    dialogBytes,
    dir: `v${ver}-${seq}`,
    sessionId: sessionId ?? null,
    sessionTitle: sessionTitle ?? null,
    auto,
  };
  index.versions.push(meta);
  await saveIndex(dir, index);
  await writeJson(path.join(versionDir, "manifest.json"), {
    archiveKey: key,
    workspacePath: resolved,
    semver: ver,
    seq,
    message: meta.message,
    createdAt: meta.createdAt,
    fileCount: files.files,
    sizeBytes: files.bytes,
    dialogCount: dialogFiles,
    dialogBytes,
    sessionId,
    sessionTitle,
    auto,
    excludedFiles: [...excludeSet],
    sessionIds,
    excludes: DEFAULT_EXCLUDES,
  });
  return meta;
}

/** 回滚到指定版本（文件区覆盖 + 对话区还原），回滚前自动备份当前状态。 */
export async function restore({ workspacePath, versionId, dshHome }) {
  const dir = dataDir();
  const key = archiveKey(workspacePath);
  const index = await loadIndex(dir, key);
  const meta = index.versions.find((v) => v.id === versionId);
  if (!meta) throw new Error(`版本不存在: ${versionId}`);
  const resolved = path.resolve(workspacePath);
  if (!(await fs.stat(resolved).catch(() => null))?.isDirectory()) {
    throw new Error(`工作区目录不存在: ${workspacePath}`);
  }
  const versionDir = path.join(dir, "versions", key, meta.dir);
  if (!(await fs.stat(path.join(versionDir, "manifest.json")).catch(() => null))) {
    throw new Error(`版本快照不完整: ${meta.dir}`);
  }
  // 1) 回滚前自动备份当前文件区（不计入版本列表）
  await copyTree(resolved, path.join(dir, "versions", key, `.pre-restore-${Date.now()}`));
  // 2) 文件区覆盖
  await clearDir(resolved);
  for (const entry of await fs.readdir(versionDir, { withFileTypes: true })) {
    if (entry.name === "manifest.json" || entry.name === "dialogs") continue;
    const from = path.join(versionDir, entry.name);
    const to = path.join(resolved, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else await fs.copyFile(from, to);
  }
  // 3) 对话区还原
  const sessionsRoot = path.join(dshHome ?? process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"), "sessions");
  const encodedDir = encodeWorkspaceDir(resolved);
  const dialogsSrc = path.join(versionDir, "dialogs");
  if (await fs.stat(dialogsSrc).catch(() => null)) {
    const dialogsDst = path.join(sessionsRoot, encodedDir);
    if (await fs.stat(dialogsDst).catch(() => null)) await clearDir(dialogsDst);
    await copyTree(dialogsSrc, dialogsDst);
  }
  return meta;
}

/** 删除版本（快照目录 + 索引）。 */
export async function deleteVersion({ workspacePath, versionId }) {
  const dir = dataDir();
  const key = archiveKey(workspacePath);
  const index = await loadIndex(dir, key);
  const pos = index.versions.findIndex((v) => v.id === versionId);
  if (pos < 0) throw new Error(`版本不存在: ${versionId}`);
  const [meta] = index.versions.splice(pos, 1);
  await saveIndex(dir, index);
  await fs.rm(path.join(dir, "versions", key, meta.dir), { recursive: true, force: true });
  return meta;
}

/** 标记/取消「最终版」（finalize）。返回更新后的版本。 */
export async function setFinal({ workspacePath, versionId, final }) {
  const dir = dataDir();
  const key = archiveKey(workspacePath);
  const index = await loadIndex(dir, key);
  const ver = index.versions.find((v) => v.id === versionId);
  if (!ver) throw new Error(`版本不存在: ${versionId}`);
  ver.final = final === true;
  await saveIndex(dir, index);
  return ver;
}

/** 各功能框的最终版（未标记 final 时回退为各框最新版，并标注 suggested）。 */
export async function finalVersions(dir, key, boxes) {
  const all = await listVersions(dir, key);
  const bySession = new Map();
  for (const ver of all) {
    const sid = ver.sessionId ?? "";
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid).push(ver);
  }
  const out = [];
  for (const box of boxes) {
    const sid = box.sessionId ?? "";
    const list = bySession.get(sid) ?? [];
    const final = list.find((v) => v.final === true);
    out.push({
      sessionId: box.sessionId,
      sessionTitle: box.sessionTitle,
      version: final ?? list[0] ?? null,
      finalized: final !== undefined,
    });
  }
  return out;
}
