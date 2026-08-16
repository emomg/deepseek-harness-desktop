# 🚀 DeepSeek Harness Pro（专业版）· 一步一步上手

> 本指南写给想用**专业版**的朋友。专业版 = 正式版 + 一个 **DSH 插件**（`@dsh-pro/desktop`），
> 提供项目版本管理、总控制器、文件区、GitHub 上传/推代码。
> 跟着做 **10 分钟** 就能用起来。遇到问题看文末「常见问题」。

## 专业版和正式版的关系

| | 正式版（main / v0.1.0） | 专业版（pro-v0.1 / v0.1.0-pro-test） |
|---|---|---|
| 桌面客户端 | ✅ 完整可用 | ✅ 同一套（壳） |
| 版本管理 / 总控制器 / 文件区 / 上传 | ❌ | ✅ **插件提供** |
| 安装方式 | 安装 exe 即可 | 装好正式版后，**再装一个插件** |

两个版本**并存互不覆盖**：正式版 Release 照旧，专业版是额外的测试版 Release。

## 前提

- Windows 10/11，能上网
- 已安装 DSH 桌面端（正式版 `DeepSeek-Harness-Desktop-Setup-0.1.0-full.exe`，见原 [start.md](https://github.com/emomg/deepseek-harness-desktop/blob/main/start.md)）
- 或已安装 Node.js ≥ 18 + `npm install -g @deepseek-ai/dsh`

## 第 1 步：拿到专业版插件

任选一种：

- **A（推荐）**：从 Releases 下载插件包
  `https://github.com/emomg/deepseek-harness-desktop/releases/tag/v0.1.0-pro-test`
  → 下载 `dsh-pro-desktop-v0.1.0-pro-test.zip` → 解压到一个固定目录（如 `D:\dsh-pro-plugin`）
- **B（开发者）**：clone 专业版分支
  ```powershell
  git clone -b pro-v0.1 https://github.com/emomg/deepseek-harness-desktop.git D:\dsh\desktop-app
  # 插件在 D:\dsh\desktop-app\pro-plugin
  ```

## 第 2 步：安装插件

```powershell
# 方式 A（目录已解压）
dsh plugin --profile web add link:D:\dsh-pro-plugin

# 方式 B（clone 的仓库内）
dsh plugin --profile web add link:D:\dsh\desktop-app\pro-plugin
```

验证（应看到 `- id: dsh-pro`）：

```powershell
dsh --profile web --dump-config | Select-String dsh-pro
```

## 第 3 步：重启并找到入口

1. 重启桌面端（或重启 dsh web）—— **必须重启**，插件只在全新启动时加载
2. 打开后，DSH **侧边栏底部**出现「总版本控制器」图标
3. 任意会话**头部**出现「版本」「文件区」两个按钮

## 第 4 步：建立档案 + 自动快照

1. 在 DSH 侧边栏「工作区」新建工作区 → 选一个**项目目录**（如 `D:\my-project`）
2. 在该工作区里开会话干活
3. **每完成一轮任务** → 自动打一次快照（目录文件 + 该会话对话 + AI 生成内容，自动标记「自动」）
4. 想手动存档：总控制器 → 展开工作区 → 「工作区级快照」（或功能框快照）

## 第 5 步：总版本控制器（左下角）

- 打开总控制器 → 顶部是**最终版总览**：每个子控制器的最终版一行
- 操作：**查看**（浏览该版本文件）/ **上传**（发 GitHub Release）/ **推代码** / **回滚** / **删除**
- 展开工作区 → 完整版本历史 → 版本行「**设最终**」把某个版本定为最终版

## 第 6 步：GitHub 设置 + 上传 / 推代码

1. 总控制器底部「**GitHub 设置**」→ 填：
   - `owner/repo`（如 `emomg/deepseek-harness-desktop`）
   - Token：GitHub → Settings → Developer settings → **Fine-grained tokens** → 勾选该仓库 **Contents: Read and write**
   - 点「保存」（Token 只存在本机）
2. **上传**：选最终版 → 确认 → 选内容（文件区/对话区/两者）→ 自动创建 Release（`vX.Y.Z`，**测试版**）并传 zip
3. **推代码**：点「推代码」→ 预览将提交的文件（**敏感信息已自动排除**，如 `.env`/密钥）→ 填提交说明 → 自动 commit + push

## 第 7 步：右侧文件区

- 会话头部「文件区」→ 「＋ 添加」→ 下拉选类型：
  - **git 仓库**：填 `https://...` 或 `git@...` → 自动 clone 到本地，可「拉取」更新
  - **本地文件夹**：填完整路径
- 点源名浏览文件树，点文件查看源码；git 源显示分支徽标 + 改动数

## 常见问题

**问：装了插件但界面没变化？**
答：必须**重启 dsh web**（插件只在启动时加载）。重启后侧边栏底部应有「总版本控制器」。

**问：`dsh plugin` 报 pnpm 错误？**
答：需要 pnpm（`npm install -g pnpm` 或 `corepack enable`），并确保对 `~/.dsh` 与 pnpm 缓存目录有写权限。

**问：上传/推代码提示"尚未配置 GitHub"？**
答：去总控制器底部「GitHub 设置」填仓库 + Token。

**问：推代码会不会把 `.env` 推上去？**
答：**不会**。敏感模式（`.env`、`*.pem`、`*secret*` 等）会自动写入项目 `.git/info/exclude`（仅本地生效），预览时能看到已排除，确认后才提交。

**问：回滚后对话没变？**
答：对话区回滚需要刷新页面或重启 dsh 才完全生效；文件区回滚立即生效。

**问：正式版会受影响吗？**
答：不会。专业版是独立分支 + 独立测试版 Release，正式版（main / v0.1.0）原样保留。

**问：报错/闪退？**
答：看桌面端旁的 `dsh-pro.log` / `dsh-desktop-panic.log`，发到 Issues：<https://github.com/emomg/deepseek-harness-desktop/issues>

## 给开发者的补充

- 插件源码：`pro-plugin/`（宿主 `lib/index.js` + 版本核心 `lib/version.js` + 客户端 `lib/client.js`，均无构建步骤）
- 无头测试：`node pro-plugin\test\version.test.js`（23 项）/ `node pro-plugin\test\host.test.js`（41 项）
- 架构与接口：见 [PRO-DESIGN.md](PRO-DESIGN.md)
- 许可：MIT License
