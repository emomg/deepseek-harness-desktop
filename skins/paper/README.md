# @dsh-desktop/skin-paper

宣纸 (Paper) — one of the six original minimal editorial skins for
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

## Preview

`preview/light.svg` is generated at scaffold time and shows a mock DSH
panel using the skin's tokens. It is a stand-in, not a real screenshot.

## License

MIT
