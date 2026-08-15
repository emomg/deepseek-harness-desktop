# DeepSeek Harness Desktop

基于 **Tauri 2 + Rust** 构建的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 原生 Windows 桌面客户端（黑鲸鱼图标）。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 功能

- 🪟 独立原生窗口（WebView2 内核），加载 DSH Web UI（`http://127.0.0.1:3080`）
- 🚀 自动启动：如果 dsh 服务没在运行，桌面端会自动拉起 `dsh web` 并等待就绪
- 🔄 复用已有服务：如果 3080 端口已有 dsh 实例，直接连接，不会重复启动
- 🧭 系统托盘：常驻托盘图标，点击/左键恢复窗口
- 🚫 关闭窗口 = 隐藏到托盘（不退出）；托盘菜单「退出」才真正退出
- 💬 未找到 dsh 时弹出中文提示，引导安装，不再无响应等待

## 安装

从 [Releases](releases) 页面下载 `DeepSeek-Harness-Desktop-Setup-<版本>.exe`，双击安装即可。

> **前提**：桌面端是 DSH 的"壳"，需要先安装 dsh 命令行工具（Node.js ≥ 18）：

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
makensis installer\installer.nsi
# 产物: installer\DeepSeek-Harness-Desktop-Setup-<版本>.exe
```

安装包为**每用户安装**（`%LOCALAPPDATA%\Programs\DeepSeek Harness`），无需管理员权限，包含开始菜单/桌面快捷方式与卸载程序。

## 工程结构

```
.
├── dist\                    # 前端占位页（窗口实际加载 3080 的 Web UI）
├── src-tauri\
│   ├── src\main.rs          # 入口（release 模式无控制台窗口）
│   ├── src\lib.rs           # 核心逻辑：端口检测/拉起 dsh/窗口/托盘
│   ├── tauri.conf.json      # Tauri 配置
│   ├── icons\               # 应用图标（可用 tools\generate-icons.mjs 重新生成）
│   └── Cargo.toml / Cargo.lock
├── installer\installer.nsi  # NSIS 安装脚本
├── tools\generate-icons.mjs # 无依赖图标生成脚本
└── .github\workflows\       # CI：构建 + 打包 + 发布 Release
```

## 隐私说明

- 本应用完全**本地运行**，不收集、不上传任何数据。
- 聊天记录、API Key、配置等全部保存在用户本机 `~/.dsh` 目录（`sessions/`、`.credentials.yaml` 等），**不随仓库或安装包分发**。
- 本仓库不含任何用户数据、密钥或机器相关路径。

## 许可

MIT License，Copyright (c) 2026 DeepSeek。本桌面客户端基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建，完整许可见 [LICENSE](LICENSE)。
