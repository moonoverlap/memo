# 포켓 메모 for Windows

웹앱(https://moonoverlap.github.io/memo/)을 그대로 띄우는 PC 프로그램.
메모마다 따로 스티커 창을 띄우고, 📌로 항상 위에 고정한다. 메모 내용·동기화는 웹앱이 맡으므로
화면 수정은 웹앱만 고치면 PC 프로그램에도 바로 반영된다. 이 폴더는 프로그램 껍데기만 담고 있다.

빌드 (Linux, wine 불필요)
1. `npm install`
2. `npm run dist` → `dist/PocketMemo-Setup-<버전>.exe`

버전을 올릴 때는 package.json의 version만 바꾸면 된다.
