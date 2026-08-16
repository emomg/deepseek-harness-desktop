# DeepSeek Harness Pro（专业版）

**DeepSeek Harness 向 IDE 的延伸** —— 以 DSH 插件（`@dsh-pro/core`）形式实现的**任务模板库 / 项目仪表盘 / 会话自动摘要 / 评审门禁**专业版。
不仿照 VS Code，保持 DSH 原生观感与工作区/会话模型，桌面壳只做窗口容器。

> 📌 **双版本并存，互不覆盖**：
>
> | 分支 / Release | 定位 | 文档 |
> |---|---|---|
> | `main` / **v0.1.0** | **正式版**桌面客户端（原版，安装即用） | 小白请看 [start.md](https://github.com/emomg/deepseek-harness-desktop/blob/main/start.md) |
> | `pro-v0.1` / **v0.1.1-pro** | **专业版**（本分支，正式版 + DSH 插件） | 本 README + [start.md](start.md) 第二部分 |
>
> - 正式版：双击安装 exe 即用，**不需要**装插件。
> - 专业版：在正式版基础上多一个插件（`@dsh-pro/core`），提供任务模板 / 项目仪表盘 / 自动摘要 / 评审门禁。
> - 两者 Releases 页面同时提供下载，互不影响。

## 功能

| 能力 | 说明 |
|---|---|
| 📋 **任务模板库** | 高频任务固化成模板（内置 4 个：修测试 / PR 描述 / 代码评审 / 跑一遍并总结），支持自定义变量（`{{key}}`）与标签；composer 输入 `/tpl` 选择即发送 |
| 📊 **项目仪表盘** | 按工作区聚合：会话 × 目标（进行中/阻塞/完成）× todo × 轮次/步数 × 自动摘要，阻塞目标高亮；30s 自动刷新 |
| ✍️ **会话自动摘要** | 每轮任务收尾自动生成 3 行摘要（目标/完成/下一步）入库；无摘要的会话可一键生成 |
| ✅ **评审门禁** | 对工作区改动**逐文件审阅**：git 仓库以 HEAD 为基线，非 git 用复制基线；每文件查看 diff → 接受/拒绝 → 提交已接受（git commit）/ 放弃（全部恢复） |

## 架构

```
DSH Web UI（3080）
├─ @dsh-pro/core · 宿主插件（dsh 进程内，Node，零运行时依赖）
│    ├─ 复用 ctx：workspaceRegistry / webServer / sessions / sessionPersistence
│    │            / sessionProjections（goal·todos·sessionStats 投影）/ llm
│    ├─ 路由 /api/pro/*：templates / summaries / dashboard / review 全套
│    ├─ 自动摘要：监听 agent/turn-stopping（有新活动 + 节流才生成）
│    └─ 数据目录：%LOCALAPPDATA%\DeepSeek Harness Pro\data（DSH_PRO_DATA_DIR 可覆盖）
└─ @dsh-pro/core · 客户端插件（__ModuleLoader__ 格式，React，无构建）
     ├─ sidebar.footer.action  Pro 面板（仪表盘 / 模板 / 评审 三个页签）
     └─ /tpl 命令（commandUi popupSelect → 填变量 → 发送到当前会话）
```

## 快速开始

```powershell
# 1. 安装插件到 web profile（自动写入 dsh.profile.bundles）
dsh plugin --profile web add link:D:\dsh\desktop-app\pro-plugin

# 2. 确认组合层
dsh --profile web --dump-config | Select-String dsh-pro
#    应看到：- id: dsh-pro  name: '@dsh-pro/core'

# 3. 重启 dsh web / 重启桌面端 → DSH 侧边栏底部出现「Pro 面板」

# 4. 无头测试（可选）
node pro-plugin\test\run-all.js   # 5 个套件全过
```

> 桌面壳（`src-tauri`）编译：`cd src-tauri && cargo build --release`；壳仅负责窗口/托盘/dsh 生命周期/更新检查。

## 使用指南

### 1. Pro 面板（侧边栏底部）
重启后 DSH 侧边栏底部出现「Pro 面板」按钮，点开有 3 个页签：**仪表盘 / 模板 / 评审**。

### 2. 项目仪表盘
在 DSH「工作区」新建工作区（选择一个项目目录）并跑任务后，仪表盘自动聚合每个工作区：
- 每个会话一行：目标状态（进行中/阻塞/完成，**阻塞原因直接标红**）、轮次/步数、todo 进度、3 行自动摘要
- 无摘要的会话点「生成摘要」即时生成（需会话有 LLM 路由记录）
- 每 30 秒自动刷新，也可手动刷新

### 3. 任务模板库
- **用模板**：composer 输入 `/tpl` → 弹出模板列表 → 选择 → 按提示填变量 → **自动发送到当前会话**
- **管模板**：Pro 面板「模板」页 → 新建/编辑/删除；模板内容用 `{{变量名}}` 占位，变量支持 `key:标签[:默认值]` 每行一个
- 内置模板：修这个测试 / 写 PR 描述 / 代码评审 / 跑一遍并总结

### 4. 会话自动摘要
每轮任务完成（`agent/turn-stopping`）自动生成 3 行摘要：目标 / 完成（含关键产出）/ 下一步。摘要只存 Pro 数据目录，**不写入 DSH 会话日志**。

### 5. 评审门禁
Pro 面板「评审」页：
1. 选工作区 → 「开始评审」：git 仓库以 HEAD 为基线，非 git 目录复制基线（排除 node_modules/缓存等）
2. 逐文件查看差异（点击文件行加载 diff）→ **接受**（git add / 保留）或 **拒绝**（git checkout / 恢复基线）
3. 「提交已接受」= git commit（仅已接受文件）；「放弃评审」= 恢复所有未接受文件
4. 同一工作区同时只允许一个进行中的评审

## 安全

- **不收集、不上传任何数据**；摘要/模板/评审记录只存本机 Pro 数据目录
- **不写 DSH 会话日志**（DSH 持久化拒绝未知事件类型）
- 评审的拒绝/放弃会真实改动工作区文件（git checkout / 恢复基线），提交才执行 git commit
- 评审基线排除：`.git` `node_modules` `target` `.venv` `__pycache__` `.idea` `.vscode` 及 `*.log/*.tmp/*.cache`（构建产物 `dist/build/out` 纳入）
- git 命令数组传参（无 shell 注入）

## 测试

```
node pro-plugin\test\run-all.js   → ALL TESTS PASSED（5 个套件）
```

覆盖：模板 CRUD/变量填充/种子、摘要路由解析/LLM 调用/节流、仪表盘聚合（含关闭会话降级）、评审门禁（git 基线 + 复制基线全流程）、宿主路由 16 条注册与 CRUD 往返。
另有真实 `dsh --profile web` 冒烟：/api/pro/state 返回 4 模板，评审 start/diff/reject 全通，客户端 bundle 注入浏览器启动配置。

## 发布记录

- **v0.1.1-pro**（测试版）：全新 Pro —— 任务模板库 / 项目仪表盘 / 会话自动摘要 / 评审门禁（替换旧版快照式版本管理）
- **v0.1.0-pro-test**（测试版）：旧版 DSH 插件化专业版（快照版本管理，已由 v0.1.1 替代）

## 许可

MIT License，基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建。