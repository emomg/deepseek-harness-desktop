# @dsh-desktop/skin-center

The skin center GUI card for dsh-desktop. Reads skins from the shared registry
(`@dsh-desktop/shared`) and renders a try-before-apply picker inside the DSH
settings page.

## What it does

- **Lists** every skin registered via `@dsh-desktop/shared.register(...)`
- **Try-on** applies a skin to the live DOM without persisting — leaving the
  page (or pressing "退出试穿" / "Exit try-on") reverts to the previous state.
- **Apply** writes the chosen skin to `localStorage` under
  `dsh-desktop.skin.v1` and updates `document.documentElement.dataset.dshSkin`.
- **Restore** reverts an in-progress try-on to the snapshot taken when entering
  the card.
- **Persists** the choice across reloads: on next load the center re-applies
  the saved skin once it finds the registration.

## What it does NOT do

- It does not ship skins. Skins live in their own packages
  (`@dsh-desktop/skin-bone-white` etc.) and register themselves.
- It has no host-side routes / data. All logic is browser-only.

## Architecture

```
shared  (registry)   <--  skin-center reads
                        <--  each skin package registers here
                        <--  skin-center card renders the list
                        <--  on apply, writes CSS variables to <html>
```

## Token contract

Every skin must export a full set of 18 CSS tokens (see
`@dsh-desktop/shared/skin-schema.js`). The center writes them as inline
`style="--dsh-*: …"` on `<html>`. The card's own styles also reference
`var(--dsh-*)`, so the card visually changes along with the selected skin.

## i18n

The center ships zh + en dictionaries under namespace
`@dsh-desktop/skin-center`. Override any string in your profile by registering
a higher-priority dictionary for the same namespace.

## License

MIT
