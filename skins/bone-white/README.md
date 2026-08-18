# @dsh-desktop/skin-bone-white

骨白 (Bone White) — one of the six original minimal editorial skins for
dsh-desktop.

## What this package is

A standalone skin. When loaded by dsh web, its only action is to register
itself into the shared skin registry. The skin-center card picks it up and
renders it in the "皮肤中心 / Skins" tab.

## Tokens

The full 18-token set is in `skin.json` and shipped via the `vars` field.
It is a complete overwrite (not a partial merge), so each skin is self-
contained — no residual values from the previous skin leak through.

## Token values

- `--dsh-bg-primary`: `#fafaf7`
- `--dsh-bg-secondary`: `#f3f1ec`
- `--dsh-bg-elevated`: `#ffffff`
- `--dsh-fg-primary`: `#1a1a1a`
- `--dsh-fg-secondary`: `#4a4a48`
- `--dsh-fg-tertiary`: `#8a8a86`
- `--dsh-fg-disabled`: `#b8b8b4`
- `--dsh-border`: `rgba(0, 0, 0, 0.06)`
- `--dsh-border-strong`: `rgba(0, 0, 0, 0.12)`
- `--dsh-accent`: `#1a1a1a`
- `--dsh-accent-fg`: `#ffffff`
- `--dsh-glass-bg`: `rgba(250, 250, 247, 0.78)`
- `--dsh-glass-border`: `rgba(0, 0, 0, 0.06)`
- `--dsh-glass-blur`: `22`
- `--dsh-shadow`: `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.04)`
- `--dsh-glow-1`: `rgba(0, 0, 0, 0.03)`
- `--dsh-glow-2`: `rgba(0, 0, 0, 0.015)`
- `--dsh-mode`: `light`

## Preview

`preview/light.svg` is generated at scaffold time and shows a mock DSH
panel using the skin's tokens. It is a stand-in, not a real screenshot.

## License

MIT
