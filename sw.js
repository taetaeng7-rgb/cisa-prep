// sw.js — 오프라인 캐시(앱셸 + 암호문 번들). 평문은 캐시하지 않음(§5.5).
// v2: 네트워크 우선(온라인이면 항상 최신, 오프라인이면 캐시) — 번들 갱신이 즉시 반영되도록
const CACHE = 'cisa-prep-v3';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/app.js', './js/config.js', './js/crypto.js', './js/data.js', './js/engine.js',
  './js/router.js', './js/stats.js', './js/store.js', './js/views.js',
  './data/questions.enc', './data/concepts.enc',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 네트워크 우선: 성공 시 캐시 갱신, 실패(터널·오프라인) 시 캐시 폴백
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
