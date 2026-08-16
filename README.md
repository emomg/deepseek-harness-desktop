# DeepSeek Harness Pro（专业版）

**DeepSeek Harness 向 IDE 的延伸** —— 以 DSH 插件（`@dsh-pro/desktop`）形式实现的版本管理专业版。
不仿照 VS Code，保持 DSH 原生观感与工作区/会话模型，桌面壳只做窗口容器。

> 📌 **版本说明**：本分支（`pro-v0.1`）是**专业版测试版**，与正式版（`main` 分支 / v0.1.0）**并存互不覆盖**。
> Releases 页面同时提供两个版本的下载：
> - `v0.1.0` — 正式版桌面客户端（原版，未改动）
> - `v0.1.0-pro-test` — 专业版 v0.1（测试版，本分支）

## 功能

| 能力 | 说明 |
|---|---|
| 🧭 **子版本控制器** | 每个会话 = 一个功能框，会话头部「版本 / 文件区」；**每完成一轮任务自动快照**（AI 生成内容一并纳入） |
| 🎛 **总版本控制器** | 侧边栏左下角入口，**管理各子控制器的最终版**：查看版本文件 / 上传 / 推代码 / 回滚 / 删除 |
| 📂 **右侧总文件区** | **拉取的 git 仓库 + 本地文件夹**（与工作区解耦）：文件树浏览、点击查看源码、git 分支徽标、拉取更新 |
| 📤 **真 GitHub 上传** | 打包（文件区/对话区可选）→ 创建 Release（**测试版 prerelease**）→ 上传 zip 资产 |
| 🔄 **推代码** | 一键 git commit + push 到配置的仓库；**默认排查敏感信息**（`.env`/密钥/凭证等，仅本地排除，不入仓库） |
| 👀 **版本文件查看** | 任意版本快照内的文件可树状浏览、查看源码 |
| ⚙️ **GitHub 设置** | 面板内配置 `owner/repo` + Token（仅存本机，接口不回传明文） |
| 🗂 **构建目录纳入** | `dist/build/out` 等构建输出是开发产出，**纳入**快照与文件区；只排除工具链/缓存 |

## 架构

```
DSH Web UI（3080）
├─ @dsh-pro/desktop · 宿主插件（dsh 进程内，Node）
│    ├─ 版本管理：快照（文件区+对话区）/回滚/删除/最终版（version.js，无头测试 23 项）
│    ├─ 自动快照：监听 agent/turn-stopping（任务完成）
│    ├─ 源管理：git clone/拉取 + 本地文件夹（sources.json）
│    ├─ GitHub：配置 / 真上传（prerelease）/ 推代码（敏感排除）/ 版本浏览（/api/pro/*）
│    └─ 数据目录：%LOCALAPPDATA%\DeepSeek Harness Pro\data（DSH_PRO_DATA_DIR 可覆盖）
└─ @dsh-pro/desktop · 客户端插件（__ModuleLoader__ 格式，React，无构建）
     ├─ sidebar.footer.action  总版本控制器（最终版总览）
     ├─ conversation.session.header.actions  会话头部：版本 / 文件区
     └─ shell.overlay  右侧文件区面板 + 版本文件查看面板（DSH 主题 token，原生观感）
```

## 快速开始

```powershell
# 1. 安装插件到 web profile（自动写入 dsh.profile.bundles）
dsh plugin --profile web add link:D:\dsh\desktop-app\pro-plugin

# 2. 确认组合层
dsh --profile web --dump-config | Select-String dsh-pro
#    应看到：- id: dsh-pro  name: '@dsh-pro/desktop'

# 3. 重启 dsh web / 重启桌面端 → DSH 侧边栏底部出现「总版本控制器」，会话头部出现「版本/文件区」

# 4. 无头测试（可选）
node pro-plugin\test\version.test.js   # 23 项
node pro-plugin\test\host.test.js      # 41 项
```

> 桌面壳（`src-tauri`）编译：`cd src-tauri && cargo build --release`；壳仅负责窗口/托盘/dsh 生命周期/更新检查。

## 使用指南

### 1. 建立档案
在 DSH 侧边栏「工作区」新建工作区（选择一个项目目录）→ 该目录自动成为**项目档案**，其下的会话自动成为**子版本控制器**（功能框）。

### 2. 自动快照
每个会话**完成一轮任务**（agent 回合结束）自动打一次快照：文件区（目录，含构建输出）+ 对话区（该会话对话）+ AI 生成内容。版本标记「自动」。

### 3. 总版本控制器（左下角）
- **最终版总览**：每个子控制器的最终版（未标记时显示最新版），可 **查看 / 上传 / 推代码 / 回滚 / 删除**
- 展开工作区：功能框列表 + 完整版本历史；版本行可「设最终」「回滚」「删除」
- 底部 **GitHub 设置**：填 `owner/repo` + Token → 保存

### 4. 上传 / 推代码
- **上传**：选最终版 → 确认 → 选内容（文件区/对话区/两者）→ 创建 Release（`vX.Y.Z`，测试版）并上传 zip
- **推代码**：预览将提交的文件（**敏感信息已自动排除**）→ 填提交说明 → git commit + push 到配置的仓库

### 5. 右侧文件区（会话头部「文件区」）
- 「＋ 添加」用下拉列表选类型：**git 仓库（自动 clone 到本地，可拉取更新）** 或 **本地文件夹**
- 点源名浏览文件树，点文件查看源码；git 源显示分支徽标 + 改动数

### 6. 版本文件查看
总控制器最终版行点「查看」→ 浏览该版本快照内的文件与源码（安全限定在版本目录内）。

## 安全

- **敏感信息排查**：推代码前自动把以下模式追加到项目 `.git/info/exclude`（仅本地生效，不入仓库）：
  `.env` `.env.*` `*.pem` `*.key` `*.p12` `*.pfx` `*.p8` `id_rsa*` `id_ed25519*` `.credentials.yaml` `credentials.*` `*credentials*` `*secret*` `*secrets*` `*.token` `.npmrc` `.pypirc` `.netrc` `*.local.json` `config.local.*` `application-local.*` `.keystore`
- **Token**：只存本机 `config.json`；API 只回传 `hasToken`，不回传明文；推代码用一次性 URL 凭据，不写入仓库 `.git/config`
- **路径边界**：文件浏览/版本浏览均校验在源目录或版本目录内（大小写归一防穿越）
- **git**：命令数组传参（无 shell 注入）；clone URL 仅允许 http(s)/git@

## 测试

```
node pro-plugin\test\version.test.js   → VERSION TEST OK（23 项）
node pro-plugin\test\host.test.js      → HOST TEST OK（41 项）
```

覆盖：快照/回滚/删除/最终版、AI 产物纳入、自动快照触发与归属、上传拦截与配置、vtree/vfile 穿越拒绝、源管理、git 优雅降级。

## 发布记录

- **v0.1.0-pro-test**（测试版）：DSH 插件化专业版首版 —— 子/总版本控制器、自动快照、文件区（git/本地）、真 GitHub 上传（prerelease）、推代码（敏感排查）、版本文件查看、GitHub 设置

## 许可

MIT License，基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建。
