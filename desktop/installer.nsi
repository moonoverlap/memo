; 포켓 메모 설치 프로그램 (관리자 권한 없이 사용자 폴더에 설치)
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define APPID "com.moonoverlap.pocketmemo"
!define DISPLAY "포켓 메모"
!define EXE "PocketMemo.exe"
!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"

Name "${DISPLAY}"
OutFile "dist\PocketMemo-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\PocketMemo"
RequestExecutionLevel user
ShowInstDetails nevershow
ShowUninstDetails nevershow
BrandingText "${DISPLAY} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1042 "ProductName" "${DISPLAY}"
VIAddVersionKey /LANG=1042 "FileDescription" "${DISPLAY} 설치"
VIAddVersionKey /LANG=1042 "CompanyName" "moonoverlap"
VIAddVersionKey /LANG=1042 "LegalCopyright" "moonoverlap"
VIAddVersionKey /LANG=1042 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1042 "ProductVersion" "${VERSION}"

!addplugindir /x86-unicode "${RESDIR}\plugins\x86-unicode"
!include "MUI2.nsh"

!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "포켓 메모 바로 실행"
!define MUI_FINISHPAGE_TITLE "설치가 끝났어요"
!define MUI_FINISHPAGE_TEXT "바탕화면과 시작 메뉴에 ‘포켓 메모’ 아이콘을 만들었어요.$\r$\n$\r$\n메모를 열고 [띄우기]를 누르면 메모가 스티커처럼 따로 뜨고, 메모 창 위쪽의 핀을 누르면 항상 위에 고정돼요."

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"

Section "Install"
  ; 실행 중이면 닫고 설치 (띄운 메모는 다음 실행 때 그대로 다시 열림)
  nsExec::Exec 'taskkill /F /T /IM ${EXE}'
  Sleep 800

  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "dist\win-unpacked\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortcut "$DESKTOP\${DISPLAY}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  WinShell::SetLnkAUMI "$DESKTOP\${DISPLAY}.lnk" "${APPID}"
  CreateShortcut "$SMPROGRAMS\${DISPLAY}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  WinShell::SetLnkAUMI "$SMPROGRAMS\${DISPLAY}.lnk" "${APPID}"

  WriteRegStr HKCU "${UNKEY}" "DisplayName" "${DISPLAY}"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "moonoverlap"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNKEY}" "EstimatedSize" 330000
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /T /IM ${EXE}'
  Sleep 800
  WinShell::UninstAppUserModelId "${APPID}"
  Delete "$DESKTOP\${DISPLAY}.lnk"
  Delete "$SMPROGRAMS\${DISPLAY}.lnk"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APPID}"
  DeleteRegKey HKCU "${UNKEY}"
  RMDir /r "$INSTDIR"
SectionEnd
