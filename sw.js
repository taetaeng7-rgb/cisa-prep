// sw.js — 오프라인 캐시(앱셸 + 암호문 번들). 평문은 캐시하지 않음(§5.5).
const CACHE = 'cisa-prep-v1';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/app.js', './js/config.js', './js/crypto.js', './js/data.js', './js/engine.js',
  './js/router.js', './js/stats.js', './js/store.js', './js/views.js',
  './data/questions.enc',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 앱셸·번들: 캐시 우선(오프라인), 네트워크 폴백
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => hit)));
});
