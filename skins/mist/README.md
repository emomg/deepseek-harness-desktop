# @dsh-desktop/skin-mist

雾 (Mist) — one of the six original minimal editorial skins for
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

- `--dsh-bg-primary`: `#eef0f2`
- `--dsh-bg-secondary`: `#dfe2e6`
- `--dsh-bg-elevated`: `#f6f7f8`
- `--dsh-fg-primary`: `#0c1014`
- `--dsh-fg-secondary`: `#2c333b`
- `--dsh-fg-tertiary`: `#5b6770`
- `--dsh-fg-disabled`: `#8a949c`
- `--dsh-border`: `rgba(12, 16, 20, 0.08)`
- `--dsh-border-strong`: `rgba(12, 16, 20, 0.16)`
- `--dsh-accent`: `#0c1014`
- `--dsh-accent-fg`: `#ffffff`
- `--dsh-glass-bg`: `rgba(238, 240, 242, 0.80)`
- `--dsh-glass-border`: `rgba(12, 16, 20, 0.08)`
- `--dsh-glass-blur`: `26`
- `--dsh-shadow`: `0 1px 2px rgba(12,16,20,.05), 0 8px 28px rgba(12,16,20,.06)`
- `--dsh-glow-1`: `rgba(60, 90, 140, 0.05)`
- `--dsh-glow-2`: `rgba(60, 90, 140, 0.025)`
- `--dsh-mode`: `light`

## Preview

`preview/light.svg` is generated at scaffold time and shows a mock DSH
panel using the skin's tokens. It is a stand-in, not a real screenshot.

## License

MIT
