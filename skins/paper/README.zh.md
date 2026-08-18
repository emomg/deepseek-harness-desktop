# @dsh-desktop/skin-paper

宣纸（Paper）—— dsh-desktop 6 款极简 editorial 原创皮肤之一。

## 这是什么

独立皮肤包。dsh web 加载后，唯一的动作就是把自己注册到共享皮肤注册表。
皮肤中心卡会拉取它，渲染在「皮肤中心」标签页里。

## Token

完整 18 个 token 在 `skin.json` 的 `vars` 字段。皮肤中心是「完整覆写」
（不是 partial merge），所以每款皮肤都是自洽的——上一个皮肤的残值不会泄漏到
当前皮肤。

## Token 值

- `--dsh-bg-primary`: `#f5efe5`
- `--dsh-bg-secondary`: `#ebe4d6`
- `--dsh-bg-elevated`: `#fbf8f0`
- `--dsh-fg-primary`: `#1f1b16`
- `--dsh-fg-secondary`: `#524a3e`
- `--dsh-fg-tertiary`: `#8a7f6e`
- `--dsh-fg-disabled`: `#b6ad9c`
- `--dsh-border`: `rgba(31, 27, 22, 0.08)`
- `--dsh-border-strong`: `rgba(31, 27, 22, 0.16)`
- `--dsh-accent`: `#b8434a`
- `--dsh-accent-fg`: `#ffffff`
- `--dsh-glass-bg`: `rgba(245, 239, 229, 0.80)`
- `--dsh-glass-border`: `rgba(31, 27, 22, 0.08)`
- `--dsh-glass-blur`: `22`
- `--dsh-shadow`: `0 1px 2px rgba(31,27,22,.05), 0 8px 24px rgba(31,27,22,.05)`
- `--dsh-glow-1`: `rgba(184, 67, 74, 0.08)`
- `--dsh-glow-2`: `rgba(184, 67, 74, 0.04)`
- `--dsh-mode`: `light`

## 预览

`preview/light.svg` 是脚手架时生成的样张，模拟 DSH 面板用本皮肤 token 渲染
的占位图，不是真实截图。

## 许可

MIT
