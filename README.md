# DeepSeek Harness Desktop

基于 **Tauri 2 + Rust** 构建的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 原生 Windows 桌面客户端。

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg) ![CI](https://github.com/emomg/deepseek-harness-desktop/actions/workflows/build.yml/badge.svg)

## 功能

- 🪟 独立原生窗口（WebView2 内核），加载 DSH Web UI（`http://127.0.0.1:3080`）
- 🚀 自动启动：dsh 服务未运行时，桌面端自动拉起 `dsh web` 并等待就绪
- 🔄 复用已有服务：3080 端口已有 dsh 实例时直接连接，不会重复启动
- 🧭 系统托盘：常驻托盘图标，左键点击恢复窗口
- 🚫 关闭窗口 = 隐藏到托盘（不退出）；托盘菜单「退出」才真正退出
- 💬 未找到 dsh 时弹出提示并引导安装，不再无响应等待

## 安装

> 👶 **新手请看**：[一步一步安装指南（start.md）](start.md)

从 [Releases](https://github.com/emomg/deepseek-harness-desktop/releases) 页面下载安装包，双击安装即可（每用户安装，无需管理员权限）：

| 安装包 | 大小 | 适用人群 |
|---|---|---|
| `DeepSeek-Harness-Desktop-Setup-0.1.0-full.exe` | ~100MB | **小白/普通用户（推荐）**：自带 Node.js 与 dsh 运行时，无需任何预装 |
| `DeepSeek-Harness-Desktop-Setup-0.1.0.exe` | ~2MB | 开发者：需自装 Node.js ≥ 18 与 `npm install -g @deepseek-ai/dsh` |

- 操作系统：Windows 10/11（自带 WebView2，无需额外运行时）
- 应用启动时自动查找并启动 dsh：优先使用安装包自带的捆绑运行时，其次 PATH 中的 `dsh`，最后回退到 npm 全局安装的 `@deepseek-ai/dsh`。

## 从源码构建

需要 [Rust](https://www.rust-lang.org/)（stable，MSVC 或 GNU 工具链均可）与 Windows 10/11。

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

安装包为**每用户安装**（`%LOCALAPPDATA%\Programs\DeepSeek Harness`），包含开始菜单/桌面快捷方式与卸载程序。

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

## 许可

MIT License，Copyright (c) 2026 DeepSeek。本桌面客户端基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建，完整许可见 [LICENSE](LICENSE)。