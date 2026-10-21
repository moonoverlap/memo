// 포켓 메모 — 오프라인에서도 앱이 열리도록 화면 파일을 보관합니다.
// 메모 데이터(Firebase)는 여기서 다루지 않습니다.
const CACHE = 'pocket-memo-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 로그인·DB 요청은 그대로 통과
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseapp.com')) return;

  // 화면: 새 버전 먼저, 오프라인이면 보관본
  if (req.mode === 'navigate') {
    // 화면은 항상 서버에 새 버전이 있는지 먼저 확인 (오프라인이면 보관본)
    const isApp = /\/memo\/(index\.html)?$/.test(url.pathname);
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          if (isApp && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => (isApp ? caches.match('./index.html') : caches.match(req)))
    );
    return;
  }

  // 아이콘·폰트·Firebase SDK: 보관본 먼저, 뒤에서 새로 받아 갱신
  const cacheable = url.origin === self.location.origin
    || url.hostname === 'www.gstatic.com'
    || url.hostname === 'cdn.jsdelivr.net';
  if (!cacheable) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
