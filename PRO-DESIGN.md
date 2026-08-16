# DeepSeek Harness Pro（专业版）设计文档 v2

> 设计原则：不仿照 VS Code，是 DeepSeek Harness 对 IDE 的延伸。
> 专业版 = DSH 自身的插件扩展（`@dsh-pro/core`）；桌面壳只做窗口容器。
> v0.1.1 起废弃旧版快照式版本管理，改为「模板/仪表盘/摘要/评审」四件套。

## 1. 架构（插件版）

```
┌─ dsh-desktop.exe（桌面壳，Rust）─────────────────────────────┐
│  主窗口 → 加载 DSH Web UI（http://127.0.0.1:3080）            │
│  dsh 生命周期（拉起/退出清理）/ 托盘 / 桌面版自更新（可关）      │
└────────────────────────────────────────────────────────────┘
┌─ DSH Web UI（3080，dsh web 进程）───────────────────────────┐
│  ┌─ @dsh-pro/core · 宿主插件（Node，dsh 进程内）──────────────┐ │
│  │  模板 CRUD / 自动摘要 / 仪表盘聚合 / 评审门禁（/api/pro/*） │ │
│  │  订阅 agent/turn-stopping → 自动摘要（节流 + 有新活动才生成）│ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ @dsh-pro/core · 客户端插件（注入 DSH 原生 UI）─────────────┐ │
│  │  侧边栏底部「Pro 面板」（sidebar.footer.action + overlay） │ │
│  │  /tpl 命令（commandUi popupSelect → 填变量 → 发送到会话）  │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

## 2. 数据模型

- **项目档案 = DSH 工作区**（workspaceRegistry：目录 + 会话列表），不建第二套注册表
- **摘要**：`summaries.json`，key = sessionId；{ summary, model, turnCount, lastSeq, updatedAt }
- **模板**：`templates.json`；{ id, name, description, prompt({{var}}), variables, tags }
- **评审**：`reviews.json` + `reviews/<id>/baseline/`（非 git 基线副本）；
  { id, workspacePath, baseline:{git|copy}, files:{path:{status,decision}}, status }
- 数据目录：`DSH_PRO_DATA_DIR` 或 `%LOCALAPPDATA%\DeepSeek Harness Pro\data`
- **不写 DSH 会话日志**（DSH 持久化拒绝未知事件类型）

## 3. 复用 DSH 原生能力

| 能力 | 复用 | 用途 |
|---|---|---|
| 工作区 | `ctx.workspaceRegistry` | 工作区 → 会话（仪表盘/摘要归属） |
| 会话 | `ctx.sessions` | live 会话读取（events/deriveMessages） |
| 投影 | `ctx.sessionProjections` | goal / todos / sessionStats 快照（仪表盘） |
| 持久化 | `ctx.sessionPersistence.readRaw` | 关闭会话的磁盘日志解析（仪表盘降级） |
| LLM | `ctx.llm.stream` | 摘要生成（route 取自 request/header，极简 StreamChunk 组装器，零依赖） |
| 命令 | `ctx.commandUi`（client） | /tpl 弹出选择 |
| 槽位 | `ctx.slots`（client） | sidebar.footer.action + shell.overlay |

## 4. 评审门禁语义

- 基线：git 仓库 → `HEAD`（diff = 工作区 vs HEAD）；非 git → 复制基线目录（排除 node_modules/缓存等，构建产物纳入）
- 接受 = `git add`（非 git 记 decision）；拒绝 = `git checkout --` / 恢复基线副本
- 提交 = `git commit -m`（仅已接受文件）；放弃 = 恢复所有未接受文件
- 同一工作区同时只允许一个进行中的评审
- git 操作经 `deps.git` 注入（测试用 fake git，无进程）

## 5. 安装与验证

```powershell
# 1. 无头测试
node pro-plugin\test\run-all.js   # 5 套件全过

# 2. 安装到 web profile
dsh plugin --profile web add link:D:\dsh\desktop-app\pro-plugin

# 3. 确认组合层
dsh --profile web --dump-config | Select-String dsh-pro

# 4. 重启 dsh web / 桌面端 → 侧边栏底部「Pro 面板」
```

冒烟：真实 `dsh --profile web` 启动 → `/api/pro/state` 返回 4 模板；评审 start/diff/reject 全通；客户端 bundle 注入浏览器启动配置。

## 6. 路线

- **v0.1.1**（当前）：模板 / 仪表盘 / 自动摘要 / 评审门禁
- **v0.2**：评审接 git 分支工作流（agent 在分支干活 → 合并前审阅）；仪表盘时间线（周报）；快照 diff 纳入评审
- **v1.0**：项目索引/时间线同步（多人共享）

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| 客户端插件 loader 格式 | 沿用已验证的 __ModuleLoader__ 手写格式（旧版已实测） |
| 摘要 LLM 路由缺失 | 优雅降级：返回错误不崩溃；无 request/header 时跳过 |
| 会话热回滚 | v0.1.1 不做会话回滚（评审只作用于文件区） |
| 沙箱/权限 | git 经 execFile 数组传参；diff 纯 JS（LCS）不依赖 git 也可用 |
| 敏感信息 | 全仓库无 token/密钥；token 仅经环境变量传给发布脚本 |