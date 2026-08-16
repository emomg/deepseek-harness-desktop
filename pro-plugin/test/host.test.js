//! 宿主插件 smoke test：mock ctx（workspaceRegistry + webServer），
//! 直接调用 apply() 注册路由，再用假 req/res 打一遍关键接口。
//! 运行：node test/host.test.js

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as plugin from "../lib/index.js";
import * as v from "../lib/version.js";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dshpro-host-"));
process.env.DSH_PRO_DATA_DIR = path.join(tmp, "data");
process.env.DSH_HOME = path.join(tmp, "dsh");

// 准备一个工作区
const ws = path.join(tmp, "ws");
await fs.mkdir(path.join(ws, "src"), { recursive: true });
await fs.writeFile(path.join(ws, "README.md"), "hi");
await fs.writeFile(path.join(ws, "src/a.js"), "a");

// mock 注册表：一个工作区，含会话 session-1
const workspaceEntity = {
  id: "ws_1",
  path: ws,
  title: "测试项目",
  sessionIds: ["session-1"],
};
const routes = [];
const disposers = [];
const eventHandlers = {};
const ctx = {
  workspaceRegistry: {
    list: () => [workspaceEntity],
  },
  webServer: {
    register: (route) => {
      routes.push(route);
      const d = () => {
        const i = routes.indexOf(route);
        if (i >= 0) routes.splice(i, 1);
      };
      disposers.push(d);
      return d;
    },
  },
  sessions: {
    get: () => ({ title: "登录功能" }),
  },
  on: (ev, fn) => {
    eventHandlers[ev] = fn;
  },
};

plugin.apply(ctx);
if (routes.length !== 15) {
  console.error(`FAIL: 期望 15 条路由，实际 ${routes.length}`);
  process.exit(1);
}
console.log(`ok: 注册 ${routes.length} 条 /api/pro/* 路由`);
console.log(`ok: 监听 ${Object.keys(eventHandlers).join(", ")}`);

// 假 req/res
function fakeReq(method, url, body) {
  const req = { method, url };
  req.on = () => req;
  process.nextTick(() => {
    req._emit && req._emit();
  });
  if (body !== undefined) {
    req._body = JSON.stringify(body);
    req.on = (ev, cb) => {
      if (ev === "data") process.nextTick(() => cb(req._body));
      if (ev === "end") process.nextTick(cb);
      return req;
    };
  }
  return req;
}
function fakeRes() {
  const res = { _code: 0, _body: null, _head: null };
  res.writeHead = (code, head) => {
    res._code = code;
    res._head = head;
  };
  res.end = (b) => {
    res._body = b;
    res._ended = true;
  };
  return res;
}
async function call(method, url, body) {
  const pathname = url.split("?")[0];
  const candidates = routes.filter((r) => r.path === pathname);
  if (candidates.length === 0) throw new Error(`no route for ${url}`);
  let last = null;
  for (const route of candidates) {
    const res = fakeRes();
    await route.handler(fakeReq(method, url, body), res);
    last = { code: res._code, data: res._body ? JSON.parse(res._body) : null };
    if (res._code !== 405) break; // 正确的 handler 会处理该 method
  }
  return last;
}

let passed = 0;
const check = (c, m) => {
  if (!c) {
    console.error(`FAIL: ${m}`);
    process.exit(1);
  }
  passed += 1;
  console.log(`ok: ${m}`);
};

// 1. archives 列表
let r = await call("GET", "/api/pro/archives");
check(r.code === 200 && r.data.archives.length === 1, "GET /api/pro/archives 返回 1 个档案");
check(r.data.archives[0].title === "测试项目", "档案 title 正确");
check(r.data.archives[0].versions.length === 0, "档案初始无版本");

// 2. archive by sessionId
r = await call("GET", "/api/pro/archive?sessionId=session-1");
check(r.code === 200 && r.data.archive.path === ws, "GET /api/pro/archive?sessionId= 命中档案");
r = await call("GET", "/api/pro/archive?sessionId=nope");
check(r.code === 404, "未知会话返回 404");

