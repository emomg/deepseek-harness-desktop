# DeepSeek Harness Desktop

基于 **Tauri 2 + Rust** 构建的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 原生 Windows 桌面客户端（黑鲸鱼图标）。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 📌 **双版本并存，互不覆盖**：本仓库同时提供**正式版**与**专业版（测试版）**，Releases 页面两个版本都可在下载。
> - **正式版 v0.1.0** —— 本 README 介绍的主体，安装即用
> - **专业版 v0.1.0（测试版）** —— 正式版 + DSH 插件的**延伸**（见文末「延伸：专业版」）

## 📦 下载安装（Releases）

👉 **https://github.com/emomg/deepseek-harness-desktop/releases**

| 版本 | 安装包 | 说明 |
|---|---|---|
| **正式版 v0.1.0** `v0.1.0` | [Setup-0.1.0-full.exe](https://github.com/emomg/deepseek-harness-desktop/releases/tag/v0.1.0)（约 100MB）<br>[Setup-0.1.0.exe](https://github.com/emomg/deepseek-harness-desktop/releases/tag/v0.1.0)（约 4MB） | **两个安装包都提供**：full 版自带 Node/dsh 运行时免预装；精简版需本机 Node ≥ 18 |
| **专业版 v0.1.0（测试版）** `v0.1.0-pro-test` | [Setup-0.1.0-pro-test.exe](https://github.com/emomg/deepseek-harness-desktop/releases/tag/v0.1.0-pro-test)（约 4MB）<br>[插件包 zip](https://github.com/emomg/deepseek-harness-desktop/releases/tag/v0.1.0-pro-test) | 精简安装包（需 Node ≥ 18）；已有 DSH 环境可只装插件 zip |

> 小白完整安装指引见 [start.md](start.md)。

## 功能（正式版）

- 🪟 独立原生窗口（WebView2 内核），加载 DSH Web UI（`http://127.0.0.1:3080`）
- 🚀 自动启动：如果 dsh 服务没在运行，桌面端会自动拉起 `dsh web` 并等待就绪
- 🔄 复用已有服务：如果 3080 端口已有 dsh 实例，直接连接，不会重复启动
- 🧭 系统托盘：常驻托盘图标，点击/左键恢复窗口
- 🚫 关闭窗口 = 隐藏到托盘（不退出）；托盘菜单「退出」才真正退出
- 💬 未找到 dsh 时弹出中文提示，引导安装，不再无响应等待
- 🔄 桌面版更新检查：托盘菜单「检查更新」+ 启动后静默检查 GitHub Releases
- 📱 移动端远程控制：Web UI 内置扫码配对（自动 Cloudflare 隧道）
- ⚡ 快速冷启动：窗口先显示启动占位页，dsh 后台线程拉起

## 安装前提（正式版）

> 桌面端是 DSH 的"壳"，需要先安装 dsh 命令行工具（Node.js ≥ 18）：

```bash
npm install -g @deepseek-ai/dsh
```

应用启动时会自动查找并启动 dsh：优先使用 PATH 中的 `dsh`，否则回退到 npm 全局安装的 `@deepseek-ai/dsh`。

## 从源码构建

需要 [Rust](https://www.rust-lang.org/)（stable，MSVC 或 GNU 工具链均可）与 Windows 10/11（自带 WebView2）。

```powershell
cd src-tauri
cargo build --release
# 产物: src-tauri\target\release\dsh-desktop.exe
```

## 制作安装包（NSIS）

```powershell
# 1. 将构建产物复制到 installer\build\
New-Item -ItemType Directory -Force installer\build
Copy-Item src-tauri\target\release\dsh-desktop.exe installer\build\

# 2. 使用便携版 NSIS 3（https://nsis.sourceforge.io/Download）编译
#    正式版（两个安装包）：
makensis installer\installer.nsi                      # Setup-0.1.0.exe（精简）
makensis installer\installer.nsi /DRUNTIME_DIR=...    # Setup-0.1.0-full.exe（带运行时）
#    专业版（精简安装包）：
makensis installer\installer-pro.nsi                  # Setup-0.1.0-pro-test.exe
```

## 工程结构

```
.
├── dist\                    # 前端占位页（窗口实际加载 3080 的 Web UI）
├── src-tauri\
│   ├── src\main.rs          # 入口（release 模式无控制台窗口）
│   ├── src\lib.rs           # 核心逻辑：端口检测/拉起 dsh/窗口/托盘
│   ├── tauri.conf.json      # Tauri 配置
│   └── Cargo.toml
├── installer\               # NSIS 安装脚本（installer.nsi / installer-pro.nsi）
├── pro-plugin\              # 【专业版】DSH 插件包（见文末延伸章节）
└── PRO-DESIGN.md            # 【专业版】设计文档
```

## 隐私与数据

- 本应用完全**本地运行**，不收集、不上传任何数据，无任何遥测。
- 聊天记录、API Key、配置等数据全部保存在**用户本机**的 `~/.dsh` 目录（如 `sessions/`、`.credentials.yaml` 等），**绝不随仓库或安装包分发**。
- 本仓库不含任何用户数据、密钥或机器相关路径。
- 卸载程序只移除应用本体，**不会删除** `~/.dsh` 中的数据；如需清除数据请手动删除该目录。

## 常见问题

- **提示"未找到 dsh"**：执行 `npm install -g @deepseek-ai/dsh` 后重新启动应用。
- **3080 端口已被占用**：应用会直接复用已有 dsh 实例，不会重复启动。
- **关闭窗口后应用还在**：这是设计行为——窗口关闭即最小化到系统托盘，请从托盘菜单「退出」彻底退出。
- **安装后无法打开**：确认系统为 Windows 10/11 且已安装 WebView2 运行时（Win10/11 一般自带）。

---

# 延伸：专业版（测试版）

> 专业版 = 正式版桌面端 + **DSH 插件**（`@dsh-pro/desktop`）—— DeepSeek Harness 向 IDE 的延伸。
> 保持 DSH 原生观感与工作区/会话模型，不仿照 VS Code；桌面壳只做窗口容器。

## 获取（专业版）

- **安装包**：Releases `v0.1.0-pro-test` → `Setup-0.1.0-pro-test.exe`（精简版，需 Node ≥ 18）
- **纯插件**：`dsh-pro-desktop-v0.1.0-pro-test.zip`（给已有 DSH 环境的用户）
- 装好桌面端后，**再安装一次插件**即可获得专业版功能：

```powershell
# 把 <插件目录> 换成解压出的 pro-plugin 目录
dsh plugin --profile web add link:<插件目录>
dsh --profile web --dump-config | Select-String dsh-pro   # 应看到 - id: dsh-pro
# 重启 dsh web / 桌面端
```

## 功能（专业版）

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

## 安全（专业版）

- **敏感信息排查**：推代码前自动把 `.env`、`*.pem`、`*.key`、`*secret*`、`*.token`、`.npmrc` 等模式追加到项目 `.git/info/exclude`（仅本地生效，不入仓库）
- **Token**：只存本机 `config.json`；API 只回传 `hasToken`，不回传明文；推代码用一次性 URL 凭据，不写入仓库 `.git/config`
- **路径边界**：文件浏览/版本浏览均校验在源目录或版本目录内（大小写归一防穿越）

## 测试与文档（专业版）

```powershell
node pro-plugin\test\version.test.js   # VERSION TEST OK（23 项）
node pro-plugin\test\host.test.js      # HOST TEST OK（41 项）
```

- 架构与 API 契约：[PRO-DESIGN.md](PRO-DESIGN.md)
- 新手安装与使用：[start.md](start.md)（第一部分正式版 + 第二部分专业版）

## 许可

MIT License，Copyright (c) 2026 DeepSeek。本桌面客户端基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建。
