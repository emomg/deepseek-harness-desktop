; DeepSeek Harness Desktop - Windows ��װ�ű� (NSIS 3)
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "StrFunc.nsh"
${Using:StrFunc} StrStr
${Using:StrFunc} StrRep
${Using:StrFunc} UnStrRep

!define APP_NAME "DeepSeek Harness Pro"
!define APP_EXE "dsh-desktop.exe"
!define APP_VERSION "1.0.0-pro"
!define APP_ID "com.deepseek-harness.desktop.pro"
!define INST_DIR "$LOCALAPPDATA\Programs\DeepSeek Harness Pro"

Name "${APP_NAME}"
!ifndef SETUP_NAME
  !define SETUP_NAME "DeepSeek-Harness-Desktop-Setup-${APP_VERSION}.exe"
!endif
OutFile "${SETUP_NAME}"
InstallDir "${INST_DIR}"
RequestExecutionLevel user
VIProductVersion "1.0.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "DeepSeek Harness Desktop"
VIAddVersionKey /LANG=2052 "FileDescription" "DeepSeek Harness ����ͻ��˰�װ����"
VIAddVersionKey /LANG=2052 "FileVersion" "1.0.0"
VIAddVersionKey /LANG=2052 "ProductVersion" "1.0.0"
VIAddVersionKey /LANG=2052 "LegalCopyright" "Copyright (c) 2026 DeepSeek (MIT)"

!define MUI_ICON "..\apps\desktop\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\apps\desktop\src-tauri\icons\icon.ico"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!ifdef RUNTIME_DIR
  !insertmacro MUI_PAGE_COMPONENTS
!endif
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "�������� DeepSeek Harness"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "������" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "build\${APP_EXE}"
  ; WebView2Loader.dll��GNU �����������Ķ�̬������������ exe ͬĿ¼��
  File "build\WebView2Loader.dll"
  ; 专业版 3 个插件全装（dsh-pro + dsh-files + dsh-plugin-image-input）
  ; lite/full 版只装 dsh-files + dsh-plugin-image-input（不含 dsh-pro）
  ; -full 版：plugins 目录含 node_modules（装完即用）
  SetOutPath "$INSTDIR\plugins"
  File /r "build\plugins\*.*"
  ; �԰�����װ������ Node.js + dsh ����ʱһ��װ�루makensis -DRUNTIME_DIR=... ʱ���ã�
  !ifdef RUNTIME_DIR
    SetOutPath "$INSTDIR\runtime"
    File /r "${RUNTIME_DIR}\*.*"
  !endif
  SetOutPath "$INSTDIR"
  ; WebView2 Runtime ��飺ȱʧ�����������������Ĭ��װ
  File "build\MicrosoftEdgewebview2Setup.exe"
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" +2
  Goto webview2_ok
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" +2
  Goto webview2_ok
  DetailPrint "δ��⵽ WebView2 Runtime�����ھ�Ĭ��װ��Լ 1 ���ӣ�..."
  ExecWait '"$INSTDIR\MicrosoftEdgewebview2Setup.exe" /silent /install'
  Delete "$INSTDIR\MicrosoftEdgewebview2Setup.exe"
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" webview2_failed
  Goto webview2_ok
webview2_failed:
  MessageBox MB_ICONEXCLAMATION|MB_OK "δ���Զ���װ WebView2 Runtime��Ӧ�ÿ����޷����������Ժ��ֶ���װ��https://developer.microsoft.com/microsoft-edge/webview2/"
webview2_ok:
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\DeepSeek Harness"
  CreateShortcut "$SMPROGRAMS\DeepSeek Harness\DeepSeek Harness.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\DeepSeek Harness\ж�� DeepSeek Harness.lnk" "$INSTDIR\Uninstall.exe"
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

!ifdef RUNTIME_DIR
Section "������ Node.js ���ӵ� PATH����ѡ���Ƽ���" SecNodePath
  SectionIn 1
  ; ϵͳ���� node ������������Ӱ���û����л���
  nsExec::ExecToStack 'where node'
  Pop $0
  Pop $1
  StrCmp $0 "0" node_existing
  ReadRegStr $2 HKCU "Environment" "Path"
  ${StrStr} $3 $2 "$INSTDIR\runtime"
  StrCmp $3 "" node_add
  DetailPrint "�û� PATH �Ѱ������� Node.js Ŀ¼"
  Goto node_done
node_add:
  StrCmp $2 "" node_path_new
  StrCpy $2 "$2;$INSTDIR\runtime"
  Goto node_write
node_path_new:
  StrCpy $2 "$INSTDIR\runtime"
node_write:
  WriteRegExpandStr HKCU "Environment" "Path" "$2"
  DetailPrint "�ѽ����� Node.js Ŀ¼���ӵ��û� PATH��$INSTDIR\runtime��"
  System::Call 'user32.dll::SendMessageTimeoutW(i 0xFFFF, i 0x001A, i 0, w "Environment", i 0x0002, i 5000, *i r0)'
  Goto node_done
node_existing:
  DetailPrint "��⵽ϵͳ���� Node.js������ PATH ���ã������ͻ��"
node_done:
SectionEnd
!endif

Section "Uninstall"
  ; ���û� PATH ���Ƴ����� Node.js Ŀ¼���� -full �԰��������ӹ���
  !ifdef RUNTIME_DIR
    ReadRegStr $1 HKCU "Environment" "Path"
    StrCmp $1 "" path_cleanup_done
    ${UnStrRep} $1 $1 ";$INSTDIR\runtime" ""
    ${UnStrRep} $1 $1 "$INSTDIR\runtime;" ""
    WriteRegExpandStr HKCU "Environment" "Path" "$1"
    System::Call 'user32.dll::SendMessageTimeoutW(i 0xFFFF, i 0x001A, i 0, w "Environment", i 0x0002, i 5000, *i r0)'
  path_cleanup_done:
  !endif
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\MicrosoftEdgewebview2Setup.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR\runtime"
  RMDir /r "$INSTDIR\plugins"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\DeepSeek Harness\DeepSeek Harness.lnk"
  Delete "$SMPROGRAMS\DeepSeek Harness\ж�� DeepSeek Harness.lnk"
  RMDir "$SMPROGRAMS\DeepSeek Harness"
  Delete "$DESKTOP\DeepSeek Harness.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
SectionEnd