// 3. snapshot（按 sessionId）
r = await call("POST", "/api/pro/snapshot", { sessionId: "session-1", semver: "0.1.0", message: "初始" });
check(r.code === 200 && r.data.version.semver === "0.1.0", "快照 v0.1.0 成功");
check(r.data.version.fileCount === 2, `文件区 2 个文件（实际 ${r.data.version.fileCount}）`);

// 4. 列表
r = await call("GET", "/api/pro/archives");
check(r.data.archives[0].versions.length === 1, "档案已有 1 个版本");

// 5. restore
r = await call("POST", "/api/pro/restore", { path: ws, versionId: "0.1.0-1" });
check(r.code === 200, "回滚成功");

// 6. delete version
r = await call("DELETE", "/api/pro/version", { path: ws, versionId: "0.1.0-1" });
check(r.code === 200, "删除版本成功");
r = await call("GET", "/api/pro/archives");
check(r.data.archives[0].versions.length === 0, "版本已清空");

// 7. upload 询问流程（无版本时拒绝）
r = await call("POST", "/api/pro/upload", { path: ws, include: "both" });
check(r.code === 400, "无版本时上传返回 400");

// 8. AI 生成内容：一并纳入快照（不排除）
await fs.writeFile(path.join(ws, "gen-a.js"), "AI");
await fs.writeFile(path.join(ws, "manual.js"), "hand");
r = await call("POST", "/api/pro/snapshot", { sessionId: "session-1", semver: "0.2.0", message: "含AI产物" });
check(r.code === 200 && r.data.version.fileCount === 4, `AI 产物一并纳入快照：fileCount=${r.data.version?.fileCount}（README/src/gen-a/manual 共 4）`);
const genInSnap = await fs.stat(path.join(ws, "..", "data", "versions", v.archiveKey(ws), r.data.version.dir, "gen-a.js")).catch(() => null);
check(!!genInSnap, "快照目录包含 AI 生成文件 gen-a.js");
const excludedVerId = r.data.version.id;

// 9. archives 按功能框（会话）分组
await call("POST", "/api/pro/snapshot", { path: ws, message: "工作区级" });
r = await call("GET", "/api/pro/archives");
const arc = r.data.archives[0];
check(arc.boxes.length >= 2, `archives 按功能框分组（${arc.boxes.length} 框）`);
const box = arc.boxes.find((b) => b.sessionId === "session-1");
check(box !== undefined && box.sessionTitle === "登录功能", "功能框带会话标题");
check(box.versions.some((ver) => ver.sessionId === "session-1"), "版本归属功能框");
check(arc.versions.some((ver) => ver.sessionId === null), "存在工作区级版本");

// 10. 自动快照触发（agent/turn-stopping）
r = await call("DELETE", "/api/pro/version", { path: ws, versionId: excludedVerId });
await eventHandlers["agent/turn-stopping"]({ agent: { sessionId: "session-1" }, turn: 1 });
await new Promise((r2) => setTimeout(r2, 50));
r = await call("GET", "/api/pro/archives");
const autoVer = r.data.archives[0].versions.find((ver) => ver.auto === true);
check(autoVer !== undefined, "agent/turn-stopping 触发自动快照");
check(autoVer && autoVer.sessionId === "session-1", "自动快照归属正确功能框");

// 11. finalize：标记最终版 → 最终版集合
r = await call("POST", "/api/pro/finalize", { path: ws, versionId: autoVer.id, final: true });
check(r.code === 200 && r.data.version.final === true, "版本标记为最终版");
r = await call("GET", "/api/pro/archives");
const fin = r.data.archives[0].finals.find((f) => f.sessionId === "session-1");
check(fin !== undefined && fin.finalized === true && fin.version.id === autoVer.id, "最终版集合包含该功能框最终版");
r = await call("POST", "/api/pro/finalize", { path: ws, versionId: autoVer.id, final: false });
check(r.code === 200 && r.data.version.final === false, "取消最终版");

