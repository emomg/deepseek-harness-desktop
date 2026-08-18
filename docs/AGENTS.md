# dsh-desktop docs 规范

## 文档分层

- `README.md` + `README.zh.md` + `README.i18n.yaml`：包级双语说明
- `AGENTS.md`：仓库级或包级的「约束 + 流程」
- `docs/`：长期文档（不会随每次小改更新）
- `docs/archive/`：一次性记录（验证快照、迁移日志）——不进 git 永久区

## 双语配对

每个对外可见的包必须有 `README.md`（en）+ `README.zh.md`（zh）+
`README.i18n.yaml`（结构化配对）。`scripts/docs-check.mjs` 校验三件套是否齐全。
改任一侧必须同步另一侧，否则 `pnpm docs:check` 变红。

## 字数纪律

- 包 README：80-200 行。够介绍 + 入门，不堆功能列表
- AGENTS.md：每条 1-3 行，细节链接到 docs/
- docs/*：可长，但每节必须 5 分钟内读完

## emoji

仓库根 AGENTS.md 写了「禁止 emoji」。文档、注释、UI 文案、脚本输出、提交信息
全部走这条线。装饰用 `*` `-` `_` 或留空。

## 写新文档前

1. 看一眼本目录是否已经有类似主题 → 合并，不重复
2. 决定分层：包内 README / 仓库 AGENTS / docs/ 长期
3. 双语同时写
4. 跑 `pnpm docs:check` 验证
