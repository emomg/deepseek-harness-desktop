# @dsh-desktop/skin-center

dsh-desktop 皮肤中心 GUI 卡。从 `@dsh-desktop/shared` 共享注册表读全部皮肤，在
DSH 设置页「皮肤中心」里渲染「先试穿再应用」的选皮器。

## 它做什么

- **列出**通过 `@dsh-desktop/shared.register(...)` 注册的全部皮肤
- **试穿**实时把皮肤应用到 DOM，但不持久化；离开本页（或点「退出试穿」）完全
  还原到进入前的状态
- **应用**把选中的皮肤写入 `localStorage`（key = `dsh-desktop.skin.v1`）并
  更新 `document.documentElement.dataset.dshSkin`
- **还原**撤销正在进行的试穿
- **持久化**在刷新后自动重应用：加载时重新找到注册的皮肤并写回 DOM

## 它不做什么

- 不发皮肤本体。皮肤在各自独立的包（`@dsh-desktop/skin-bone-white` 等）里
  通过共享注册表自注册
- 没有 host 端路由 / 数据，所有逻辑纯浏览器

## 架构

```
shared（注册表）   <--  skin-center 读
                  <--  每款皮肤包向这里 register
                  <--  skin-center 卡渲染列表
                  <--  应用时写 CSS 变量到 <html>
```

## Token 契约

每款皮肤必须输出完整 18 个 CSS token（见 `@dsh-desktop/shared/skin-schema.js`）。
皮肤中心把它们以 `style="--dsh-*: …"` 内联到 `<html>` 上。本卡自身的样式也
用 `var(--dsh-*)` 引用，所以皮肤切换时卡片本身也会跟着变。

## 国际化

本卡自带 zh + en 双语字典，命名空间 `@dsh-desktop/skin-center`。需要覆盖任何
字符串时，在你的 profile 里以同一命名空间注册更高优先级的字典即可。

## 许可

MIT
