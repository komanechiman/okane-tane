// 最低限のオフライン対応：アプリ本体をキャッシュし、ネットワーク優先で更新する
const CACHE = 'okane-tane-v1';
const ASSETS = [
  './', './index.html', './style.css', './manifest.json', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png',
  './js/domain/random.js', './js/domain/baskets.js', './js/domain/simulate.js',
  './js/storage.js', './js/chart.js', './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
