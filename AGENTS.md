# deepseek-harness-desktop — 仓库规则

DeepSeek Harness 的**原生 Windows 桌面端**（Tauri 2 + Rust）+ dsh 插件 + dsh 极简
editorial 皮肤中心全家桶。仓库是 pnpm monorepo，Rust 端独立工作区。

桌面端的"壳"是 Tauri 窗口；运行时由 DSH 提供，DSH 通过 dsh cordis 插件机制挂载
本仓的插件与皮肤。**不修改 DSH 源码**，所有定制走 `cordis.patch.yml` + profile。

## 仓库布局

```text
apps/
  desktop/                 原生 Windows 桌面端（Tauri 2 + Rust）
    src-tauri/             Rust 端：窗口、托盘、端口探测、dsh 拉起、插件自动注册
    dist/                  前端占位页（实际加载 http://127.0.0.1:3080）
    package.json           桌面端包描述
plugins/                   三个内置 DSH 插件
  dsh-pro/                 @dsh-pro/core（任务模板/仪表盘/自动摘要/评审门禁 + 皮肤中心卡）
  dsh-files/               composer 回形针 + 拖拽 PDF/Word/Excel/TXT 上传 + read_document
  dsh-plugin-image-input/  composer 粘贴/拖拽图片 + 视觉 API 识图
skins/                     6 款极简 editorial 原创皮肤（每款独立包）
  bone-white/              默认：冷白底 + 大量负空间 + 安静克制
  graphite/                极简灰阶 + 一抹墨黑
  paper/                   米白 + 朱砂一抹
  mist/                    中性灰 + 冷感湿润
  lilac/                   极低饱和紫 + 冷白
  mint/                    极低饱和薄荷 + 米白
  skin-center/             皮肤中心 GUI 卡（列表/试穿/应用/还原/微调）
dsh-skins/                 皮肤聚合包（build.mjs 把 skins/* 收进单 npm 包）
shared/                    共享工具（皮肤 token schema / CSS 变量约定 / 校验工具）
scripts/                   维护脚本（脚手架/聚合/校验/类型检查/发布说明）
docs/                      长期文档与归档
gallery/                   皮肤画廊静态站（CI 校验与本地预览）
installer/                 NSIS 安装脚本（installer.nsi / installer-pro.nsi）
```

## 常用命令

```powershell
pnpm install              # 装依赖（首跑会拉一堆 peer；离线环境可改 .npmrc 跳过）
pnpm -r build             # 全仓构建（JS 包；Tauri 端走 cargo build --release）
pnpm -r test              # 全仓单测
pnpm typecheck            # 全仓语法检查（JS 项目）
pnpm aggregate:check      # 聚合包一致性（CI 门禁）
pnpm skin-center:check    # 皮肤中心注册表一致性（CI 门禁）
pnpm gallery:check        # 画廊产物一致性（CI 门禁）
pnpm gallery:build        # 重生成画廊静态站
pnpm docs:check           # 文档一致性（CI 门禁）
pnpm skin:new <id>        # 脚手架：新皮肤包
pnpm plugin:new <id>      # 脚手架：新插件包
pnpm release:notes        # 从常规提交自动分组生成 release notes
```

提交前至少跑：`pnpm typecheck && pnpm -r test && pnpm docs:check`（涉及聚合 / 画廊
/ 皮肤中心时另跑 aggregate / gallery / skin-center 三个 --check）。

## 全局约定

- **禁止修改 DSH 源码**：所有定制经 `cordis.patch.yml` + profile；类型只来自
  `@deepseek-ai/*` 官方 NPM SDK（node_modules 解析），不指向任何 DSH 源码 checkout。
- **包名前缀**：插件包 `dsh-` 或 `@dsh-pro/`，皮肤包 `@dsh-desktop/skin-`。
- **JS 项目**：本仓暂用 JS（非 TS），构建走 `scripts/aggregate.mjs` / `scripts/gallery-build.mjs` 自研
  Rollup-free 打包（参考 dsh-web-ui 的 tsdown 模式，但用 JS 等价实现）。未来可
  平滑迁移到 TS。
- **禁止 emoji**：代码、注释、文档、UI 文案、提交信息、脚本输出，禁止使用任何
  Emoji_Presentation / U+FE0F / ZWJ / 区域指示符 / Dingbats 等 Unicode Emoji
  属性字符。需要装饰用普通字符（`*` `-` `_`）或省略。CI 有全树检查。
- **认证环境**：`NPM_TOKEN` 只放环境变量；token 配置放用户级 `~/.npmrc`，
  项目 `.npmrc` 只留 scope 映射。
- **双语纪律**：主插件包 README 中英配对（`README.md` + `README.zh.md` +
  `README.i18n.yaml`），皮肤包双语。改任一侧必须同步另一侧。
- **皮肤原创性**：本仓皮肤为 6 款原创极简 editorial 设计（不沿用 dsh-web-ui
  的 11 款外部皮肤），不二次搬运任何第三方商业皮肤资源。修改/新增皮肤需在
  `docs/skin-design-guide.md` 登记 token 变化。

## 提交规范（Conventional Commits）

`type(scope): subject`，type 用 `feat` / `fix` / `chore` / `docs` / `test` /
`refactor` / `perf`，scope 是包名或主题（如 `dsh-pro`、`skin-bone-white`、
`skins`、`desktop`、`readme`、`release`），关联 issue 时 subject 末尾追加
`(#123)`。提交信息与代码、注释、文档一样禁止 emoji。

## 分层指令体系（渐进式上下文）

| 文件 | 作用 |
| --- | --- |
| 本文件（根 AGENTS.md） | 仓库布局、命令、全局规则，每个会话都需要 |
| 各包 `AGENTS.md` | 该包特有规则 |
| `docs/AGENTS.md` | 文档标准：结构分层、写作规则、i18n 配对 |
| `docs/development.md` | 日常开发流程、调试技巧、常见问题 |

## 编辑这些指令

规则只在其归属层写一次，其他层引用链接，不重复展开。保持每条规则自包含
（1-3 行），细节链接到归属文档。精简优于扩充。
