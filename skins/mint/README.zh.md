# @dsh-desktop/skin-mint

薄荷（Mint）—— dsh-desktop 6 款极简 editorial 原创皮肤之一。

## 这是什么

独立皮肤包。dsh web 加载后，唯一的动作就是把自己注册到共享皮肤注册表。
皮肤中心卡会拉取它，渲染在「皮肤中心」标签页里。

## Token

完整 18 个 token 在 `skin.json` 的 `vars` 字段。皮肤中心是「完整覆写」
（不是 partial merge），所以每款皮肤都是自洽的——上一个皮肤的残值不会泄漏到
当前皮肤。

## Token 值

- `--dsh-bg-primary`: `#f4f6f3`
- `--dsh-bg-secondary`: `#e5ebe4`
- `--dsh-bg-elevated`: `#fbfcf9`
- `--dsh-fg-primary`: `#141a16`
- `--dsh-fg-secondary`: `#3c4540`
- `--dsh-fg-tertiary`: `#737e76`
- `--dsh-fg-disabled`: `#a5aea6`
- `--dsh-border`: `rgba(20, 26, 22, 0.07)`
- `--dsh-border-strong`: `rgba(20, 26, 22, 0.14)`
- `--dsh-accent`: `#5e9275`
- `--dsh-accent-fg`: `#ffffff`
- `--dsh-glass-bg`: `rgba(244, 246, 243, 0.80)`
- `--dsh-glass-border`: `rgba(20, 26, 22, 0.07)`
- `--dsh-glass-blur`: `22`
- `--dsh-shadow`: `0 1px 2px rgba(20,26,22,.04), 0 8px 24px rgba(20,26,22,.04)`
- `--dsh-glow-1`: `rgba(94, 146, 117, 0.06)`
- `--dsh-glow-2`: `rgba(94, 146, 117, 0.03)`
- `--dsh-mode`: `light`

## 预览

`preview/light.svg` 是脚手架时生成的样张，模拟 DSH 面板用本皮肤 token 渲染
的占位图，不是真实截图。

## 许可

MIT
