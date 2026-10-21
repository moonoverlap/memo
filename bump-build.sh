#!/usr/bin/env bash
# 배포 전에 실행: 화면 버전 표시를 바꿔서 열려 있는 앱·PC 프로그램이 새 버전을 알아채게 함
set -e
cd "$(dirname "$0")"
STAMP=$(TZ=Asia/Seoul date +%Y%m%d-%H%M%S)
sed -i -E "s/(<meta name=\"app-build\" content=\")[^\"]*(\">)/\1${STAMP}\2/" index.html
grep -o '<meta name="app-build" content="[^"]*">' index.html
