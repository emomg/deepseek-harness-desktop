# @dsh-desktop/skin-lilac

丁香 (Lilac) — one of the six original minimal editorial skins for
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

- `--dsh-bg-primary`: `#f7f5f8`
- `--dsh-bg-secondary`: `#ece8ef`
- `--dsh-bg-elevated`: `#fdfcfe`
- `--dsh-fg-primary`: `#1c1820`
- `--dsh-fg-secondary`: `#4a4350`
- `--dsh-fg-tertiary`: `#857d8c`
- `--dsh-fg-disabled`: `#b3acb8`
- `--dsh-border`: `rgba(28, 24, 32, 0.07)`
- `--dsh-border-strong`: `rgba(28, 24, 32, 0.14)`
- `--dsh-accent`: `#7a6592`
- `--dsh-accent-fg`: `#ffffff`
- `--dsh-glass-bg`: `rgba(247, 245, 248, 0.80)`
- `--dsh-glass-border`: `rgba(28, 24, 32, 0.07)`
- `--dsh-glass-blur`: `22`
- `--dsh-shadow`: `0 1px 2px rgba(28,24,32,.04), 0 8px 24px rgba(28,24,32,.04)`
- `--dsh-glow-1`: `rgba(122, 101, 146, 0.06)`
- `--dsh-glow-2`: `rgba(122, 101, 146, 0.03)`
- `--dsh-mode`: `light`

## Preview

`preview/light.svg` is generated at scaffold time and shows a mock DSH
panel using the skin's tokens. It is a stand-in, not a real screenshot.

## License

MIT
