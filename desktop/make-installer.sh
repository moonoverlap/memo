#!/usr/bin/env bash
# dist/win-unpacked → dist/PocketMemo-Setup-<버전>.exe (Linux에서 NSIS로 바로 만듦, wine 불필요)
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(node -p "require('./package.json').version")
NSISDIR=$(ls -d ~/.cache/electron-builder/nsis-3.*/nsis-3.* | head -1)
RESDIR=$(ls -d ~/.cache/electron-builder/nsis-resources-*/nsis-resources-* | head -1)
# 한글 스크립트는 BOM 붙인 UTF-8로 넘김
printf '\xEF\xBB\xBF' > /tmp/pocketmemo-installer.nsi
cat installer.nsi >> /tmp/pocketmemo-installer.nsi
cp /tmp/pocketmemo-installer.nsi ./.installer.build.nsi
NSISDIR="$NSISDIR" "$NSISDIR/linux/makensis" -V2 -INPUTCHARSET UTF8 \
  -DVERSION="$VERSION" -DRESDIR="$RESDIR" ./.installer.build.nsi
rm -f ./.installer.build.nsi
ls -la "dist/PocketMemo-Setup-$VERSION.exe"
