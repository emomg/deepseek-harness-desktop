# @dsh-desktop/skin-graphite

石墨（Graphite）—— dsh-desktop 6 款极简 editorial 原创皮肤之一。

## 这是什么

独立皮肤包。dsh web 加载后，唯一的动作就是把自己注册到共享皮肤注册表。
皮肤中心卡会拉取它，渲染在「皮肤中心」标签页里。

## Token

完整 18 个 token 在 `skin.json` 的 `vars` 字段。皮肤中心是「完整覆写」
（不是 partial merge），所以每款皮肤都是自洽的——上一个皮肤的残值不会泄漏到
当前皮肤。

## Token 值

- `--dsh-bg-primary`: `#ececeb`
- `--dsh-bg-secondary`: `#dededd`
- `--dsh-bg-elevated`: `#f4f4f3`
- `--dsh-fg-primary`: `#0e0e0e`
- `--dsh-fg-secondary`: `#3a3a3a`
- `--dsh-fg-tertiary`: `#6e6e6e`
- `--dsh-fg-disabled`: `#a4a4a4`
- `--dsh-border`: `rgba(0, 0, 0, 0.10)`
- `--dsh-border-strong`: `rgba(0, 0, 0, 0.18)`
- `--dsh-accent`: `#0e0e0e`
- `--dsh-accent-fg`: `#ffffff`
- `--dsh-glass-bg`: `rgba(236, 236, 235, 0.82)`
- `--dsh-glass-border`: `rgba(0, 0, 0, 0.10)`
- `--dsh-glass-blur`: `24`
- `--dsh-shadow`: `0 1px 2px rgba(0,0,0,.06), 0 8px 28px rgba(0,0,0,.06)`
- `--dsh-glow-1`: `rgba(0, 0, 0, 0.04)`
- `--dsh-glow-2`: `rgba(0, 0, 0, 0.02)`
- `--dsh-mode`: `light`

## 预览

`preview/light.svg` 是脚手架时生成的样张，模拟 DSH 面板用本皮肤 token 渲染
的占位图，不是真实截图。

## 许可

MIT
