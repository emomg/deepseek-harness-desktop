; DeepSeek Harness Desktop - Windows 安装脚本 (NSIS 3)
Unicode true
!include "MUI2.nsh"

!define APP_NAME "DeepSeek Harness"
!define APP_EXE "dsh-desktop.exe"
!define APP_VERSION "0.1.0"
!define APP_ID "com.deepseek-harness.desktop"
!define INST_DIR "$LOCALAPPDATA\Programs\DeepSeek Harness"

Name "${APP_NAME}"
!ifndef SETUP_NAME
  !define SETUP_NAME "DeepSeek-Harness-Desktop-Setup-${APP_VERSION}.exe"
!endif
OutFile "${SETUP_NAME}"
InstallDir "${INST_DIR}"
RequestExecutionLevel user
VIProductVersion "0.1.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "DeepSeek Harness Desktop"
VIAddVersionKey /LANG=2052 "FileDescription" "DeepSeek Harness 桌面客户端安装程序"
VIAddVersionKey /LANG=2052 "FileVersion" "0.1.0"
VIAddVersionKey /LANG=2052 "ProductVersion" "0.1.0"
VIAddVersionKey /LANG=2052 "LegalCopyright" "Copyright (c) 2026 DeepSeek (MIT)"

!define MUI_ICON "..\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\src-tauri\icons\icon.ico"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动 DeepSeek Harness"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "主程序" SecMain
  SetOutPath "$INSTDIR"
  File "build\${APP_EXE}"
  ; WebView2Loader.dll（GNU 工具链构建的动态依赖，必须与 exe 同目录）
  File "build\WebView2Loader.dll"
  ; 自包含安装包：把 Node.js + dsh 运行时一并装入（makensis -DRUNTIME_DIR=... 时启用）
  !ifdef RUNTIME_DIR
    SetOutPath "$INSTDIR\runtime"
    File /r "${RUNTIME_DIR}\*.*"
  !endif
  SetOutPath "$INSTDIR"
  ; WebView2 Runtime 检查：缺失则用捆绑的引导器静默安装
  File "build\MicrosoftEdgewebview2Setup.exe"
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" +2
  Goto webview2_ok
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" +2
  Goto webview2_ok
  DetailPrint "未检测到 WebView2 Runtime，正在静默安装（约 1 分钟）..."
  ExecWait '"$INSTDIR\MicrosoftEdgewebview2Setup.exe" /silent /install'
  Delete "$INSTDIR\MicrosoftEdgewebview2Setup.exe"
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" webview2_failed
  Goto webview2_ok
webview2_failed:
  MessageBox MB_ICONEXCLAMATION|MB_OK "未能自动安装 WebView2 Runtime，应用可能无法启动。可稍后手动安装：https://developer.microsoft.com/microsoft-edge/webview2/"
webview2_ok:
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\DeepSeek Harness"
  CreateShortcut "$SMPROGRAMS\DeepSeek Harness\DeepSeek Harness.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\DeepSeek Harness\卸载 DeepSeek Harness.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\DeepSeek Harness.lnk" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher" "DeepSeek"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\MicrosoftEdgewebview2Setup.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR\runtime"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\DeepSeek Harness\DeepSeek Harness.lnk"
  Delete "$SMPROGRAMS\DeepSeek Harness\卸载 DeepSeek Harness.lnk"
  RMDir "$SMPROGRAMS\DeepSeek Harness"
  Delete "$DESKTOP\DeepSeek Harness.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
SectionEnd