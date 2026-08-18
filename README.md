# DeepSeek Harness Desktop

Native Windows desktop client for [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
plus a monorepo of DSH cordis plugins and 6 original minimal editorial skins.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> pnpm monorepo · Tauri 2 + Rust · 3 DSH plugins · 6 极简 editorial 原创皮肤

## 仓库布局

```text
apps/desktop/                    原生 Windows 桌面端（Tauri 2 + Rust）
plugins/
  dsh-pro/                      @dsh-pro/core  任务模板/仪表盘/自动摘要/评审门禁
  dsh-files/                    composer 回形针 + 拖拽 PDF/Word/Excel/TXT 上传
  dsh-plugin-image-input/       composer 粘贴/拖拽图片 + 视觉 API 识图
skins/                          6 款极简 editorial 原创皮肤
  bone-white/  graphite/  paper/  mist/  lilac/  mint/
  skin-center/                 皮肤中心 GUI 卡（列表/试穿/应用/还原）
dsh-skins/                      6 款皮肤的 npm 聚合包
shared/                         共享层：skin schema / CSS token / 注册表 API
scripts/                        脚手架 / 聚合 / 校验 / 发布脚本
docs/                           长期文档（开发流程 / 皮肤设计指南 / i18n 规范）
gallery/                        皮肤画廊静态站（CI 校验与本地预览）
installer/                      NSIS 安装脚本
```

## 内置插件（v1 兼容）

| 插件                            | 功能                                                       |
| ------------------------------- | ---------------------------------------------------------- |
| `@dsh-pro/core`                 | 任务模板 / 仪表盘 / 自动摘要 / 评审门禁                    |
| `dsh-files`                     | composer 回形针 + 拖拽上传 PDF/Word/Excel/TXT              |
| `dsh-plugin-image-input`        | composer 粘贴/拖拽图片 + 视觉 API 识图                     |
| `@dsh-desktop/skin-center`      | 皮肤中心 GUI 卡（v2 新增，替代原 pro-plugin 内置皮肤中心） |
| `@dsh-desktop/skin-<id>` × 6    | 6 款极简 editorial 原创皮肤（v2 新增）                     |

## 6 款极简 editorial 原创皮肤（v2 全新）

| id            | name (zh) | name (en)  | accent  | mood                          |
| ------------- | --------- | ---------- | ------- | ----------------------------- |
| `bone-white`  | 骨白      | Bone White | #1a1a1a | cool white + ink              |
| `graphite`    | 石墨      | Graphite   | #0e0e0e | cool gray scale + ink         |
| `paper`       | 宣纸      | Paper      | #b8434a | warm cream + vermilion        |
| `mist`        | 雾        | Mist       | #0c1014 | cool blue-gray + ink          |
| `lilac`       | 丁香      | Lilac      | #7a6592 | cool white + low-sat lilac    |
| `mint`        | 薄荷      | Mint       | #5e9275 | cream + low-sat mint          |

全部 light 模式，每款是 18 个 CSS token 的完整覆写。设计规则见
[`docs/skin-design-guide.md`](docs/skin-design-guide.md)。

**与 v1 的差异**：v1 在 `pro-plugin` 内部硬编码了 11 款「黑鲸 / 深空 / 液态玻璃 /
极光 / 赛博 / 极夜 / 墨玉 / 晨曦 / 薄荷 / 樱花 / 纯白」。v2 全部移除，改用 dsh-web-ui
风格的 monorepo 皮肤系统：每款皮肤独立包 + 共享注册表 + 皮肤中心 GUI 卡 + 聚合包。

## 下载安装

👉 **https://github.com/emomg/deepseek-harness-desktop/releases**

| 版本       | 安装包                              | 说明                                                 |
| ---------- | ----------------------------------- | ---------------------------------------------------- |
| v1.x       | `Setup-1.0.0.exe` / `-full.exe`     | 旧版（11 款硬编码皮肤 + 桌面端）                     |
| v2.0.0 起  | `Setup-2.0.0.exe` / `-full.exe`     | 新版（6 款原创皮肤 + monorepo 插件系统）              |

## 安装前提

桌面端是 DSH 的"壳"，需要先安装 dsh 命令行工具（Node.js ≥ 18）——**full 版自带运行时则免安装**：

```bash
npm install -g @deepseek-ai/dsh
```

应用启动时会自动查找并启动 dsh：优先使用安装包自带的捆绑运行时（full 版），
否则 PATH 中的 `dsh`，再回退到 npm 全局安装的 `@deepseek-ai/dsh`。

## 从源码构建

### JS / monorepo 部分（不需要 Rust）

```powershell
pnpm install              # 装依赖
pnpm test                 # 跑全仓测试
pnpm typecheck            # 语法检查
pnpm skin-center:check    # 6 款皮肤 schema 校验
pnpm aggregate:check      # dsh-skins 聚合包一致性
pnpm gallery:check        # 画廊一致性
pnpm docs:check           # 双语文档一致性
```

### Rust 桌面端（需要 Rust + Windows）

```powershell
cd apps/desktop/src-tauri
cargo build --release
# 产物: apps/desktop/src-tauri/target/release/dsh-desktop.exe
```

### NSIS 打包

前置：Rust 工具链（stable MSVC 或 GNU）+ NSIS 3（`makensis` 在 PATH）+ full 版
还要本地 Node.js 运行时。

```powershell
# 一键打 3 个变体（精简 / full / pro）
.\scripts\build-installer.ps1 -RuntimeDir D:\node-v20

# 只打某一个
.\scripts\build-installer.ps1 -Variant lite
.\scripts\build-installer.ps1 -Variant pro

# 已有 dsh-desktop.exe 时跳过 cargo
.\scripts\build-installer.ps1 -Variant lite -SkipCargo

# 清理 installer/build/ 后再打
.\scripts\build-installer.ps1 -Clean
```

### Portable 打包（无 NSIS 时的 fallback）

如果机子上装不了 NSIS（内网 / 镜像不全），可以出 portable zip：

```powershell
.\scripts\build-portable.ps1               # 默认重跑 cargo + 出 zip
.\scripts\build-portable.ps1 -SkipCargo    # 用已有 dsh-desktop.exe
```

产物：`dist\DeepSeek-Harness-Desktop-2.0.0-monorepo-portable.zip`（约 2-3 MB）
含 dsh-desktop.exe + WebView2Loader.dll + 3 个插件 + start.md。
解压到任意目录双击 dsh-desktop.exe 启动；要求 PATH 有 dsh 命令。

手工打（不推荐，build-portable.ps1 已经包含全部步骤）：

```powershell
# 1. 准备 build/
New-Item -ItemType Directory -Force installer\build
Copy-Item apps\desktop\src-tauri\target\release\dsh-desktop.exe installer\build\
Copy-Item plugins\dsh-pro installer\build\plugins\dsh-pro -Recurse -Force
Copy-Item plugins\dsh-files installer\build\plugins\dsh-files -Recurse -Force
Copy-Item plugins\dsh-plugin-image-input installer\build\plugins\dsh-plugin-image-input -Recurse -Force

# 2. NSIS 编译（任选）
makensis installer\installer.nsi                      # 正式精简版
makensis installer\installer.nsi /DRUNTIME_DIR=...    # 正式 full 版
makensis installer\installer-pro.nsi                  # 专业版
```

## 开发指南

- 新增一款皮肤：`pnpm skin:new <id> --name ... --nameEn ...` → 改 `skin.json` 的 `vars`
- 新增一个插件：`pnpm plugin:new <id>` → 改 `lib/{index,client}.js`
- 看开发循环、调试技巧、发布流程：[`docs/development.md`](docs/development.md)
- 看皮肤设计规则（取色 / 对比度 / 反例）：[`docs/skin-design-guide.md`](docs/skin-design-guide.md)
- 看 i18n 规范：[`docs/i18n.md`](docs/i18n.md)
- 看发布流程：[`docs/publish-prep.md`](docs/publish-prep.md)

## 隐私与数据

- 本应用完全**本地运行**，不收集、不上传任何数据，无任何遥测
- 聊天记录、API Key、配置等数据全部保存在**用户本机**的 `~/.dsh` 目录
- 本仓库不含任何用户数据、密钥或机器相关路径
- 卸载程序只移除应用本体，**不会删除** `~/.dsh` 中的数据；如需清除数据请手动删除该目录

## 常见问题

- **提示"未找到 dsh"**：执行 `npm install -g @deepseek-ai/dsh` 后重新启动应用（full 版无需此步）
- **3080 端口已被占用**：应用会直接复用已有 dsh 实例，不会重复启动
- **关闭窗口后应用还在**：这是设计行为——窗口关闭即最小化到系统托盘，请从托盘菜单「退出」彻底退出
- **安装后无法打开**：确认系统为 Windows 10/11 且已安装 WebView2 运行时
- **内置插件没生效？** 插件由桌面端首次启动自动注册；若 3080 端口已有旧的 dsh 实例在跑，插件注册会在下次全新启动 dsh 时加载
- **皮肤中心看不到皮肤？** 确认 `@dsh-desktop/skins-all` 或 6 款皮肤包至少有一个已 `dsh plugin add`

## 许可

MIT License，Copyright (c) 2026 DeepSeek / dsh-desktop contributors.
本桌面客户端基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建。
皮肤系统架构参考 [dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)（MIT）。
