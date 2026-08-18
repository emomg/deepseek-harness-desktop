# @dsh-desktop/skin-mint

薄荷 (Mint) — one of the six original minimal editorial skins for
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

## Preview

`preview/light.svg` is generated at scaffold time and shows a mock DSH
panel using the skin's tokens. It is a stand-in, not a real screenshot.

## License

MIT
