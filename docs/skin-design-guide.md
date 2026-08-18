# dsh-desktop 皮肤设计指南

## 1. 设计目标

为 dsh-desktop 的 DSH Web UI 设计 6 款极简 editorial 原创皮肤。设计基调：

- **极简 clean editorial**——参考 90s 港片女性 restraint、Ann Hui 镜头感
- **不网红、不仙气、不古风**——避免装饰性视觉元素
- **高对比、低饱和**——每款皮肤只暴露 1 个 accent
- **大量负空间**——UI 元素之间留白充足，不堆砌

## 2. 必备 token（18 个）

详见 `@dsh-desktop/shared/skin-schema.js`。每款皮肤必须**完整覆写**这 18 个
CSS 变量，skin-center 在 apply 时把 18 个 token 一次性写进 `<html style>`：

```
--dsh-bg-primary / secondary / elevated
--dsh-fg-primary / secondary / tertiary / disabled
--dsh-border / border-strong
--dsh-accent / accent-fg
--dsh-glass-bg / glass-border / glass-blur
--dsh-shadow
--dsh-glow-1 / glow-2
--dsh-mode  (light | dark)
```

不允许 partial merge——保证每款皮肤自洽。

## 3. 取色约束

### 主背景 (--dsh-bg-primary)
- 必须在 #f5f5f3 / #fafaf7 / 极低饱和冷白之间
- 不允许深色（dark 模式皮肤是另一个 `--dsh-mode: dark` 系列，本仓首批 6 款都是 light）

### 主前景 (--dsh-fg-primary)
- 与 `--dsh-bg-primary` 对比度 ≥ 7:1 (WCAG AAA)
- 推荐 #0a0a0a / #141414 / #1a1a1a / #0e0e0e 系列

### 单 accent (--dsh-accent)
- 每款皮肤**只能有一个** accent 色
- 与 bg/fg 同色系（深灰皮肤用墨黑 accent；暖色皮肤用一抹朱砂 / 赭石 / 砖红；冷色皮肤用一抹深蓝绿 / 紫）
- 与 bg 的饱和度差 ≥ 1 个色阶

### 玻璃 (--dsh-glass-*)
- bg / border 用 rgba，blur 用 px 数字
- 默认 22px blur；editorial 偏向更低（18-22px），不抢戏

### 阴影 (--dsh-shadow)
- 0 1px 2px rgba(fg, .04) + 0 8px 24px rgba(fg, .04) 是基线
- 不要用纯黑阴影（视觉重）

## 4. 流程

1. 用 `pnpm skin:new <id> --name ... --nameEn ...` 起骨架
2. 编辑 `skin.json` 的 `vars` + `tagline` + `description` + `tags`
3. 跑 `pnpm skin-center:check` 校验 18 token 全有
4. 跑 `pnpm gallery:build` 看 gallery 里效果
5. 跑 `pnpm docs:check` 验双语文档
6. commit + push

## 5. 反例

- 6 款皮肤都用同一个 #4176e6 蓝 accent（视觉噪音一致）
- bg = #ffffff（太刺眼，与 editorial 调子不符）
- 引入与 DSH 业务无关的「粒子背景」CSS（与极简冲突）
- 不写 README.zh.md / README.i18n.yaml（docs:check 失败）
- 复刻 dsh-web-ui 的 11 款外部皮肤 id（已记录在脚手架脚本的 FORBIDDEN_IDS）

## 6. 已收录 6 款

| id          | 名   | mood            | accent  |
| ----------- | ---- | --------------- | ------- |
| bone-white  | 骨白 | cool + ink      | #1a1a1a |
| graphite    | 石墨 | cool gray + ink | #0e0e0e |
| paper       | 宣纸 | warm + vermilion| #b8434a |
| mist        | 雾   | cool blue-gray  | #0c1014 |
| lilac       | 丁香 | cool + lilac    | #7a6592 |
| mint        | 薄荷 | cream + mint    | #5e9275 |

下一款的方向（7 号起）建议沿某一维度做更极致的偏移，比如更深的冷灰（slate）、
更暖的陶土（terracotta）、纯黑（obsidian 暗模式首作）。