// 12. 上传：未配置 GitHub 时拦截；配置后走真实上传（无有效 token 应报错而非崩溃）
r = await call("POST", "/api/pro/snapshot", { path: ws, semver: "0.3.0", message: "待上传" });
const uploadVerId = r.data.version.id;
r = await call("POST", "/api/pro/upload", { path: ws, versionId: uploadVerId, include: "files" });
check(r.code === 400 && /GitHub/.test(r.data.error ?? ""), "未配置 GitHub 时上传被拦截");
r = await call("GET", "/api/pro/config");
check(r.code === 200 && r.data.github.hasToken === false, "初始无 token");
r = await call("POST", "/api/pro/config", { github: { repo: "owner/repo", token: "ghp_fake_token" } });
check(r.code === 200 && r.data.github.hasToken === true && r.data.github.repo === "owner/repo", "保存 GitHub 配置成功");
r = await call("GET", "/api/pro/config");
check(r.code === 200 && r.data.github.hasToken === true, "配置持久化（token 不回传明文）");
r = await call("POST", "/api/pro/upload", { path: ws, versionId: uploadVerId, include: "files" });
check(r.code >= 400 && typeof r.data.error === "string" && r.data.error.length > 0, `伪造 token 上传返回错误（code=${r.code}，不崩溃）`);

// 13. 查看版本文件：vtree/vfile + 安全边界
r = await call("GET", `/api/pro/vtree?path=${encodeURIComponent(ws)}&version=${uploadVerId}`);
check(r.code === 200 && Array.isArray(r.data.entries) && r.data.semver === "0.3.0", "vtree 列出版本快照目录");
r = await call("GET", `/api/pro/vtree?path=${encodeURIComponent(ws)}&version=${uploadVerId}&dir=${encodeURIComponent(path.join("C:\\outside"))}`);
check(r.code === 400, "vtree 路径穿越被拒绝");
r = await call("GET", `/api/pro/vfile?path=${encodeURIComponent(ws)}&version=${uploadVerId}&file=${encodeURIComponent(path.join(ws, "..", "README.md"))}`);
check(r.code === 400, "vfile 路径穿越被拒绝");

// 14. 总文件区：源管理（git 仓库 + 本地文件夹）
r = await call("GET", "/api/pro/sources");
check(r.code === 200 && Array.isArray(r.data.sources) && r.data.sources.length === 0, "初始无源");
const folder = path.join(tmp, "folder-src");
await fs.mkdir(folder, { recursive: true });
await fs.writeFile(path.join(folder, "hello.txt"), "hello source");
r = await call("POST", "/api/pro/sources", { type: "folder", path: folder });
check(r.code === 201 && r.data.source.type === "folder", "添加本地文件夹源");
const srcId = r.data.source.id;
r = await call("POST", "/api/pro/sources", { type: "git", url: "not-a-url" });
check(r.code === 400, "git 地址校验拒绝无效 URL");
r = await call("GET", "/api/pro/sources");
check(r.data.sources.length === 1, "源列表 1 条");
// 浏览源内文件
r = await call("GET", `/api/pro/tree?source=${srcId}&dir=${encodeURIComponent(folder)}`);
check(r.code === 200 && Array.isArray(r.data.entries) && r.data.entries.length === 1, "源内目录树返回条目");
check(r.data.repo && r.data.repo.isRepo === false, "非 git 源优雅降级（isRepo=false）");
r = await call("GET", `/api/pro/file?source=${srcId}&path=${encodeURIComponent(path.join(folder, "hello.txt"))}`);
check(r.code === 200 && r.data.content.trim() === "hello source", "源内文件内容读取成功");
// 安全边界：路径超出该源范围
r = await call("GET", `/api/pro/tree?source=${srcId}&dir=${encodeURIComponent("C:\\outside")}`);
check(r.code === 400, "文件区安全边界：源外路径被拒绝");
// 删除源
r = await call("POST", "/api/pro/sources/delete", { id: srcId });
check(r.code === 200, "删除源登记成功");

console.log(`\nHOST TEST OK (${passed} checks)`);
await fs.rm(tmp, { recursive: true, force: true });
