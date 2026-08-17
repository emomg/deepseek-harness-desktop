# 🚀 DeepSeek Harness 桌面版 · 新手安装指南

> 本指南写给第一次接触的朋友，跟着步骤做 **5 分钟就能装好正式版**。
> 想用进阶的**专业版**（任务模板 / 仪表盘 / 自动摘要 / 评审门禁）请看文末「第二部分」。
> 遇到问题请看文末「常见问题」。

---

## 第一部分：正式版（小白必看）

### 这是什么？

DeepSeek Harness 是深度求索（DeepSeek）出品的 AI 编程助手平台。本项目的**桌面版**像普通软件一样：双击安装、双击打开，后台服务会自动帮你跑起来，不用碰命令行。

> 正式版 = `main` 分支 / Release `v1.0.0`；专业版是独立的测试版（`pro-v0.1` 分支 / `v1.0.0-pro`），两个版本**并存互不覆盖**。

### 安装前，请确认

- 电脑系统是 **Windows 10 或 Windows 11**
- 电脑能正常上网

### 第 1 步：下载安装包

1. 打开网页：<https://github.com/emomg/deepseek-harness-desktop>
2. 点击页面右侧的 **Releases**（发行版）
3. 选择 **`v1.0.0`（DeepSeek Harness Desktop v1.0.0，正式版）**，下载 **`DeepSeek-Harness-Desktop-Setup-1.0.0-full.exe`**（自包含版）

> 💡 为什么选 `-full` 版？它已经把运行所需的程序都打包好了，**不需要**另外安装任何东西。另一个 `Setup-1.0.0.exe`（约 4MB）是给开发者用的精简版，需要自己装 Node.js。

### 第 2 步：安装

1. 双击刚才下载的 `DeepSeek-Harness-Desktop-Setup-1.0.0-full.exe`
2. 一路点「下一步」→「安装」（安装到你账户的目录，**不需要管理员权限**）
3. 安装界面会有一个勾选项「将内置 Node.js 添加到 PATH」——建议保留勾选：这样内置的 node/npm 命令也能在命令行里使用；如果电脑上已经有 Node.js，安装程序会自动跳过，不会影响你原有的环境
4. 安装完成后会自动启动

### 第 3 步：开始使用

- 首次打开：应用会自动启动内置服务并弹出主窗口，稍等几秒即可使用
- **内置插件自动就绪**：文件上传（回形针上传 PDF/Word/Excel/TXT）与图片识图（粘贴/拖拽图片）已随安装包内置，桌面端首次启动自动注册，**无需手动安装插件**
- 点窗口右上角 **×** 不会退出，而是最小化到**系统托盘**（屏幕右下角的小图标）
- 想彻底退出：右键托盘图标 → 点「退出」
- 下次使用：双击桌面上的「DeepSeek Harness」快捷方式即可

> 🖼️ **图片识图**需要配置视觉端点（一次即可）：设置环境变量 `IMAGE_VISION_BASE_URL` / `IMAGE_VISION_MODEL` / `IMAGE_VISION_API_KEY`（OpenAI 兼容，如 DashScope `qwen-vl-plus`、智谱 `glm-4v-flash`）。未配置时粘贴图片仍会保存为路径，`vision` 工具会提示配置方法。

---

## 第二部分：专业版（进阶，可选）

专业版 = 正式版 + **DSH 插件**（`@dsh-pro/core` + 两个通用插件），提供：

- 📋 **任务模板库**：高频任务固化成模板，composer 输入 `/tpl` 选择即发送
- 📊 **项目仪表盘**：按工作区聚合会话 × 目标 × todo × 统计 × 自动摘要，阻塞高亮
- ✍️ **会话自动摘要**：每轮任务完成自动生成 3 行摘要（目标/完成/下一步）
- ✅ **评审门禁**：逐文件查看 diff → 接受/拒绝 → git commit（或放弃恢复）
- 📎 **文件上传**（通用）：回形针 / 拖拽上传 PDF / Word / Excel / TXT
- 🖼️ **图片识图**（通用）：输入框粘贴 / 拖拽图片，视觉 API 识图

