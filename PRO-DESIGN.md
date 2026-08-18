# dsh-desktop 专业版设计文档

> 桌面端 + 插件 + 皮肤系统 = dsh-desktop（v2 深度 monorepo 化）

## 1. 范围

v2 的"专业版"由三部分组成：

1. **桌面端**：`apps/desktop/` —— Tauri 2 + Rust，Windows 原生窗口，加载 DSH Web UI
2. **DSH 插件**：`plugins/dsh-pro`、`plugins/dsh-files`、`plugins/dsh-plugin-image-input`
3. **皮肤系统**：`skins/skin-center` + 6 款独立皮肤包 + 聚合 `dsh-skins` + 共享 `shared/`

## 2. 三层架构

```
┌────────────────────────────────────────────────────────┐
│ DSH web UI (port 3080)                                 │
│ ├── 注入 cordis 插件 (3 个)                            │
│ │   ├── dsh-pro     任务模板/仪表盘/摘要/评审         │
│ │   ├── dsh-files   文件上传 + read_document           │
│ │   ├── dsh-image-input  图片粘贴 + 视觉识图          │
│ │   └── skin-center 皮肤中心 GUI 卡                   │
│ └── 皮肤注册表 (来自 @dsh-desktop/shared)              │
│     ├── bone-white / graphite / paper / mist          │
│     ├── lilac / mint (6 款极简 editorial)             │
└────────────────────────────────────────────────────────┘
                            ▲
                            │ 加载 http://127.0.0.1:3080
                            │
┌────────────────────────────────────────────────────────┐
│ apps/desktop (Tauri 2 + Rust)                          │
│ ├── 窗口/托盘/端口探测/dsh 拉起                        │
│ └── 首次启动自动注册 plugins/ 三个插件                 │
└────────────────────────────────────────────────────────┘
```

## 3. 数据流：皮肤应用

1. dsh web 启动 → 加载 cordis 插件
2. `@dsh-desktop/skin-bone-white`（等 6 款）执行 `register(skinMeta)` 写入共享注册表
3. `@dsh-desktop/skin-center` 渲染设置卡 → 调 `list()` 拿到全部 6 款
4. 用户点「应用」→ 调 `apply(skin)`：完整覆写 18 个 CSS token 到 `<html style>`，设 `data-dsh-skin` 属性
5. CSS 规则 `var(--dsh-*)` 全局生效
6. 选中的皮肤 id 持久化到 `localStorage['dsh-desktop.skin.v1']`

试穿 (try-on) 不持久化：进入卡时拍快照，离开卡或点「退出试穿」完全还原。

## 4. 6 款皮肤设计

设计参考：[`docs/skin-design-guide.md`](docs/skin-design-guide.md)

| id          | 调子            | accent  | 何时用                          |
| ----------- | --------------- | ------- | ------------------------------- |
| `bone-white` | cool + ink      | #1a1a1a | 默认（最克制）                  |
| `graphite`   | cool + ink      | #0e0e0e | 想更专注                        |
| `paper`      | warm + vermilion| #b8434a | 长读 / 写作                      |
| `mist`       | cool blue-gray  | #0c1014 | 雨意 / 安静                      |
| `lilac`      | cool + lilac    | #7a6592 | 想要一抹低饱和色                |
| `mint`       | cream + mint    | #5e9275 | 轻量阅读 / 不抢戏                |

每款皮肤是一个独立 npm 包 `@dsh-desktop/skin-<id>`，含：

- `skin.json` —— 元数据 + 18 token
- `cordis.patch.yml` —— dsh 注册
- `lib/{index,client}.js` —— host stub + browser register
- `preview/light.svg` + `dark.svg` —— 预览图
- `README.md` + `README.zh.md` + `README.i18n.yaml` —— 双语 + i18n 配对

## 5. 共享层：`shared/`

`@dsh-desktop/shared` 是无依赖的纯 JS 库：

- `skin-schema.js` —— 18 token 校验 + `validateSkin` / `validateRegistry`
- `css-tokens.js` —— 18 token 默认值 + `writeVars` / `readVars` / `installDefaultTokens`
- `registry.js` —— 浏览器端 `register` / `list` / `get` 注册表

被 `@dsh-desktop/skin-center` 和 6 款皮肤包共同依赖。

## 6. CI 门禁

- `pnpm typecheck` —— JS 语法检查（51 个文件）
- `pnpm test` —— 全仓测试（24 个测试）
- `pnpm skin-center:check` —— 6 款皮肤 schema 校验
- `pnpm aggregate:check` —— `dsh-skins` 聚合包产物与 `skins/` 一致
- `pnpm gallery:check` —— 画廊与 registry 一致
- `pnpm docs:check` —— 双语文档 / i18n.yaml 配对

## 7. 安全

- **不收集、不上传任何数据**；摘要/模板/评审记录只存本机 Pro 数据目录
  （`DSH_PRO_DATA_DIR` 或 `%LOCALAPPDATA%\DeepSeek Harness Pro\data`）
- **不写 DSH 会话日志**（DSH 持久化拒绝未知事件类型）
- 评审的拒绝/放弃会真实改动工作区文件（git checkout / 恢复基线），提交才执行 git commit
- git 命令数组传参（无 shell 注入）
- 桌面端是本地壳，不联网就能用；联网后只走 dsh web 已有的网络栈

## 8. 测试与文档

- 全仓测试：`pnpm test`（6 个套件，24 个测试）
- 架构与 API 契约：[`AGENTS.md`](AGENTS.md) + [`docs/development.md`](docs/development.md)
- 皮肤设计指南：[`docs/skin-design-guide.md`](docs/skin-design-guide.md)
- i18n 规范：[`docs/i18n.md`](docs/i18n.md)
- 新手安装与使用：[`start.md`](start.md)

## 9. 与 v1 的差异（迁移指南）

v1 → v2 主要变化：

| v1                             | v2                                                                 |
| ------------------------------ | ------------------------------------------------------------------ |
| 11 款硬编码皮肤（pro-plugin）  | 6 款独立包 + 共享注册表 + skin-center 独立包                       |
| 单包 Tauri 仓库                | pnpm monorepo（apps / plugins / skins / shared / dsh-skins）       |
| 皮肤中心 UI 嵌在 pro-plugin    | 独立 `@dsh-desktop/skin-center` 插件                                |
| 单一 README                    | 仓库级 AGENTS.md + 包 README 三件套 + docs/ 长期文档               |
| 无 CI 门禁                     | 6 个门禁脚本 + GitHub Actions                                       |
| `--dsw-alias-*` 旧 token       | 18 个 `--dsh-*` token（更收敛）                                     |

迁移步骤：

1. 拉新代码：`git fetch && git checkout v2.x`
2. 装依赖：`pnpm install`
3. dsh 重启一次（让 cordis 重新注册 3 个插件 + skin-center + 6 款皮肤）
4. 旧的 11 款硬编码皮肤设置会被自动忽略——在皮肤中心选择 6 款新皮肤的任意一款即可
