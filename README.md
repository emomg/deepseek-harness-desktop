# DeepSeek Harness Pro（专业版）

基于 **Tauri 2 + Rust** 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 专业版 Windows 桌面端。

> **设计原则：不仿照 VS Code，是 DeepSeek Harness 向 IDE 的延伸。**
> 专业能力以 **DSH 插件**（`@dsh-pro/desktop`）形式长在 DSH 里；桌面壳只做窗口容器。

## 功能

- 🗂 **项目控制器**（DSH 侧边栏）：项目档案 = DSH 工作区（目录=文件区 + 会话=对话区），
  档案列表 → 版本时间线 → 打快照 / 回滚 / 删除 / 上传
- ⏱ **版本管理**：文件快照 + 会话对话快照（自动忽略 `.git`/`node_modules` 等），
  semver 版本号 + 说明，一键回滚（回滚前自动备份）
- 📤 **上传（询问式）**：点上传 → **先询问是否上传、上传什么**（仅文件区 / 仅对话区 / 两者）→ 打包；
  GitHub Releases 实传二期开放
- 🧭 **会话头部按钮**：当前会话直接「快照 / 版本 / 上传」，无需离开会话
- 🪟 **桌面壳**：主窗口加载 DSH Web UI；托盘常驻；自动拉起 dsh；桌面版自更新（`DSH_PRO_DISABLE_UPDATE=1` 可关）

## 快速开始（开发）

```powershell
# 1. 无头测试插件核心
node pro-plugin\test\version.test.js     # 18 项断言
node pro-plugin\test\host.test.js        # 12 项断言

# 2. 安装插件到 web profile（自动写入 dsh.profile.bundles）
dsh plugin --profile web add link:D:\dsh\desktop-app\pro-plugin

# 3. 确认组合层
dsh --profile web --dump-config | Select-String dsh-pro
#   应看到：- id: dsh-pro  name: '@dsh-pro/desktop'

# 4. 重启 dsh web / 重启桌面端 → DSH 侧边栏出现「项目控制器」，会话头部出现按钮

# 5. 构建桌面壳
cd src-tauri && cargo build --release
```

## 结构

```
desktop-app/
├── pro-plugin/               # @dsh-pro/desktop 插件包
│   ├── lib/index.js          #   宿主插件：档案/版本服务 + /api/pro/* 路由
│   ├── lib/version.js        #   版本核心（快照/回滚/删除，无头测试覆盖）
│   ├── lib/client.js         #   客户端插件：控制器面板 + 会话头部按钮（DSH Slot 注入）
│   ├── cordis.patch.yml      #   插件行
│   ├── package.json
│   └── test/                 #   version.test.js / host.test.js
├── src-tauri/src/lib.rs      # 桌面壳：窗口 + 托盘 + dsh 生命周期 + 更新检查
├── dist/index.html           # 启动占位页
└── PRO-DESIGN.md             # 设计文档 v3
```

## 数据

- 版本快照：`%LOCALAPPDATA%\DeepSeek Harness Pro\data\versions\<key>\vX.Y.Z-<seq>\`
- 环境变量 `DSH_PRO_DATA_DIR` 可覆盖数据目录（便携/测试）
- 完全本地运行；卸载/删除桌面端不影响 `~/.dsh` 会话数据

## 许可

MIT License，基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建。