### 安装专业版

1. 从 Releases 下载 **`v1.0.0-pro`** 的 `DeepSeek-Harness-Desktop-Setup-1.0.0-pro.exe`
2. 双击安装（与正式版安装方式相同）
3. **首次启动自动注册全部三个插件**（`@dsh-pro/core` + `dsh-files` + `dsh-plugin-image-input`），无需手动 `dsh plugin add`

> 从旧版（0.x 插件 zip）升级：卸载旧安装包 → 安装 1.0 安装包即可；重复注册幂等，不会冲突。

### 快速上手

1. 重启后，DSH **侧边栏底部**出现「Pro 面板」（仪表盘 / 模板 / 评审 三个页签）
2. 在「工作区」新建工作区（选一个项目目录）→ 会话干活 → **每轮任务完成自动生成摘要**，仪表盘自动聚合
3. composer 输入 **`/tpl`** → 选模板 → 填变量 → 直接发送给 AI 执行
4. 干完活 → Pro 面板「评审」→ 选工作区「开始评审」→ 逐文件看 diff → **接受/拒绝** → 「提交已接受」
5. 想管模板：Pro 面板「模板」页新建/编辑/删除

> 详细使用说明见 [README.md](README.md)。

## 常见问题

**问：双击安装包没反应？**
答：先确认下载完整（`-full` 版约 100MB）。如果浏览器提示"不安全"，选择"保留"即可；安装包是开源的，源码在本仓库。

**问：提示找不到 WebView2Loader.dll 或无法打开窗口？**
答：安装包已自带 WebView2Loader.dll，并会在缺少 WebView2 运行时（Windows 内置的网页内核）时自动静默安装。如果仍提示，可手动安装 WebView2 运行时：https://developer.microsoft.com/microsoft-edge/webview2/

**问：应用打不开，提示"拒绝访问"或闪退？**
答：若安装目录旁生成了 `dsh-desktop-panic.log`，请把该文件内容发到 Issues：https://github.com/emomg/deepseek-harness-desktop/issues，会有人帮你排查。

**问：需要管理员权限吗？**
答：不需要。安装在自己账户的目录下（`%LOCALAPPDATA%\Programs\DeepSeek Harness`）。

**问：我的聊天记录和密钥安全吗？**
答：安全。所有数据只保存在**你自己电脑**的 `~/.dsh` 文件夹里（聊天记录、密钥、配置都在这里），不会上传到任何地方，也不会随安装包分发。

**问：怎么卸载？**
答：开始菜单 → DeepSeek Harness → 「卸载 DeepSeek Harness」。卸载只删除应用本身，**不会删除**你的数据；想彻底清除数据，再手动删除 `~/.dsh` 文件夹即可。

**问：内置插件没生效？**
答：插件由桌面端**首次启动**自动注册。如果 3080 端口已有旧的 dsh 实例在跑，插件注册会在下次全新启动 dsh 时加载——重启桌面端即可。

**问：精简版上传文档报"解析库缺失"？**
答：精简版不带插件依赖。到 `安装目录\plugins\dsh-files` 执行 `npm install`，然后重启桌面端。图片识图（image-input）零依赖，直接可用。

**问：正式版会受专业版影响吗？**
答：不会。正式版（main / v1.0.0）与专业版（pro-v0.1 / v1.0.0-pro）是独立分支与独立 Release，并存互不覆盖。

**问：看不懂报错怎么办？**
答：把报错文字截图发到 Issues：<https://github.com/emomg/deepseek-harness-desktop/issues>，会有人帮你。

## 给开发者的补充说明

- `-full` 版自带运行时与插件依赖，普通用户无需安装 Node.js；开发者若想用命令行版，可安装 Node.js ≥ 18 后执行 `npm install -g @deepseek-ai/dsh`，再使用约 4MB 的精简安装包。
- 精简版插件依赖安装：`cd <安装目录>\plugins\dsh-files && npm install`
- 功能特性与源码构建：见 [README](README.md)
- 许可：MIT License，Copyright (c) 2026 DeepSeek
