# dsh-desktop v2 一键打安装包脚本
# 跑法（在仓库根 + Windows + PowerShell 5.1+）:
#   .\scripts\build-installer.ps1                          # 默认打 3 个变体（精简 / full / pro）
#   .\scripts\build-installer.ps1 -Variant lite            # 只打精简版
#   .\scripts\build-installer.ps1 -Variant full            # 只打 full 自包含版
#   .\scripts\build-installer.ps1 -Variant pro             # 只打专业版
#   .\scripts\build-installer.ps1 -SkipCargo                # 跳过 cargo（用已有 dsh-desktop.exe）
#   .\scripts\build-installer.ps1 -Clean                   # 清理 installer/build/ 后再打
#   .\scripts\build-installer.ps1 -RuntimeDir D:\node-v20  full 版用本地 node 运行时
#
# 前置：
#   - Rust 工具链（stable + MSVC 或 GNU），PATH 含 cargo
#   - NSIS 3（https://nsis.sourceforge.io/Download），PATH 含 makensis
#   - 完整 dsh 安装在 PATH（full 版需要）

[CmdletBinding()]
param(
  [ValidateSet('all', 'lite', 'full', 'pro')]
  [string]$Variant = 'all',
  [switch]$SkipCargo,
  [switch]$Clean,
  [string]$RuntimeDir = '',
  [string]$WebView2SetupPath = ''
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$DesktopTauri = Join-Path $RepoRoot 'apps\desktop\src-tauri'
$InstallerDir = Join-Path $RepoRoot 'installer'
$BuildDir = Join-Path $InstallerDir 'build'
$PluginsBuild = Join-Path $BuildDir 'plugins'

# ---- 1. 准备 installer/build/ ----
Write-Host "[1/5] 准备 installer/build/ ..." -ForegroundColor Cyan
if ($Clean -and (Test-Path $BuildDir)) {
  Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
New-Item -ItemType Directory -Force -Path $PluginsBuild | Out-Null

# ---- 2. cargo build (除非跳过) ----
$ExePath = Join-Path $DesktopTauri 'target\release\dsh-desktop.exe'
if ($SkipCargo) {
  if (-not (Test-Path $ExePath)) {
    throw "SkipCargo 但找不到 $ExePath；先 cargo build --release"
  }
  Write-Host "[2/5] SkipCargo 模式，使用已有 $ExePath" -ForegroundColor Yellow
} else {
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "找不到 cargo；装 Rust 工具链（https://rustup.rs/）后重试，或用 -SkipCargo"
  }
  Write-Host "[2/5] cargo build --release (Tauri 端) ..." -ForegroundColor Cyan
  Push-Location $DesktopTauri
  try {
    cargo build --release
    if ($LASTEXITCODE -ne 0) { throw "cargo build 失败 (exit $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
}

# ---- 3. 拷 exe + 插件 ----
Write-Host "[3/5] 拷贝 dsh-desktop.exe + 三个插件 ..." -ForegroundColor Cyan
Copy-Item $ExePath (Join-Path $BuildDir 'dsh-desktop.exe') -Force
$Webview2Loader = Join-Path $DesktopTauri 'target\release\WebView2Loader.dll'
if (Test-Path $Webview2Loader) {
  Copy-Item $Webview2Loader (Join-Path $BuildDir 'WebView2Loader.dll') -Force
}
# WebView2 引导器（可选：缺失时 NSIS 自动跳过内嵌检测安装）
$Webview2Setup = Join-Path $BuildDir 'MicrosoftEdgewebview2Setup.exe'
if (-not (Test-Path $Webview2Setup) -and $WebView2SetupPath -and (Test-Path $WebView2SetupPath)) {
  Copy-Item $WebView2SetupPath $Webview2Setup -Force
}
if (Test-Path $Webview2Setup) {
  Write-Host "  + WebView2 bootstrapper ($([math]::Round((Get-Item $Webview2Setup).Length / 1MB, 1)) MB)"
} else {
  Write-Host "  ! 未找到 MicrosoftEdgewebview2Setup.exe（可用 -WebView2Setup <path> 指定）；安装包将跳过 WebView2 自动安装" -ForegroundColor Yellow
}
# 拷贝三个插件（v2 monorepo 路径）
$Plugins = @(
  @{ Name = 'dsh-pro';                  Source = Join-Path $RepoRoot 'plugins\dsh-pro' },
  @{ Name = 'dsh-files';                Source = Join-Path $RepoRoot 'plugins\dsh-files' },
  @{ Name = 'dsh-plugin-image-input';   Source = Join-Path $RepoRoot 'plugins\dsh-plugin-image-input' }
)
foreach ($p in $Plugins) {
  if (-not (Test-Path $p.Source)) {
    Write-Host "  ! 缺插件 $($p.Name)" -ForegroundColor Yellow
    continue
  }
  $dst = Join-Path $PluginsBuild $p.Name
  Copy-Item -Recurse -Force $p.Source $dst
  Write-Host "  + $($p.Name) -> installer\build\plugins\$($p.Name)"
}

# ---- 4. 选变体 ----
$Variants = switch ($Variant) {
  'all'  { @('lite', 'full', 'pro') }
  'lite' { @('lite') }
  'full' { @('full') }
  'pro'  { @('pro') }
}

# ---- 5. 跑 NSIS ----
if (-not (Get-Command makensis -ErrorAction SilentlyContinue)) {
  throw "找不到 makensis；装 NSIS 3（https://nsis.sourceforge.io/Download）并加入 PATH"
}

Write-Host "[5/5] NSIS 编译 ..." -ForegroundColor Cyan
foreach ($v in $Variants) {
  $script = switch ($v) {
    'lite' { 'installer.nsi' }
    'full' { 'installer.nsi' }
    'pro'  { 'installer-pro.nsi' }
  }
  $extra = @()
  $label = $v
  if ($v -eq 'full') {
    if (-not $RuntimeDir) {
      throw "打 full 版必须 -RuntimeDir <node-rts-path>，例：-RuntimeDir D:\node-v20"
    }
    $extra += "/DRUNTIME_DIR=$RuntimeDir"
    $extra += '/DSETUP_NAME=Setup-2.0.0-full.exe'
    $label = 'full (with runtime)'
  }
  Write-Host "  -> makensis $($extra -join ' ') $script" -ForegroundColor Cyan
  Push-Location $InstallerDir
  try {
    # NSIS 选项（如 /D）必须在脚本名之前才生效
    & makensis @extra $script
    if ($LASTEXITCODE -ne 0) { throw "NSIS 失败 ($script exit $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "DONE. 产物在 installer\ 根目录：" -ForegroundColor Green
Get-ChildItem $InstallerDir -Filter '*-Setup-*.exe' -ErrorAction SilentlyContinue | Select-Object Name, Length | Format-Table -AutoSize
