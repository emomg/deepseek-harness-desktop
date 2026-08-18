# dsh-desktop 开发流程

## 日常循环

```powershell
# 1. 编辑
$editor $file

# 2. 局部验证
node scripts\typecheck.mjs
node scripts\test-all.mjs

# 3. CI 门禁
pnpm typecheck
pnpm test
pnpm skin-center:check
pnpm aggregate:check
pnpm gallery:check
pnpm docs:check

# 4. commit
git add -A
git commit -m "feat(skin-bone-white): ..."
```

## 加一款新皮肤

```powershell
# 1. 脚手架
pnpm skin:new obsidian --name 墨石 --nameEn Obsidian --order 7

# 2. 编辑 skins/obsidian/skin.json 改 token + 描述
$editor skins/obsidian/skin.json

# 3. 编辑 README 双语 + i18n.yaml
$editor skins/obsidian/README.md
$editor skins/obsidian/README.zh.md
$editor skins/obsidian/README.i18n.yaml

# 4. 跑门禁
pnpm skin-center:check    # 校验 token
pnpm aggregate:check      # 重生成 dsh-skins/build
pnpm gallery:build        # 重生成画廊
pnpm docs:check           # 校验文档

# 5. 加进 dsh-skins/package.json dependencies（脚手架会提示）
# 6. 跑 dsh-files 之外的全部测试
pnpm test
```

## 加一款新插件

```powershell
pnpm plugin:new my-plugin
# 编辑 plugins/my-plugin/lib/{index,client}.js
# 编辑 README.md + cordis.patch.yml
```

## 修改共享层

`shared/` 任何改动都影响所有皮肤：

```powershell
# 1. 改 shared/skin-schema.js 或 shared/css-tokens.js
# 2. 跑所有皮肤的 skin-center:check
pnpm skin-center:check
# 3. 任何失败说明某款 skin 没补齐新 token
# 4. 修 skin 然后重 aggregate
pnpm aggregate
```

## 桌面端构建

需要 Rust（stable）+ Windows 10/11 + WebView2：

```powershell
cd apps/desktop/src-tauri
cargo build --release
# 产物: apps/desktop/src-tauri/target/release/dsh-desktop.exe
```

NSIS 打包（正式版 + 专业版两个变体）：

```powershell
# 1. 准备 build/ 目录
New-Item -ItemType Directory -Force installer\build
Copy-Item apps\desktop\src-tauri\target\release\dsh-desktop.exe installer\build\
Copy-Item plugins\dsh-pro installer\build\plugins\dsh-pro -Recurse -Force
Copy-Item plugins\dsh-files installer\build\plugins\dsh-files -Recurse -Force
Copy-Item plugins\dsh-plugin-image-input installer\build\plugins\dsh-plugin-image-input -Recurse -Force

# 2. NSIS 编译
makensis installer\installer.nsi                      # 正式精简版
makensis installer\installer.nsi /DRUNTIME_DIR=...    # 正式 full 版
makensis installer\installer-pro.nsi                  # 专业版
```

## 调试技巧

- **看皮肤中心卡是否注册**：浏览器 console 跑
  `window.__dshDesktopSkins || @dsh-desktop/shared.list()`
- **临时加 token**：编辑 `shared/css-tokens.js` 的 `DEFAULT_VARS`，刷新即可
- **看 dsh-pro 加载顺序**：浏览器 devtools network 标签，搜 `cordis`
- **看 cordis 插件挂载点**：`ctx.slots.list('settings.section')` 在 console

## 常见问题

**Q: 改了 skin.json 但页面没变？**
A: 浏览器硬刷 (Ctrl+Shift+R)。dsh 的 cordis 缓存可能命中旧 bundle。

**Q: 测试 fail 说 "Cannot find module 'jszip'"？**
A: `pnpm install` 装齐所有 workspace deps。本机内网不通时这个 fail 是预期的，
test-all.mjs 会自动跳过 dsh-files 的依赖型测试。

**Q: 怎么本地预览 gallery？**
A: `pnpm gallery:build` 后 `python -m http.server -d gallery 8000`，浏览器
打开 http://127.0.0.1:8000

**Q: 怎么发布新版本？**
A: 推 tag `v0.2.0` → CI 跑 `verify-version` + `release-notes` + 全部门禁
→ 通过后自动 npm publish
