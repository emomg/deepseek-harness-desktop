# dsh-desktop v2 portable 打包（不需要 NSIS）
# 跑法：.\scripts\build-portable.ps1
# 产物：dist\DeepSeek-Harness-Desktop-2.0.0-portable.zip
# 含 dsh-desktop.exe + WebView2Loader.dll + 3 个插件。
# 用户解包到任意目录双击 dsh-desktop.exe 即可（仍需 PATH 有 dsh 命令）。
#
# 这是 NSIS installer 不可用时的 fallback。生产分发还是用 build-installer.ps1。

[CmdletBinding()]
param(
  [switch]$SkipCargo,
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$DesktopTauri = Join-Path $RepoRoot 'apps\desktop\src-tauri'
$DistDir = Join-Path $RepoRoot 'dist'

# ---- 1. cargo build (unless skip) ----
$ExePath = Join-Path $DesktopTauri 'target\release\dsh-desktop.exe'
if ($SkipCargo) {
  if (-not (Test-Path $ExePath)) {
    throw "SkipCargo 但找不到 $ExePath；先 cargo build --release"
  }
  Write-Host "[1/4] SkipCargo 模式，使用已有 dsh-desktop.exe" -ForegroundColor Yellow
} else {
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "找不到 cargo；装 Rust 工具链或用 -SkipCargo"
  }
  Write-Host "[1/4] cargo build --release (Tauri 端) ..." -ForegroundColor Cyan
  Push-Location $DesktopTauri
  try {
    cargo build --release
    if ($LASTEXITCODE -ne 0) { throw "cargo build 失败 (exit $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
}

# ---- 2. 准备 portable 工作目录 ----
Write-Host "[2/4] 准备 dist/portable/ ..." -ForegroundColor Cyan
$PortableRoot = Join-Path $DistDir 'portable'
if ($Clean -and (Test-Path $PortableRoot)) {
  Get-ChildItem $PortableRoot -Recurse -Force | Remove-Item -Recurse -Force
}
if (Test-Path $PortableRoot) {
  Get-ChildItem $PortableRoot -Recurse -Force | Remove-Item -Recurse -Force
}
$PluginsDir = Join-Path $PortableRoot 'plugins'
New-Item -ItemType Directory -Force -Path $PortableRoot | Out-Null
New-Item -ItemType Directory -Force -Path $PluginsDir | Out-Null

# ---- 3. 拷贝 dsh-desktop.exe + WebView2Loader.dll + 3 个插件 ----
Write-Host "[3/4] 拷 dsh-desktop.exe + WebView2Loader.dll + 3 个插件 ..." -ForegroundColor Cyan
Copy-Item $ExePath (Join-Path $PortableRoot 'dsh-desktop.exe') -Force
$Webview2Loader = Join-Path $DesktopTauri 'target\release\WebView2Loader.dll'
if (Test-Path $Webview2Loader) {
  Copy-Item $Webview2Loader (Join-Path $PortableRoot 'WebView2Loader.dll') -Force
}
$PluginNames = @('dsh-pro', 'dsh-files', 'dsh-plugin-image-input')
foreach ($name in $PluginNames) {
  $src = Join-Path $RepoRoot 'plugins' $name
  if (-not (Test-Path $src)) {
    Write-Host "  ! 缺插件 $name" -ForegroundColor Yellow
    continue
  }
  Copy-Item -Recurse -Force $src (Join-Path $PluginsDir $name)
  Write-Host "  + $name"
}

# 加 README
Copy-Item (Join-Path $RepoRoot 'start.md') (Join-Path $PortableRoot 'start.md') -Force

# ---- 4. 打成 zip ----
Write-Host "[4/4] Compress-Archive dist/portable/ ..." -ForegroundColor Cyan
$Version = (Get-Content (Join-Path $RepoRoot 'package.json') | ConvertFrom-Json).version
$ZipPath = Join-Path $DistDir "DeepSeek-Harness-Desktop-$Version-portable.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path $PortableRoot -DestinationPath $ZipPath -CompressionLevel Optimal

$size = (Get-Item $ZipPath).Length
Write-Host ""
Write-Host "DONE. 产物：" -ForegroundColor Green
Write-Host "  $ZipPath ($([math]::Round($size/1MB, 2)) MB)"
Write-Host ""
Write-Host "使用：" -ForegroundColor Cyan
Write-Host "  解压到任意目录 -> 双击 dsh-desktop.exe 启动"
Write-Host "  要求：PATH 含 dsh 命令（npm i -g @deepseek-ai/dsh）"
