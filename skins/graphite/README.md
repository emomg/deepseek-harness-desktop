# @dsh-desktop/skin-graphite

石墨 (Graphite) — one of the six original minimal editorial skins for
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

## Preview

`preview/light.svg` is generated at scaffold time and shows a mock DSH
panel using the skin's tokens. It is a stand-in, not a real screenshot.

## License

MIT
