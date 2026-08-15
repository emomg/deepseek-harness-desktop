# 🚀 DeepSeek Harness 桌面版 · 新手安装指南

> 本指南写给第一次接触的朋友。跟着步骤做，**5 分钟就能装好**。遇到问题请看文末「常见问题」。

## 这是什么？

DeepSeek Harness 是深度求索（DeepSeek）出品的 AI 编程助手平台。本项目的**桌面版**像普通软件一样：双击安装、双击打开，后台服务会自动帮你跑起来，不用碰命令行。

## 安装前，请确认

- 电脑系统是 **Windows 10 或 Windows 11**
- 电脑能正常上网

## 第 1 步：下载安装包

1. 打开网页：<https://github.com/emomg/deepseek-harness-desktop>
2. 点击页面右侧的 **Releases**（发行版）
3. 下载 **`DeepSeek-Harness-Desktop-Setup-0.1.0-full.exe`**（自包含版，约 100MB）

> 💡 为什么选 `-full` 版？它已经把运行所需的程序都打包好了，**不需要**另外安装任何东西。另一个 `Setup-0.1.0.exe`（约 2MB）是给开发者用的精简版，需要自己装 Node.js。

## 第 2 步：安装

1. 双击刚才下载的 `DeepSeek-Harness-Desktop-Setup-0.1.0-full.exe`
2. 一路点「下一步」→「安装」（安装到你账户的目录，**不需要管理员权限**）
3. 安装界面会有一个勾选项「将内置 Node.js 添加到 PATH」——建议保留勾选：这样内置的 node/npm 命令也能在命令行里使用；如果电脑上已经有 Node.js，安装程序会自动跳过，不会影响你原有的环境
4. 安装完成后会自动启动

## 第 3 步：开始使用

- 首次打开：应用会自动启动内置服务并弹出主窗口，稍等几秒即可使用
- 点窗口右上角 **×** 不会退出，而是最小化到**系统托盘**（屏幕右下角的小图标）
- 想彻底退出：右键托盘图标 → 点「退出」
- 下次使用：双击桌面上的「DeepSeek Harness」快捷方式即可

## 常见问题（小白必看）

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

**问：看不懂报错怎么办？**
答：把报错文字截图发到 Issues：<https://github.com/emomg/deepseek-harness-desktop/issues>，会有人帮你。

## 给开发者的补充说明

- `-full` 版自带运行时，普通用户无需安装 Node.js；开发者若想用命令行版，可安装 Node.js ≥ 18 后执行 `npm install -g @deepseek-ai/dsh`，再使用约 2MB 的精简安装包。
- 功能特性与源码构建：见 [README](README.md)
- 许可：MIT License，Copyright (c) 2026 DeepSeek