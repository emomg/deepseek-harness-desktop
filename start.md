# dsh-desktop 新手指南

> Windows 10/11 · Tauri 桌面端 + DSH 插件 + 6 款原创皮肤

---

## 第一部分：正式版

### 下载安装

1. 打开 https://github.com/emomg/deepseek-harness-desktop/releases
2. 选最新 v2.0.0 的安装包：
   - **`Setup-2.0.0-full.exe`**（约 100MB）—— 自带 Node.js + dsh 运行时，装完即用
   - **`Setup-2.0.0.exe`**（约 4MB）—— 精简版，需本机 Node.js ≥ 18
3. 双击安装，按提示下一步

### 验证安装

1. 桌面会有「DeepSeek Harness」图标
2. 双击启动，系统托盘会出现黑鲸鱼图标
3. 主窗口加载 DSH Web UI

### 卸载

控制面板 → 程序和功能 → DeepSeek Harness → 卸载

注意：卸载**不会删除** `~/.dsh` 目录（聊天记录、API Key 等）。如需清除数据请手动删除。

---

## 第二部分：专业版

> 专业版 = 正式版 + 6 款原创皮肤 + DSH 插件全家桶

### 安装专业版

从 Releases 下载 `Setup-2.0.0-pro.exe`，双击安装。

安装完成后：
- **首次启动**自动注册全部 3 个 DSH 插件（`@dsh-pro/core` + `dsh-files` + `dsh-plugin-image-input`）
- **皮肤中心**已可用（DSH 设置页 → 左侧「皮肤中心」）

### 用皮肤中心切换皮肤

1. 在 DSH 设置页左侧点「皮肤中心」
2. 看到 6 款原创皮肤（骨白 / 石墨 / 宣纸 / 雾 / 丁香 / 薄荷）
3. 点「试穿」即时切换（不保存）
4. 满意后点「应用」一键保存
5. 离开本页或点「退出试穿」完全还原到应用前

### 用任务模板（dsh-pro）

1. DSH 设置页左侧点「个性化」（或 composer 右上角）
2. 进入「任务模板」标签
3. 内置 4 个：修测试 / PR 描述 / 代码评审 / 跑一遍并总结
4. 在 composer 输入 `/tpl` 选模板 → 填变量 → 发送

### 用文件上传（dsh-files）

1. composer 左下角点回形针图标
2. 或直接拖拽 PDF / Word / Excel / TXT
3. agent 用 `read_document` 工具直接读

### 用图片识图（dsh-plugin-image-input）

1. composer 里 Ctrl+V 粘贴图片
2. 或拖拽图片
3. 纯文本模型自动桥接视觉 API 识图
4. 设置环境变量：
   - `IMAGE_VISION_BASE_URL` —— 如 `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - `IMAGE_VISION_MODEL` —— 如 `qwen-vl-plus`
   - `IMAGE_VISION_API_KEY` —— 你的 API Key

---

## 第三部分：开发与扩展

### 加一款新皮肤

```powershell
# 1. 脚手架
pnpm skin:new <id> --name <zh> --nameEn <en> --order <N>
# 例：pnpm skin:new obsidian --name 墨石 --nameEn Obsidian --order 7

# 2. 编辑 skins/<id>/skin.json 改 18 个 CSS token
# 3. 跑门禁
pnpm skin-center:check
pnpm aggregate:check
pnpm docs:check

# 4. 启动 dsh web，新皮肤自动出现在皮肤中心
```

完整设计指南：[`docs/skin-design-guide.md`](docs/skin-design-guide.md)

### 加一个新插件

```powershell
pnpm plugin:new my-tool
# 编辑 plugins/my-tool/lib/{index,client}.js
# 编辑 cordis.patch.yml 的 config
```

完整开发循环：[`docs/development.md`](docs/development.md)

---

## 常见问题

**Q: 装完打开没反应？**
A: 检查系统是不是 Windows 10/11，且已安装 WebView2（一般自带）。如果还不行，
打开 `C:\Users\<你>\AppData\Roaming\DeepSeek Harness\logs\` 看最新日志。

**Q: 3080 端口被占用？**
A: 桌面端会复用已有 dsh 实例，不会重复启动。如果旧实例不是 2.0 版的，关闭它
后再启动桌面端。

**Q: 怎么禁用某个内置插件？**
A: 删 `~/.dsh/cordis.patch.yml` 里对应的 `insert` 段，然后重启桌面端。

**Q: 6 款皮肤不够用？**
A: 自己写一款——`pnpm skin:new <id>` 起骨架，改 `skin.json` 的 18 token。

**Q: 怎么贡献？**
A: 见根目录 [`AGENTS.md`](AGENTS.md) 的「提交规范」与「PR 要求」。
所有改动需跑全部门禁 + 全仓测试。
