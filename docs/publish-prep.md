# dsh-desktop 发布准备

## 发布前检查清单

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过（dsh-files parse 测需 `pnpm install` 后才能跑）
- [ ] `pnpm skin-center:check` 通过
- [ ] `pnpm aggregate:check` 通过
- [ ] `pnpm gallery:check` 通过
- [ ] `pnpm docs:check` 通过
- [ ] 全部 npm 包 version 与目标 tag 一致（`pnpm verify:version 0.X.Y`）
- [ ] CHANGELOG（如果有）已更新
- [ ] release notes 生成（`pnpm release:notes <prev> <new>`）

## 步骤

### 1. bump version

根 `package.json` 改 `version` 字段为 `0.X.Y`。然后：

```powershell
# 同步所有 workspace 包的 version
node scripts/verify-version.mjs 0.X.Y
# 任何不一致会列出，照着手改
```

### 2. 重新生成聚合 + 画廊

```powershell
pnpm aggregate
pnpm gallery:build
```

### 3. commit + tag

```powershell
git add -A
git commit -m "chore(release): v0.X.Y"
git tag v0.X.Y
git push origin HEAD
git push origin v0.X.Y
```

### 4. CI 自动跑

`.github/workflows/release.yml` 推 tag 触发：

1. `pnpm verify:version v0.X.Y` —— 不通过就 abort
2. 全部门禁（typecheck / test / skin-center:check / aggregate:check / gallery:check / docs:check）
3. `pnpm release:notes v0.X.(Y-1) v0.X.Y` 生成 release notes
4. 全部包 npm publish（按依赖顺序：shared → skin → skin-center → dsh-skins-all）
5. 创建 GitHub Release（带 release notes + 各包的 npm 链接）

### 5. 桌面端安装包

桌面端是独立流程，与 npm publish 平行：

```powershell
# 1. 准备 build 目录
New-Item -ItemType Directory -Force installer\build
Copy-Item apps\desktop\src-tauri\target\release\dsh-desktop.exe installer\build\
Copy-Item plugins\dsh-pro installer\build\plugins\dsh-pro -Recurse -Force
Copy-Item plugins\dsh-files installer\build\plugins\dsh-files -Recurse -Force
Copy-Item plugins\dsh-plugin-image-input installer\build\plugins\dsh-plugin-image-input -Recurse -Force

# 2. NSIS 编译
makensis installer\installer.nsi                      # 正式精简版
makensis installer\installer.nsi /DRUNTIME_DIR=...    # 正式 full 版
makensis installer\installer-pro.nsi                  # 专业版

# 3. 上传 installer/*.exe 到 GitHub Release
gh release upload v0.X.Y installer\DeepSeek-Harness-Desktop-Setup-*.exe
```

## 失败回滚

- 误发 npm 包：npm unpublish @dsh-desktop/<name> 必须在 72 小时内
- 误推 tag：本地 `git tag -d v0.X.Y` + `git push origin :refs/tags/v0.X.Y`
- 已发布到 GitHub Release：编辑 release notes 标 deprecated
