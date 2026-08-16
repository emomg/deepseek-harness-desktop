# DeepSeek Harness Pro（专业版）设计文档 v3

> **设计原则（用户确认）：不完全仿照 VS Code，是 DeepSeek Harness 对于 IDE 的延伸。
> 专业版 = DSH 自身的插件扩展；桌面壳只做窗口容器。**

---

## 0. 架构（v3：插件版）

```
┌─ dsh-desktop.exe（桌面壳，Rust）─────────────────────────────┐
│  主窗口 → 加载 DSH Web UI（http://127.0.0.1:3080）            │
│  dsh 生命周期（拉起/退出清理）/ 托盘 / 桌面版自更新（可关）      │
└────────────────────────────────────────────────────────────┘
┌─ DSH Web UI（3080，dsh web 进程）───────────────────────────┐
│  ┌─ @dsh-pro/desktop · 宿主插件（Node，dsh 进程内）──────────┐ │
│  │  档案 = DSH 工作区（目录=文件区 + 会话=对话区）             │ │
│  │  版本管理：快照/列表/回滚/删除（/api/pro/* 路由）            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ @dsh-pro/desktop · 客户端插件（注入 DSH 原生 UI）─────────┐ │
│  │  侧边栏「项目控制器」入口+面板（sidebar.footer.action）      │ │
│  │  会话头部：快照 / 版本 / 上传（header.actions）             │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

- **不做**：独立 IDE 页面、iframe 包裹、第二套项目注册表、壳内嵌 HTTP 前端。
- **数据模型**：项目档案 = DSH 工作区。文件区 = 工作区目录；对话区 = 该工作区会话
  （`~/.dsh/sessions/<编码目录>/`，按工作区归档，天然分组）。版本 = 文件快照 + 对话快照。
- **上传**：客户端先**询问**（是否上传 + 上传什么：文件区/对话区/两者）→ 打包 → v2 接 GitHub Releases。

## 1. 插件包（desktop-app/pro-plugin/，@dsh-pro/desktop）

| 文件 | 职责 |
|---|---|
| `lib/index.js` | 宿主插件：档案/版本服务 + `/api/pro/*` 路由（webServer 注册） |
| `lib/version.js` | 版本核心（Node 移植，语义与 Rust SNAPCHECK 一致，已无头测试 18 项通过） |
| `lib/client.js` | 客户端插件（手写 `__ModuleLoader__.load` 格式，React，无构建） |
| `cordis.patch.yml` | 插入插件行 `{id: dsh-pro, name: '@dsh-pro/desktop'}` |
| `package.json` | `dsh.bundle.patch` + `dsh.client` 元数据 + peer deps |
| `test/version.test.js` | 版本核心无头测试（18 项） |
| `test/host.test.js` | 宿主插件 mock-ctx 路由测试（12 项） |

### 宿主端
- 复用 DSH 原生模型：`ctx.workspaceRegistry`（工作区 + sessionIds）+ `ctx.webServer`（路由）。
- 路由（同源 3080，客户端直接 fetch）：
  - `GET /api/pro/archives` 项目控制器数据
  - `GET /api/pro/archive?sessionId=` 会话所在档案
  - `POST /api/pro/snapshot` `{sessionId|path, semver?, message?}`
  - `POST /api/pro/restore` `{path, versionId}`
  - `DELETE /api/pro/version` `{path, versionId}`
  - `POST /api/pro/upload` `{path, include}`（询问后的打包；v2 接 GitHub）
- 数据目录：`%LOCALAPPDATA%\DeepSeek Harness Pro\data`（`DSH_PRO_DATA_DIR` 可覆盖）。

### 客户端端（Slot 注入，DSH 原生观感，自动继承主题 token）
- `sidebar.footer.action`：「项目控制器」入口按钮 + 面板（档案列表 → 选中档案的版本时间线
  → 打快照/回滚/删除/上传（含"上传什么"选择））。
- `conversation.session.header.actions`：会话头部「快照 / 版本 / 上传」按钮。
- 数据：同源 fetch `/api/pro/*`；无跨域、无桥接、无自建服务。

## 2. 版本快照规则（与已验证语义一致）

- 忽略清单：`.git node_modules target dist build out .venv venv __pycache__ .idea .vscode *.log *.tmp *.cache`
- semver：用户输入或自动 +0.0.1；同版本多次用 seq 区分（`0.3.1-2`）
- 快照：文件区完整复制 + 对话区（会话 jsonl.zstd）复制 → `versions/<key>/vX.Y.Z-seq/` + `manifest.json`
- 回滚：先自动备份当前状态为 `.pre-restore-<ts>`，再覆盖文件区与对话区
  （对话区还原需刷新/重启 dsh 完全生效）

## 3. 桌面壳（Tauri，职责收窄）

- 主窗口：占位页 → 导航 `http://127.0.0.1:3080`
- 托盘：显示主窗口 / 检查更新 / 退出；`DSH_PRO_DISABLE_UPDATE=1` 关启动更新检查
- dsh 拉起/端口检测/退出清理（沿用）；**无** IDE 服务/版本逻辑/窗口桥接
- 代码：`src-tauri/src/lib.rs`（单文件），`dist/index.html` 仅启动占位页

## 4. 安装与验证

```powershell
# 1. 无头测试
node pro-plugin\test\version.test.js   # 18 项
node pro-plugin\test\host.test.js      # 12 项

# 2. 安装到 web profile（自动追加 dsh.profile.bundles）
dsh plugin --profile web add link:D:\dsh\desktop-app\pro-plugin

# 3. 确认组合层（无需重启）
dsh --profile web --dump-config | Select-String dsh-pro

# 4. 重启 dsh web（或重启桌面端）→ 侧边栏出现「项目控制器」，会话头部出现 快照/版本/上传
```

已实测：组合树包含 `- id: dsh-pro, name: '@dsh-pro/desktop'`；安装包已 link 进 profile。

## 5. 二期

- GitHub 上传落地：token 配置（设置分区）、创建 release + 上传 zip（复用在桌面版更新器里验证过的 node fetch + SHA256 模式）
- 快照对比/增量、忽略清单可配置（设置分区）
- 会话头部按钮接入 RPC（dsh-host-apiproxy）替代轮询

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| 客户端插件 loader 格式 | 照抄已装插件的 rolldown shim + 语法已通过 node --check；运行时需重启验证 |
| 对话区编码目录 | `--D-dsh--` 规则已验证；快照时目录不存在则优雅降级（dialogCount=0） |
| 会话热回滚 | 文档明示需刷新/重启 dsh 完全生效 |
| 沙箱/权限 | 安装步骤需对 %USERPROFILE%\.dsh 与 pnpm store 有写权限 |
