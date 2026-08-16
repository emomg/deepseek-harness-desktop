//! @dsh-pro/desktop · version.js 无头端到端测试（对应 Rust SNAPCHECK 语义）
//! 运行：node test/version.test.js

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as v from "../lib/version.js";

let passed = 0;
function check(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  passed += 1;
  console.log(`ok: ${msg}`);
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dshpro-test-"));
process.env.DSH_PRO_DATA_DIR = path.join(tmp, "data");
process.env.DSH_HOME = path.join(tmp, "dsh");
const project = path.join(tmp, "proj");
const sessionsRoot = path.join(process.env.DSH_HOME, "sessions", v.encodeWorkspaceDir(project));

try {
  // 准备项目（含应被忽略的 node_modules）
  await fs.mkdir(path.join(project, "src"), { recursive: true });
  await fs.mkdir(path.join(project, "node_modules"), { recursive: true });
  await fs.mkdir(path.join(sessionsRoot, "session-abc"), { recursive: true });
  await fs.writeFile(path.join(project, "README.md"), "readme v1");
  await fs.writeFile(path.join(project, "src/main.py"), "print('v1')");
  await fs.writeFile(path.join(project, "node_modules/ignore.js"), "IGNORE");
  await fs.writeFile(path.join(sessionsRoot, "session-abc", "session.jsonl.zstd"), "DIALOG1");

  // 快照 v1（含对话区）
  const m1 = await v.snapshot({ workspacePath: project, sessionIds: ["session-abc"], semver: "0.1.0", message: "初始" });
  check(m1.semver === "0.1.0", `v1 semver = ${m1.semver}`);
  check(m1.fileCount === 2, `v1 文件区 fileCount = ${m1.fileCount}（node_modules 应被忽略）`);
  check(m1.dialogCount === 1, `v1 对话区 dialogCount = ${m1.dialogCount}`);
  const manifest = JSON.parse(await fs.readFile(path.join(v.dataDir(), "versions", v.archiveKey(project), m1.dir, "manifest.json"), "utf8"));
  check(manifest.semver === "0.1.0", "manifest.json 存在且 semver 正确");

  // 修改 + 新增
  await fs.writeFile(path.join(project, "src/main.py"), "print('v2')");
  await fs.writeFile(path.join(project, "new.txt"), "new");
  await fs.writeFile(path.join(sessionsRoot, "session-abc", "session.jsonl.zstd"), "DIALOG2");

  // 快照 v2（自动 +patch）
  const m2 = await v.snapshot({ workspacePath: project, sessionIds: ["session-abc"] });
  check(m2.semver === "0.1.1", `v2 自动 +patch = ${m2.semver}`);
  check(m2.fileCount === 3, `v2 fileCount = ${m2.fileCount}`);

  // 列表倒序
  const list = await v.listVersions(v.dataDir(), v.archiveKey(project));
  check(list.length === 2, "版本列表共 2 条");
  check(list[0].id === m2.id, "列表按时间倒序");

  // 回滚 v1 → 文件区 + 对话区
  await v.restore({ workspacePath: project, versionId: m1.id });
  const content = await fs.readFile(path.join(project, "src/main.py"), "utf8");
  check(content.trim() === "print('v1')", `回滚后 main.py = ${JSON.stringify(content.trim())}`);
  check(!(await fs.stat(path.join(project, "new.txt")).catch(() => null)), "回滚后 new.txt 已移除");
  check(await fs.stat(path.join(project, "README.md")).catch(() => null), "回滚后 README.md 保留");
  const dialog = await fs.readFile(path.join(sessionsRoot, "session-abc", "session.jsonl.zstd"), "utf8");
  check(dialog === "DIALOG1", `回滚后对话区还原 = ${JSON.stringify(dialog)}`);
  const backups = (await fs.readdir(path.join(v.dataDir(), "versions", v.archiveKey(project)))).filter((n) => n.startsWith(".pre-restore-"));
  check(backups.length === 1, "回滚前自动备份 .pre-restore-* 存在");

  // 删除 v2
  await v.deleteVersion({ workspacePath: project, versionId: m2.id });
  const list2 = await v.listVersions(v.dataDir(), v.archiveKey(project));
  check(list2.length === 1 && list2[0].id === m1.id, "删除 v2 后仅剩 v1");

  // 会话字段 + 自动标记
  check(m1.sessionId === null && m1.auto === false, "工作区级快照 sessionId=null auto=false");
  const m3 = await v.snapshot({ workspacePath: project, sessionIds: ["session-abc"], sessionId: "session-abc", sessionTitle: "登录功能", auto: true });
  check(m3.sessionId === "session-abc" && m3.sessionTitle === "登录功能" && m3.auto === true, "功能框自动快照带 sessionId/auto");
  check(m3.dialogCount === 1, `功能框快照只含该会话对话（${m3.dialogCount}）`);
  await v.deleteVersion({ workspacePath: project, versionId: m3.id });

  // 交付物排除：AI 生成文件不进快照
  await fs.writeFile(path.join(project, "gen-output.js"), "AI GENERATED");
  const m4 = await v.snapshot({ workspacePath: project, sessionIds: ["session-abc"], excludeFiles: [path.join(project, "gen-output.js")] });
  check(m4.fileCount === 2, `排除交付物后 fileCount=${m4.fileCount}（gen-output.js 不在内）`);
  const genExists = await fs.stat(path.join(v.dataDir(), "versions", v.archiveKey(project), m4.dir, "gen-output.js")).catch(() => null);
  check(!genExists, "快照目录中不存在被排除的交付物文件");
  await v.deleteVersion({ workspacePath: project, versionId: m4.id });

  // 工具函数
  check(v.normalizeSemver("v1.2.3") === "1.2.3", "normalizeSemver(v1.2.3)");
  check(v.normalizeSemver("1.2") === null, "normalizeSemver 拒绝 1.2");
  check(v.bumpPatch("0.9.9") === "0.9.10", "bumpPatch(0.9.9) = 0.9.10");
  check(v.encodeWorkspaceDir("D:\\dsh") === "--D-dsh--", "encodeWorkspaceDir(D:\\dsh) = --D-dsh--");

  console.log(`\nVERSION TEST OK (${passed} checks)`);
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
