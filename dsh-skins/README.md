# @dsh-desktop/skins-all

Meta-aggregation of all six original minimal editorial skins for dsh-desktop.
Install this one package to register the full set; the skin-center card then
shows them all under "皮肤中心 / Skins".

## What it bundles

| id            | name (zh) | name (en)  | accent  | mood                        |
| ------------- | --------- | ---------- | ------- | --------------------------- |
| `bone-white`  | 骨白      | Bone White | #1a1a1a | cool white + ink            |
| `graphite`    | 石墨      | Graphite   | #0e0e0e | cool gray scale + ink       |
| `paper`       | 宣纸      | Paper      | #b8434a | warm cream + vermilion      |
| `mist`        | 雾        | Mist       | #0c1014 | cool blue-gray + ink        |
| `lilac`       | 丁香      | Lilac      | #7a6592 | cool white + low-sat purple |
| `mint`        | 薄荷      | Mint       | #5e9275 | cream + low-sat mint        |

All six are light-mode. Each is shipped as its own package
(`@dsh-desktop/skin-<id>`) and registered into the shared registry at load
time; this meta-package only collects them and exposes a single import.

## Usage

```js
// 浏览器端
import '@dsh-desktop/skins-all';
// → 6 款全部 register 到 @dsh-desktop/shared，皮肤中心卡自动列出
```

## Build

```bash
node dsh-skins/scripts/aggregate.mjs
node dsh-skins/scripts/aggregate.mjs --check  # CI 门禁
```

## License

MIT
