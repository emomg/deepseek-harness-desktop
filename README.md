# DeepSeek Harness Desktop(更新中，暂时不要下载安装包)


基于 **Tauri 2 + Rust** 构建的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 原生 Windows 桌面客户端（黑鲸鱼图标）。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 📌 **双版本并存，互不覆盖**：本仓库同时提供**正式版**与**专业版**，Releases 页面两个版本都可在下载。
> - **正式版 v1.0.0** —— 安装即用，内置**文件上传**与**图片识图**两个插件
> - **专业版 v1.0.0（测试版）** —— 正式版 + `@dsh-pro/core`（任务模板 / 仪表盘 / 自动摘要 / 评审门禁），见文末「延伸：专业版」

## 📦 下载安装（Releases）

👉 **https://github.com/emomg/deepseek-harness-desktop/releases**

| 版本 | 安装包 | 说明 |
|---|---|---|

| **正式版 v1.0.0** `v1.0.0` | [Setup-1.0.0-full.exe](https://github.com/emomg/deepseek-harness-desktop/releases/tag/v1.0.0)（约 100MB+）<br>[Setup-1.0.0.exe](https://github.com/emomg/deepseek-harness-desktop/releases/tag/v1.0.0)（约 4MB） | **两个安装包都内置插件**：full 版自带 Node/dsh 运行时 + 插件依赖（装完即用）；精简版需本机 Node ≥ 18，插件依赖首次启动提示安装 |
| **专业版 v1.0.0（测试版）** `v1.0.0-pro` | [Setup-1.0.0-pro.exe](https://github.com/emomg/deepseek-harness-desktop/releases/tag/v1.0.0-pro) | 精简安装包（需 Node ≥ 18），内置 pro-plugin + 两个通用插件 |


> 小白完整安装指引见 [start.md](start.md)。

## ✨ 内置插件（正式版 / 专业版通用）

安装包内置以下两个**通用插件**，桌面端**首次启动自动注册**进 DSH profile，无需手动 `dsh plugin add`：

| 插件 | 功能 |
|---|---|
| 📎 **dsh-files** | composer 回形针 + 拖拽上传 **PDF / Word / Excel / TXT**，`read_document` 工具让 agent 直接读文档（内容嗅探、分页读取、会话隔离存储） |
| 🖼️ **dsh-plugin-image-input** | 输入框**粘贴 / 拖拽图片**，纯文本模型自动桥接 OpenAI 兼容视觉 API 识图（`vision` 工具） |

- **full 版**：插件依赖（mammoth / pdfjs-dist / read-excel-file）随安装包分发，装完即用；
- **精简版**：插件源码随安装包分发，首次启动自动注册后，如需文档解析请到 `安装目录\plugins\dsh-files` 执行 `npm install`（图片识图零依赖，直接可用）；
- 视觉识图端点：设置环境变量 `IMAGE_VISION_BASE_URL` / `IMAGE_VISION_MODEL` / `IMAGE_VISION_API_KEY`（OpenAI 兼容，如 DashScope `qwen-vl-plus`、智谱 `glm-4v-flash`、Ollama `llava`），详见 [dsh-plugin-image-input/README.md](dsh-plugin-image-input/README.md)。

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

> 桌面端是 DSH 的"壳"，需要先安装 dsh 命令行工具（Node.js ≥ 18）——**full 版自带运行时则免安装**：

```bash
npm install -g @deepseek-ai/dsh
```

应用启动时会自动查找并启动 dsh：优先使用安装包自带的捆绑运行时（full 版），否则 PATH 中的 `dsh`，再回退到 npm 全局安装的 `@deepseek-ai/dsh`。

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

# 2. 暂存内置插件（正式版：dsh-files + dsh-plugin-image-input）
New-Item -ItemType Directory -Force installer\build\plugins
Copy-Item dsh-files installer\build\plugins\dsh-files -Recurse -Force
Copy-Item dsh-plugin-image-input installer\build\plugins\dsh-plugin-image-input -Recurse -Force
# full 版在打包前把插件的 node_modules 一并拷入（否则只带源码）

# 3. 使用便携版 NSIS 3（https://nsis.sourceforge.io/Download）编译
#    正式版（两个安装包）：
makensis installer\installer.nsi                      # Setup-1.0.0.exe（精简）
makensis installer\installer.nsi /DRUNTIME_DIR=...    # Setup-1.0.0-full.exe（带运行时）
#    专业版（精简安装包，内置三插件）：
makensis installer\installer-pro.nsi                  # Setup-1.0.0-pro.exe
```

## 工程结构

```
.
├── dist\                    # 前端占位页（窗口实际加载 3080 的 Web UI）
├── src-tauri\
│   ├── src\main.rs          # 入口（release 模式无控制台窗口）
│   ├── src\lib.rs           # 核心逻辑：端口检测/拉起 dsh/窗口/托盘/插件自动注册
│   ├── tauri.conf.json      # Tauri 配置
│   └── Cargo.toml
├── installer\               # NSIS 安装脚本（installer.nsi / installer-pro.nsi）
├── pro-plugin\              # 【专业版】DSH 插件包（见文末延伸章节）
├── dsh-files\               # 【通用插件】回形针上传 PDF/Word/Excel/TXT + read_document（内置）
├── dsh-plugin-image-input\  # 【通用插件】粘贴/拖拽图片 → 视觉模型识图（内置）
└── PRO-DESIGN.md            # 【专业版】设计文档
```

## 隐私与数据

- 本应用完全**本地运行**，不收集、不上传任何数据，无任何遥测。
- 聊天记录、API Key、配置等数据全部保存在**用户本机**的 `~/.dsh` 目录（如 `sessions/`、`.credentials.yaml` 等），**绝不随仓库或安装包分发**。
- 本仓库不含任何用户数据、密钥或机器相关路径。
- 卸载程序只移除应用本体，**不会删除** `~/.dsh` 中的数据；如需清除数据请手动删除该目录。

## 常见问题

- **提示"未找到 dsh"**：执行 `npm install -g @deepseek-ai/dsh` 后重新启动应用（full 版无需此步）。
- **3080 端口已被占用**：应用会直接复用已有 dsh 实例，不会重复启动。
- **关闭窗口后应用还在**：这是设计行为——窗口关闭即最小化到系统托盘，请从托盘菜单「退出」彻底退出。
- **安装后无法打开**：确认系统为 Windows 10/11 且已安装 WebView2 运行时（Win10/11 一般自带）。
- **内置插件没生效？** 插件由桌面端首次启动自动注册；若 3080 端口已有旧的 dsh 实例在跑，插件注册会在下次全新启动 dsh 时加载（重启桌面端即可）。
- **精简版文档上传报"解析库缺失"？** 到 `安装目录\plugins\dsh-files` 执行 `npm install` 后重启桌面端。

---

# 延伸：专业版（测试版）

> 专业版 = 正式版桌面端 + **DSH 插件**（`@dsh-pro/core` + 两个通用插件）—— DeepSeek Harness 向 IDE 的延伸。
> 保持 DSH 原生观感与工作区/会话模型，不仿照 VS Code；桌面壳只做窗口容器。

## 获取（专业版）

- **安装包**：Releases `v1.0.0-pro` → `Setup-1.0.0-pro.exe`（精简版，需 Node ≥ 18，内置三插件）
- 装好桌面端后，**首次启动自动注册**全部三个插件（`@dsh-pro/core` + `dsh-files` + `dsh-plugin-image-input`），无需手动 `dsh plugin add`。

> 从旧版升级：已装过 0.x 插件 zip 的用户可直接卸载重装 1.0 安装包；重复注册幂等，不会冲突。

## 功能（专业版 v1.0.0）

| 能力 | 说明 |
|---|---|
| 📋 **任务模板库** | 高频任务固化成模板（内置 4 个：修测试 / PR 描述 / 代码评审 / 跑一遍并总结），支持自定义变量与标签；composer 输入 `/tpl` 选择即发送 |
| 📊 **项目仪表盘** | 按工作区聚合：会话 × 目标（进行中/阻塞/完成）× todo × 轮次/步数 × 自动摘要，阻塞目标高亮；30s 自动刷新 |
| ✍️ **会话自动摘要** | 每轮任务收尾自动生成 3 行摘要（目标/完成/下一步）入库；无摘要的会话可一键生成 |
| ✅ **评审门禁** | 对工作区改动**逐文件审阅**：git 仓库以 HEAD 为基线，非 git 用复制基线；每文件查看 diff → 接受/拒绝 → 提交已接受（git commit）/ 放弃（全部恢复） |
| 📎 **文件上传**（通用） | 回形针 / 拖拽上传 PDF / Word / Excel / TXT，agent 用 `read_document` 直接读 |
| 🖼️ **图片识图**（通用） | 输入框粘贴 / 拖拽图片，视觉 API 识图 |

## 安全（专业版）

- **不收集、不上传任何数据**；摘要/模板/评审记录只存本机 Pro 数据目录（`DSH_PRO_DATA_DIR` 或 `%LOCALAPPDATA%\DeepSeek Harness Pro\data`）
- **不写 DSH 会话日志**（DSH 持久化拒绝未知事件类型）
- 评审的拒绝/放弃会真实改动工作区文件（git checkout / 恢复基线），提交才执行 git commit
- git 命令数组传参（无 shell 注入）

## 测试与文档（专业版）

```powershell
node pro-plugin\test\run-all.js   # ALL TESTS PASSED（5 个套件）
node dsh-files\test\run-all.js    # dsh-files 两套（core + parse，需 npm install 后）
node dsh-plugin-image-input\test\run-all.js  # image-input 一套
```

- 架构与 API 契约：[PRO-DESIGN.md](PRO-DESIGN.md)
- 新手安装与使用：[start.md](start.md)（第一部分正式版 + 第二部分专业版）

## 许可

MIT License，Copyright (c) 2026 DeepSeek。本桌面客户端基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建。
