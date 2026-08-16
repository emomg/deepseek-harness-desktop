//! @dsh-pro/desktop · 宿主插件 v2
//!
//! 产品模型（用户确认）：
//!   - 功能框 = 一个 DSH 会话；每个会话有独立的版本控制
//!   - 自动快照：每轮任务完成（agent/turn-stopping）自动打一次快照
//!   - 总版本控制器：左侧面板，按工作区归类 → 会话（功能框）→ 版本；统一上传/删除/回滚
//!   - AI 生成内容：快照排除（通过 session/event 累积交付物文件路径）；源码用 DSH 原生查看
//!
//! 路由 /api/pro/*（webServer，同源 3080）。

import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import * as v from "./version.js";

export const name = "dsh-pro";

export const inject = ["workspaceRegistry", "webServer", "sessions"];

// ---------------------------------------------------------------- helpers

function writeJson(res, code, body) {
  try {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  } catch {
    /* connection closed */
  }
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function methodOf(req, res, method) {
  if (req.method === method) return true;
  writeJson(res, 405, { error: `method ${req.method} not allowed` });
  return false;
}

/** 安全边界：p 是否在 root 之内（Windows 大小写不敏感，统一小写比较，防路径穿越）。 */
function withinRoot(root, p) {
  const r = path.resolve(root).toLowerCase();
  const t = path.resolve(p).toLowerCase();
  return t === r || t.startsWith(r + path.sep);
}

// ---------------------------------------------------------------- plugin

export function apply(ctx) {
  const registry = ctx.workspaceRegistry;

  /** 会话 → 工作区实体。 */
  function workspaceOfSession(sessionId) {
    if (!sessionId) return null;
    for (const ws of registry.list()) {
      const ids = ws.sessionIds;
      if (Array.isArray(ids) && ids.includes(sessionId)) return ws;
    }
    return null;
  }

  /** 会话标题（尽力而为）。 */
  function sessionTitleOf(sessionId) {
    try {
      const s = ctx.sessions?.get?.(sessionId);
      const t = s?.title ?? s?.name;
      if (typeof t === "string" && t) return t;
    } catch {
      /* ignore */
    }
    return null;
  }

  /** 档案（工作区）→ 功能框（会话）→ 版本。 */
  async function archives() {
    const out = [];
    for (const ws of registry.list()) {
      const key = v.archiveKey(ws.path);
      const all = await v.listVersions(v.dataDir(), key);
      const boxes = [];
      const bySession = new Map();
      for (const ver of all) {
        const sid = ver.sessionId ?? "";
        if (!bySession.has(sid)) bySession.set(sid, []);
        bySession.get(sid).push(ver);
      }
      for (const [sid, versions] of bySession) {
        boxes.push({
          sessionId: sid || null,
          sessionTitle: sid ? (versions[0].sessionTitle ?? sessionTitleOf(sid)) : "工作区级",
          versions,
        });
      }
      // 工作区级放最后
      boxes.sort((a, b) => (a.sessionId === null ? 1 : b.sessionId === null ? -1 : 0));
      out.push({
        workspaceId: ws.id,
        path: ws.path,
        title: ws.title,
        sessionIds: ws.sessionIds ?? [],
        boxes,
        versions: all,
        finals: await v.finalVersions(v.dataDir(), key, boxes),
      });
    }
    return out;
  }

  // ---- 文件区源管理：拉取的 git 仓库 + 本地文件夹（与工作区解耦） ----
  const sourcesFile = path.join(v.dataDir(), "sources.json");
  let sources = [];
  async function loadSources() {
    try {
      const raw = JSON.parse(await fs.readFile(sourcesFile, "utf8"));
      sources = Array.isArray(raw.sources) ? raw.sources : [];
    } catch {
      sources = [];
    }
  }
  async function saveSources() {
    try {
      await fs.mkdir(path.dirname(sourcesFile), { recursive: true });
      await fs.writeFile(sourcesFile, JSON.stringify({ sources }, null, 2), "utf8");
    } catch {
      /* ignore */
    }
  }
  function sourceOf(id) {
    return sources.find((s) => s.id === id) ?? null;
  }

  /** 执行 git 命令（尽力而为；沙箱禁 spawn 时返回错误而非崩溃）。 */
  function runGit(args, cwd) {
    return new Promise((resolve) => {
      let exec;
      try {
        exec = execFile;
      } catch {
        resolve({ ok: false, error: "git unavailable" });
        return;
      }
      try {
        exec("git", args, { cwd, timeout: 60000 }, (err, stdout, stderr) => {
          if (err) resolve({ ok: false, error: String(stderr || err.message).trim() || "git error" });
          else resolve({ ok: true, out: String(stdout).trim() });
        });
      } catch (e) {
        resolve({ ok: false, error: String(e?.message ?? e) });
      }
    });
  }

  async function loadConfig() {
    try {
      const raw = JSON.parse(await fs.readFile(configFile, "utf8"));
      ghConfig = { token: raw?.github?.token ?? "", repo: raw?.github?.repo ?? "" };
    } catch {
      /* fresh */
    }
  }
  async function saveConfig() {
    try {
      await fs.mkdir(path.dirname(configFile), { recursive: true });
      await fs.writeFile(configFile, JSON.stringify({ github: ghConfig }, null, 2), "utf8");
    } catch {
      /* ignore */
    }
  }

  /** 用系统 tar（bsdtar）打包 zip；失败返回错误（不落任何用户数据到日志）。 */
  function makeZip(stageDir, zipPath) {
    return new Promise((resolve) => {
      let exec;
      try {
        exec = execFile;
      } catch {
        resolve({ ok: false, error: "打包不可用（沙箱限制 spawn）" });
        return;
      }
      try {
        exec("tar", ["-a", "-c", "-f", zipPath, "-C", stageDir, "."], { timeout: 120000 }, (err, so, se) => {
          if (err) resolve({ ok: false, error: String(se || err.message).trim() || "tar 失败" });
          else resolve({ ok: true });
        });
      } catch (e) {
        resolve({ ok: false, error: String(e?.message ?? e) });
      }
    });
  }

  /** 推代码时默认排查的敏感信息模式（追加到项目 .git/info/exclude，仅本地生效，不入仓库）。 */
const SENSITIVE_PATTERNS = [
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "*.p8",
  "id_rsa*",
  "id_ed25519*",
  ".credentials.yaml",
  "credentials.json",
  "credentials.txt",
  "*credentials*",
  "*secret*",
  "*secrets*",
  "*.token",
  ".npmrc",
  ".pypirc",
  ".netrc",
  "*.local.json",
  "config.local.*",
  "application-local.*",
  ".p12",
  ".keystore",
];

// ---- GitHub 上传配置（token 仅本地存储，接口永不回传明文；模块级，供 pushCode 使用） ----
const configFile = path.join(v.dataDir(), "config.json");
let ghConfig = { token: "", repo: "" };

/** 执行外部命令（尽力而为；沙箱禁 spawn 时返回错误而非崩溃）。 */
function runExec(cmd, args, opts) {
  return new Promise((resolve) => {
    let exec;
    try {
      exec = execFile;
    } catch {
      resolve({ ok: false, error: "命令执行不可用（沙箱限制 spawn）" });
      return;
    }
    try {
      exec(cmd, args, { timeout: (opts?.timeout ?? 60000), cwd: opts?.cwd, env: opts?.env }, (err, so, se) => {
        if (err) resolve({ ok: false, error: String(se || err.message).trim() || `${cmd} 失败`, out: String(so ?? "") });
        else resolve({ ok: true, out: String(so ?? "").trim() });
      });
    } catch (e) {
      resolve({ ok: false, error: String(e?.message ?? e) });
    }
  });
}

/** 把敏感模式追加到项目 .git/info/exclude（已存在则跳过），保证 git add -A 默认不纳入。 */
async function ensureSensitiveExcludes(repoRoot) {
  const infoDir = path.join(repoRoot, ".git", "info");
  const excludeFile = path.join(infoDir, "exclude");
  let existing = "";
  try {
    existing = await fs.readFile(excludeFile, "utf8");
  } catch {
    /* new file */
  }
  const header = "# dsh-pro: 敏感信息默认排除（本地，不入仓库）";
  let lines = existing.split(/\r?\n/);
  if (!lines.includes(header)) {
    lines = [...lines.filter((l) => l.length), header, ...SENSITIVE_PATTERNS];
    await fs.mkdir(infoDir, { recursive: true });
    await fs.writeFile(excludeFile, lines.join("\n"), "utf8");
  }
}

/** 推代码：敏感排除 → add → commit → push（token 仅用于本次命令 URL，不写入仓库配置）。 */
async function pushCode({ repoRoot, message, token, dryRun }) {
  if (!(await fs.stat(path.join(repoRoot, ".git")).catch(() => null))) {
    return { ok: false, error: "该目录不是 git 仓库，无法推代码（可先 git init）" };
  }
  await ensureSensitiveExcludes(repoRoot);
  const msg = message?.trim() || `专业版更新 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  // 预览：add -A 的 dry-run（受 .gitignore + info/exclude 双重约束）
  const preview = await runExec("git", ["add", "-A", "--dry-run"], { cwd: repoRoot, timeout: 30000 });
  if (!preview.ok) return { ok: false, error: `git 扫描失败：${preview.error}` };
  const files = preview.out.split("\n").filter(Boolean);
  if (dryRun) {
    return { ok: true, dryRun: true, files, message: msg };
  }
  if (files.length === 0) {
    return { ok: false, error: "没有需要提交的改动（敏感信息已自动排除）" };
  }
  const add = await runExec("git", ["add", "-A"], { cwd: repoRoot, timeout: 60000 });
  if (!add.ok) return { ok: false, error: `git add 失败：${add.error}` };
  const commit = await runExec("git", ["commit", "-m", msg], { cwd: repoRoot, timeout: 60000 });
  if (!commit.ok) {
    const e = commit.error;
    if (/nothing to commit|no changes added/.test(e)) {
      return { ok: false, error: "没有需要提交的改动（敏感信息已自动排除）" };
    }
    return { ok: false, error: `git commit 失败：${e}` };
  }
  // 推当前分支到配置的仓库（token 走 URL，不进 .git/config）
  const branch = await runExec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot, timeout: 15000 });
  const branchName = branch.ok ? branch.out : "main";
  const remoteUrl = `https://x-access-token:${token}@github.com/${ghConfig.repo}.git`;
  const push = await runExec("git", ["-c", "credential.helper=", "push", remoteUrl, branchName], { cwd: repoRoot, timeout: 120000 });
  if (!push.ok) {
    return { ok: false, error: `git push 失败：${push.error}`, commit: commit.out };
  }
  return { ok: true, files: files.length, branch: branchName, commit: commit.out, pushed: true };
}

/** 上传到 GitHub Releases（测试版 prerelease）并上传 zip。 */
  async function githubUpload({ repo, token, tag, name, body, zipPath, filename }) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "dsh-pro-desktop",
    };
    try {
      const createRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ tag_name: tag, name, body, prerelease: true, draft: false }),
      });
      if (!createRes.ok) {
        let msg = `HTTP ${createRes.status}`;
        try {
          msg = (await createRes.json())?.message ?? msg;
        } catch {
          /* ignore */
        }
        return { ok: false, error: `创建 release 失败：${msg}` };
      }
      const release = await createRes.json();
      const uploadUrl = (release.upload_url ?? "").replace("{?name,label}", `?name=${encodeURIComponent(filename)}`);
      const buf = await fs.readFile(zipPath);
      const upRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/zip" },
        body: buf,
      });
      if (!upRes.ok) {
        let msg = `HTTP ${upRes.status}`;
        try {
          msg = (await upRes.json())?.message ?? msg;
        } catch {
          /* ignore */
        }
        return { ok: false, error: `上传资产失败：${msg}` };
      }
      return { ok: true, url: release.html_url, tag: release.tag_name };
    } catch (e) {
      return { ok: false, error: `GitHub 请求失败：${e?.message ?? e}` };
    }
  }

  /** 版本快照目录（浏览/打包安全根）。 */
  async function versionDirOf(workspacePath, versionId) {
    const key = v.archiveKey(workspacePath);
    const all = await v.listVersions(v.dataDir(), key);
    const ver = all.find((x) => x.id === versionId);
    if (!ver) return null;
    return { ver, dir: path.join(v.dataDir(), "versions", key, ver.dir) };
  }

  /** git 仓库状态（尽力而为）。 */
  function gitStatus(dir) {
    return new Promise((resolve) => {
      const root = path.resolve(dir);
      let exec;
      try {
        exec = execFile;
      } catch {
        resolve({ isRepo: false, branch: null, dirty: 0, lastCommit: null, error: "git unavailable" });
        return;
      }
      try {
        exec("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], { timeout: 5000 }, (err, stdout) => {
          try {
            if (err || String(stdout).trim() !== "true") {
              resolve({ isRepo: false, branch: null, dirty: 0, lastCommit: null });
              return;
            }
            const branch = (cb) =>
              exec("git", ["-C", root, "branch", "--show-current"], { timeout: 5000 }, (e, out) => cb(e ? null : out.trim() || null));
            const dirty = (cb) =>
              exec("git", ["-C", root, "status", "--porcelain"], { timeout: 5000 }, (e, out) => cb(e ? 0 : out.split("\n").filter(Boolean).length));
            const last = (cb) =>
              exec("git", ["-C", root, "log", "-1", "--format=%h %s"], { timeout: 5000 }, (e, out) => cb(e ? null : out.trim() || null));
            branch((br) =>
              dirty((d) =>
                last((lc) => resolve({ isRepo: true, branch: br, dirty: d, lastCommit: lc }))
              )
            );
          } catch {
            resolve({ isRepo: false, branch: null, dirty: 0, lastCommit: null });
          }
        });
      } catch {
        resolve({ isRepo: false, branch: null, dirty: 0, lastCommit: null, error: "git unavailable" });
      }
    });
  }

  async function resolveWorkspace(body) {
    if (typeof body.sessionId === "string" && body.sessionId) {
      const ws = workspaceOfSession(body.sessionId);
      if (ws) return ws;
    }
    if (typeof body.path === "string" && body.path) {
      return { path: body.path, title: body.path };
    }
    return null;
  }

  /** 打快照（手动或自动）。 */
  async function doSnapshot(body, { auto = false } = {}) {
    const ws = await resolveWorkspace(body);
    if (!ws) throw new Error("缺少 sessionId 或 path");
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
    const meta = await v.snapshot({
      workspacePath: ws.path,
      sessionIds: ws.sessionIds ?? [],
      sessionId,
      sessionTitle: sessionId ? sessionTitleOf(sessionId) : undefined,
      auto,
      semver: typeof body.semver === "string" ? body.semver : undefined,
      message: typeof body.message === "string" ? body.message : "",
    });
    return meta;
  }

  // ---- 自动快照：每轮任务完成 ----
  ctx.on("agent/turn-stopping", (payload) => {
    try {
      const agent = payload?.agent;
      const sessionId = agent?.sessionId ?? agent?.id ?? this?.sessionId;
      if (!sessionId) return;
      const ws = workspaceOfSession(sessionId);
      if (!ws) return; // 会话不属于任何工作区档案，跳过
      // 异步打快照，不阻塞回合收尾
      v.snapshot({
        workspacePath: ws.path,
        sessionIds: ws.sessionIds ?? [],
        sessionId,
        sessionTitle: sessionTitleOf(sessionId),
        auto: true,
        message: "自动快照（任务完成）",
      }).catch((e) => {
        console.warn(`[dsh-pro] auto snapshot failed: ${e?.message ?? e}`);
      });
    } catch (e) {
      console.warn(`[dsh-pro] turn-stopping handler failed: ${e?.message ?? e}`);
    }
  });

  const routes = [
    // 总控制器数据：工作区 → 功能框（会话）→ 版本
    {
      kind: "exact",
      path: "/api/pro/archives",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          writeJson(res, 200, {
            ok: true,
            archives: await archives(),
            autoSnapshot: true,
            dataDir: v.dataDir(),
          });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },

    // 当前会话所在档案（会话头部「版本」按钮用）
    {
      kind: "exact",
      path: "/api/pro/archive",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const url = new URL(req.url, "http://127.0.0.1");
          const sessionId = url.searchParams.get("sessionId") ?? "";
          const ws = workspaceOfSession(sessionId);
          if (!ws) {
            writeJson(res, 404, { error: "该会话不属于任何工作区档案" });
            return;
          }
          const key = v.archiveKey(ws.path);
          writeJson(res, 200, {
            ok: true,
            archive: {
              workspaceId: ws.id,
              path: ws.path,
              title: ws.title,
              sessionIds: ws.sessionIds ?? [],
              versions: await v.listVersions(v.dataDir(), key),
            },
          });
        } catch (e) {
          writeJson(res, 500, { error: String(e?.message ?? e) });
        }
      },
    },

    // 手动/自动打快照（功能框专属对话 + AI 生成内容一并纳入）
    {
      kind: "exact",
      path: "/api/pro/snapshot",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const meta = await doSnapshot(body, { auto: body.auto === true });
          writeJson(res, 200, { ok: true, version: meta });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 回滚到指定版本（文件区 + 对话区）
    {
      kind: "exact",
      path: "/api/pro/restore",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          if (typeof body.path !== "string" || typeof body.versionId !== "string") {
            writeJson(res, 400, { error: "缺少 path 或 versionId" });
            return;
          }
          const meta = await v.restore({ workspacePath: body.path, versionId: body.versionId });
          writeJson(res, 200, { ok: true, version: meta });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 删除版本
    {
      kind: "exact",
      path: "/api/pro/version",
      handler: async (req, res) => {
        if (!methodOf(req, res, "DELETE")) return;
        try {
          const body = await readJsonBody(req);
          if (typeof body.path !== "string" || typeof body.versionId !== "string") {
            writeJson(res, 400, { error: "缺少 path 或 versionId" });
            return;
          }
          await v.deleteVersion({ workspacePath: body.path, versionId: body.versionId });
          writeJson(res, 200, { ok: true });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 标记/取消「最终版」（汇总到总控制器）
    {
      kind: "exact",
      path: "/api/pro/finalize",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          if (typeof body.path !== "string" || typeof body.versionId !== "string") {
            writeJson(res, 400, { error: "缺少 path 或 versionId" });
            return;
          }
          const ver = await v.setFinal({ workspacePath: body.path, versionId: body.versionId, final: body.final !== false });
          writeJson(res, 200, { ok: true, version: ver });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 文件区：源管理（GET=列表 / POST=添加；真实 webserver 要求 (kind,path) 唯一，故合并）
    {
      kind: "exact",
      path: "/api/pro/sources",
      handler: async (req, res) => {
        try {
          if (req.method === "GET") {
            const out = [];
            for (const s of sources) {
              let repo = null;
              if (s.type === "git") repo = await gitStatus(s.path).catch(() => null);
              out.push({ ...s, repo, exists: await fs.stat(s.path).catch(() => null) !== null });
            }
            writeJson(res, 200, { ok: true, sources: out });
            return;
          }
          if (req.method === "POST") {
            const body = await readJsonBody(req);
            const type = body.type === "git" ? "git" : "folder";
            const id = "src_" + Math.random().toString(36).slice(2, 10);
            const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
            if (type === "folder") {
              const p = typeof body.path === "string" ? body.path.trim() : "";
              if (!p || !(await fs.stat(p).catch(() => null))?.isDirectory()) {
                writeJson(res, 400, { error: "本地文件夹路径不存在" });
                return;
              }
              sources.push({
                id,
                type,
                name: name ?? path.basename(p),
                path: path.resolve(p),
                createdAt: Date.now(),
              });
              await saveSources();
              writeJson(res, 201, { ok: true, source: sources[sources.length - 1] });
              return;
            }
            // git：clone 到数据目录 sources/<id>
            const url = typeof body.url === "string" ? body.url.trim() : "";
            if (!/^https?:\/\//.test(url) && !/^git@/.test(url)) {
              writeJson(res, 400, { error: "git 地址格式无效（需 http(s):// 或 git@）" });
              return;
            }
            const dest = path.join(v.dataDir(), "sources", id);
            const r = await runGit(["clone", "--depth", "1", url, dest]);
            if (!r.ok) {
              writeJson(res, 400, { error: `git clone 失败：${r.error}` });
              return;
            }
            sources.push({
              id,
              type,
              name: name ?? (url.replace(/\.git$/, "").split("/").pop() || id),
              url,
              path: dest,
              createdAt: Date.now(),
            });
            await saveSources();
            writeJson(res, 201, { ok: true, source: sources[sources.length - 1] });
            return;
          }
          writeJson(res, 405, { error: `method ${req.method} not allowed` });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 文件区：删除源登记（保留本地目录）
    {
      kind: "exact",
      path: "/api/pro/sources/delete",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const before = sources.length;
          sources = sources.filter((s) => s.id !== body.id);
          if (sources.length === before) {
            writeJson(res, 404, { error: "源不存在" });
            return;
          }
          await saveSources();
          writeJson(res, 200, { ok: true });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 文件区：git 源拉取更新
    {
      kind: "exact",
      path: "/api/pro/sources/pull",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          const s = sourceOf(body.id);
          if (!s) {
            writeJson(res, 404, { error: "源不存在" });
            return;
          }
          if (s.type !== "git") {
            writeJson(res, 400, { error: "仅 git 源可拉取" });
            return;
          }
          const r = await runGit(["pull"], s.path);
          if (!r.ok) {
            writeJson(res, 400, { error: `git pull 失败：${r.error}` });
            return;
          }
          writeJson(res, 200, { ok: true, out: r.out });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 总文件区：列目录（安全边界 = 已注册源）
    {
      kind: "exact",
      path: "/api/pro/tree",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const url = new URL(req.url, "http://127.0.0.1");
          const sid = url.searchParams.get("source") ?? "";
          const dir = url.searchParams.get("dir") ?? "";
          const s = sourceOf(sid);
          if (!s) {
            writeJson(res, 404, { error: "源不存在" });
            return;
          }
          const root = path.resolve(s.path);
          const resolved = path.resolve(dir || root);
          if (!withinRoot(root, resolved)) {
            writeJson(res, 400, { error: "路径超出该源范围" });
            return;
          }
          const entries = [];
          for (const entry of await fs.readdir(resolved, { withFileTypes: true })) {
            if (entry.name === ".git") continue;
            if (v.isExcludedName(entry.name)) continue;
            const isDir = entry.isDirectory();
            let size = 0;
            if (!isDir) {
              try {
                size = (await fs.stat(path.join(resolved, entry.name))).size;
              } catch {
                /* ignore */
              }
            }
            entries.push({ name: entry.name, dir: isDir, size });
          }
          entries.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
          let repo;
          try {
            repo = await gitStatus(resolved);
          } catch {
            repo = { isRepo: false, branch: null, dirty: 0, lastCommit: null };
          }
          writeJson(res, 200, {
            ok: true,
            sourceId: s.id,
            sourceName: s.name,
            sourceType: s.type,
            dir: resolved,
            root,
            isRoot: resolved === root,
            entries,
            repo,
          });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 总文件区：读文件内容（文本，限 512KB；二进制提示）
    {
      kind: "exact",
      path: "/api/pro/file",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const url = new URL(req.url, "http://127.0.0.1");
          const sid = url.searchParams.get("source") ?? "";
          const file = url.searchParams.get("path") ?? "";
          const s = sourceOf(sid);
          if (!s) {
            writeJson(res, 404, { error: "源不存在" });
            return;
          }
          const root = path.resolve(s.path);
          const resolved = path.resolve(file);
          if (!withinRoot(root, resolved)) {
            writeJson(res, 400, { error: "路径超出该源范围" });
            return;
          }
          const st = await fs.stat(resolved).catch(() => null);
          if (!st || !st.isFile()) {
            writeJson(res, 404, { error: "文件不存在" });
            return;
          }
          if (st.size > 512 * 1024) {
            writeJson(res, 200, { ok: true, name: path.basename(resolved), tooLarge: true, size: st.size });
            return;
          }
          const buf = await fs.readFile(resolved);
          const isBinary = buf.subarray(0, 4096).includes(0);
          writeJson(res, 200, {
            ok: true,
            name: path.basename(resolved),
            size: st.size,
            binary: isBinary,
            content: isBinary ? null : buf.toString("utf8"),
          });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // GitHub 上传配置（token 只写本地，接口只回传 hasToken）
    {
      kind: "exact",
      path: "/api/pro/config",
      handler: async (req, res) => {
        try {
          if (req.method === "GET") {
            writeJson(res, 200, { ok: true, github: { repo: ghConfig.repo, hasToken: ghConfig.token.length > 0 } });
            return;
          }
          if (req.method === "POST") {
            const body = await readJsonBody(req);
            const g = body?.github ?? {};
            if (typeof g.repo === "string" && /^[\w.-]+\/[\w.-]+$/.test(g.repo.trim())) {
              ghConfig.repo = g.repo.trim();
            }
            if (typeof g.token === "string" && g.token.trim()) {
              ghConfig.token = g.token.trim();
            }
            await saveConfig();
            writeJson(res, 200, { ok: true, github: { repo: ghConfig.repo, hasToken: ghConfig.token.length > 0 } });
            return;
          }
          writeJson(res, 405, { error: `method ${req.method} not allowed` });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 查看版本快照内容：目录树（安全根 = 版本快照目录）
    {
      kind: "exact",
      path: "/api/pro/vtree",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const url = new URL(req.url, "http://127.0.0.1");
          const ws = url.searchParams.get("path") ?? "";
          const ver = url.searchParams.get("version") ?? "";
          const dir = url.searchParams.get("dir") ?? "";
          const found = await versionDirOf(ws, ver);
          if (!found) {
            writeJson(res, 404, { error: "版本不存在" });
            return;
          }
          const root = path.resolve(found.dir);
          const resolved = path.resolve(dir || root);
          if (!withinRoot(root, resolved)) {
            writeJson(res, 400, { error: "路径超出该版本范围" });
            return;
          }
          const entries = [];
          for (const entry of await fs.readdir(resolved, { withFileTypes: true })) {
            const isDir = entry.isDirectory();
            let size = 0;
            if (!isDir) {
              try {
                size = (await fs.stat(path.join(resolved, entry.name))).size;
              } catch {
                /* ignore */
              }
            }
            entries.push({ name: entry.name, dir: isDir, size });
          }
          entries.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
          writeJson(res, 200, {
            ok: true,
            semver: found.ver.semver,
            dir: resolved,
            root,
            isRoot: resolved === root,
            entries,
          });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 查看版本快照内容：文件读取
    {
      kind: "exact",
      path: "/api/pro/vfile",
      handler: async (req, res) => {
        if (!methodOf(req, res, "GET")) return;
        try {
          const url = new URL(req.url, "http://127.0.0.1");
          const ws = url.searchParams.get("path") ?? "";
          const ver = url.searchParams.get("version") ?? "";
          const file = url.searchParams.get("file") ?? "";
          const found = await versionDirOf(ws, ver);
          if (!found) {
            writeJson(res, 404, { error: "版本不存在" });
            return;
          }
          const root = path.resolve(found.dir);
          const resolved = path.resolve(file);
          if (!withinRoot(root, resolved)) {
            writeJson(res, 400, { error: "路径超出该版本范围" });
            return;
          }
          const st = await fs.stat(resolved).catch(() => null);
          if (!st || !st.isFile()) {
            writeJson(res, 404, { error: "文件不存在" });
            return;
          }
          if (st.size > 512 * 1024) {
            writeJson(res, 200, { ok: true, name: path.basename(resolved), tooLarge: true, size: st.size });
            return;
          }
          const buf = await fs.readFile(resolved);
          const isBinary = buf.subarray(0, 4096).includes(0);
          writeJson(res, 200, {
            ok: true,
            name: path.basename(resolved),
            size: st.size,
            binary: isBinary,
            content: isBinary ? null : buf.toString("utf8"),
          });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },

    // 上传到 GitHub Releases（测试版 prerelease）：打包 → 建 release → 传资产
    {
      kind: "exact",
      path: "/api/pro/upload",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          if (typeof body.path !== "string") {
            writeJson(res, 400, { error: "缺少 path" });
            return;
          }
          if (!ghConfig.repo || !ghConfig.token) {
            writeJson(res, 400, { error: "尚未配置 GitHub 仓库/Token（总控制器 → GitHub 设置）" });
            return;
          }
          const key = v.archiveKey(body.path);
          const all = await v.listVersions(v.dataDir(), key);
          let target = null;
          if (typeof body.versionId === "string" && body.versionId) {
            target = all.find((x) => x.id === body.versionId) ?? null;
            if (!target) {
              writeJson(res, 400, { error: "指定版本不存在" });
              return;
            }
          } else {
            target = all.find((x) => x.final === true) ?? all[0] ?? null;
          }
          if (!target) {
            writeJson(res, 400, { error: "该项目还没有版本，先打一个快照" });
            return;
          }
          const versionDir = path.join(v.dataDir(), "versions", key, target.dir);
          const include = body.include ?? "both";

          // 1) 组装待打包目录（按 include 选择文件区/对话区）
          const id = "up_" + Math.random().toString(36).slice(2, 10);
          const stage = path.join(v.dataDir(), "uploads", id);
          const zipPath = path.join(v.dataDir(), "uploads", `${id}.zip`);
          await fs.rm(stage, { recursive: true, force: true });
          await fs.mkdir(stage, { recursive: true });
          await fs.copyFile(path.join(versionDir, "manifest.json"), path.join(stage, "manifest.json"));
          if (include !== "dialogs") {
            await v.copyTree(versionDir, path.join(stage, "files"), new Set([path.resolve(path.join(versionDir, "dialogs"))]));
          }
          if (include !== "files") {
            const dialogsSrc = path.join(versionDir, "dialogs");
            if (await fs.stat(dialogsSrc).catch(() => null)) {
              await v.copyTree(dialogsSrc, path.join(stage, "dialogs"));
            }
          }

          // 2) 打包 zip
          const pkg = await makeZip(stage, zipPath);
          if (!pkg.ok) {
            writeJson(res, 500, { error: `打包失败：${pkg.error}` });
            return;
          }

          // 3) 创建 GitHub release（测试版）并上传资产
          const title = (await fs.readFile(path.join(versionDir, "manifest.json"), "utf8").then((s) => JSON.parse(s).workspacePath).catch(() => body.path)) || body.path;
          const tag = `v${target.semver}`;
          const filename = `${(path.basename(title) || "project").replace(/[^\w.-]/g, "_")}-${target.semver}.zip`;
          const releaseBody = `${target.message || "专业版发布"}（semver ${target.semver}）\n\n文件区 ${target.fileCount} 个文件 · 对话区 ${target.dialogCount ?? 0} 个 · 测试版`;
          const up = await githubUpload({
            repo: ghConfig.repo,
            token: ghConfig.token,
            tag,
            name: `专业版 v${target.semver}（测试版）`,
            body: releaseBody,
            zipPath,
            filename,
          });
          // 清理临时打包文件（zip 里已含全部内容）
          await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
          await fs.rm(zipPath, { force: true }).catch(() => {});
          if (!up.ok) {
            writeJson(res, 400, { error: up.error });
            return;
          }
          writeJson(res, 200, {
            ok: true,
            release: { tag: up.tag, url: up.url, prerelease: true },
            version: target.semver,
          });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },
    // 推代码到 GitHub（默认排查敏感信息；dryRun 预览）
    {
      kind: "exact",
      path: "/api/pro/push",
      handler: async (req, res) => {
        if (!methodOf(req, res, "POST")) return;
        try {
          const body = await readJsonBody(req);
          if (typeof body.path !== "string" || !body.path.trim()) {
            writeJson(res, 400, { error: "缺少 path" });
            return;
          }
          if (!ghConfig.repo || !ghConfig.token) {
            writeJson(res, 400, { error: "尚未配置 GitHub 仓库/Token（总控制器 → GitHub 设置）" });
            return;
          }
          const repoRoot = path.resolve(body.path);
          const r = await pushCode({
            repoRoot,
            message: typeof body.message === "string" ? body.message : "",
            token: ghConfig.token,
            dryRun: body.dryRun === true,
          });
          if (!r.ok) {
            writeJson(res, 400, { error: r.error });
            return;
          }
          writeJson(res, 200, { ok: true, ...r });
        } catch (e) {
          writeJson(res, 400, { error: String(e?.message ?? e) });
        }
      },
    },
  ];

  const disposers = routes.map((route) => ctx.webServer.register(route));
  loadSources();
  loadConfig();
  ctx.on("dispose", () => {
    for (const dispose of disposers) dispose();
    saveSources();
    saveConfig();
  });
}
