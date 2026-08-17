# @dsh-pro/core · DeepSeek Harness Pro v2

> 替换旧专业版（@dsh-pro/desktop 的版本快照方案）的全新 Pro 插件。
> 四大能力：**任务模板库 / 项目仪表盘 / 会话自动摘要 / 评审任务**。

## 四大能力

| 能力 | 说明 | 入口 |
|---|---|---|
| 📋 **任务模板库** | 高频任务固化成模板（内置 4 个：修测试 / PR 描述 / 代码评审 / 跑一遍并总结），支持自定义变量（{{key}}）与标签 | composer 输入 /tpl 选择即发送；Pro 面板「模板」页管理 |
| 📊 **项目仪表盘** | 按工作区聚合：会话 × 目标（进行中/阻塞/完成）× todo × 轮次/步数 × 自动摘要，阻塞目标高亮 | 侧边栏底部「Pro 面板」→「仪表盘」（30s 自动刷新） |
| ✍️ **会话自动摘要** | 每轮任务收尾自动生成 3 行摘要（目标/完成/下一步）入库；无摘要的会话可一键「生成摘要」 | 仪表盘每个会话行 + 面板按钮 |
| ✅ **评审任务** | 对会话发起评审：AI 按预置命令清单**跑测试 + 安全检查**并出报告；过程在会话可见，可随时**终止**（中断 AI）/ **结束**（手动收尾） | Pro 面板「评审」页 |

## 安装

```powershell
# 1. 安装插件（自动追加 bundle + 链接到 profile）
dsh plugin --profile web add link:D:\dsh\pro-plugin

# 2. 确认组合层包含 dsh-pro
dsh --profile web --dump-config | Select-String dsh-pro

# 3. 重启 dsh web（插件只在启动时加载）
#    桌面端：托盘 → 退出 → 重新打开
```

> 需要 pnpm（npm install -g pnpm 或 corepack enable）。插件**零运行时依赖**（只用 Node 内置模块），不会拉取额外的 @deepseek-ai 包。

## 数据与安全

- 数据目录：DSH_PRO_DATA_DIR 或 %LOCALAPPDATA%\DeepSeek Harness Pro\data
  - templates.json 模板库 · summaries.json 会话摘要 · reviews.json 评审记录 + reviews/<id>/baseline/ 非 git 基线副本
- **不写 DSH 会话日志**（DSH 持久化拒绝未知事件类型，摘要/评审只存 Pro 数据目录）
- 评审的拒绝/放弃会**真实改动工作区文件**（git checkout / 恢复基线副本），提交才会 git commit
- 不收集、不上传任何数据；token 等凭据不经手

## 架构

```
dsh web（3080，dsh 进程）
├── @dsh-pro/core · 宿主插件（lib/index.js）
│   ├── 复用 ctx：workspaceRegistry / webServer / sessions / sessionPersistence
│   │            / sessionProjections（goal·todos·sessionStats 投影）/ llm（摘要）
│   ├── 路由 /api/pro/*（同源 3080）：
│   │   templates / template(fill·delete) / summaries(generate) / dashboard
│   │   review(start·list·terminate·end)
│   └── 订阅 agent/turn-stopping → 自动摘要（节流 + 有新活动才生成）
└── @dsh-pro/core · 客户端插件（lib/client.js，手写 loader 格式，无构建）
    ├── 侧边栏底部「Pro 面板」（sidebar.footer.action）+ 覆盖层（shell.overlay）
    ├── /tpl 命令（commandUi popupSelect → 填变量 → 发送到当前会话）
    └── 同源 fetch /api/pro/*，无跨域/无桥接
```

模块（lib/，纯函数 + 可注入依赖，全部可无头测试）：

| 文件 | 职责 |
|---|---|
| index.js | 插件入口：路由注册 + 事件订阅 + 装配 |
| store.js | 数据目录 JSON 存储（原子写，损坏容错） |
| templates.js | 模板 CRUD + 变量填充 + 内置种子 |
| summarize.js | 会话摘要（LLM 辅助调用：route 取自 request/header，极简 StreamChunk 组装器，零依赖） |
| dashboard.js | 仪表盘聚合（live 会话用投影，关闭会话读磁盘日志降级） |
| review.js | 评审任务（模板 prompt → 会话 AI；状态机 running/done/terminated/ended；agents/sessions 可注入） |
| git.js | git 封装（execFile）+ 纯 JS 行 diff（LCS，不 spawn） |
| client.js | 客户端 UI（React，主题 token 原生观感） |

## 测试

```powershell
node test/run-all.js   # 5 个套件：dashboard / host / review / summarize / templates
```

- host.test.js：mock ctx 跑真实 apply()，16 条路由注册 + CRUD 往返 + 事件订阅
- review.test.js：任务式评审（fake agents/sessions 注入）全流程：开始/状态刷新/终止/结束 + 旧版记录迁移
- summarize.test.js：路由解析 / 消息抽取 / LLM 调用 / 自动摘要节流
- 冒烟：真实 dsh --profile web 启动后 /api/pro/state 返回 4 模板，评审 start/diff/reject 全通

## 已知限制（v0.2）

- 同一会话同时只允许一个进行中的评审
- 评审跑在**活动的会话**里（会话需打开、agent 可投递）；评审报告取会话最后一条 assistant 消息
- 评审 prompt 来自模板（默认内置「评审：测试+安全」，可自定义变量/命令）；旧版逐文件门禁的遗留记录会自动迁移为「已结束」
- 摘要依赖会话有已记录的 request/header 路由；无 LLM 配置时优雅报错
- 已关闭会话的仪表盘行只有基础信息（标题/轮次/摘要），完整统计需要 live 会话