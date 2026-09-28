/* =========================================================================
   Service Worker — кэширует статику для offline-работы PWA
   ========================================================================= */
var CACHE = 'wbconf-pwa-v1';
var ASSETS = [
  './',
  './index.html',
  './css/mobile.css',
  './js/emblem.js',
  './js/engine.js',
  './js/mobile.js',
  './data/catalog.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* предзагрузка статики при установке */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* очистка старых кэшей */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* запросы: cache-first для статики, network-first для изображений */
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  var path = url.pathname;

  /* изображения каталога — network-first с fallback на кэш */
  if (path.indexOf('/assets/img/') !== -1 || path.indexOf('/icons/') !== -1) {
    e.respondWith(
      fetch(e.request).then(function (r) {
        var clone = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        return r;
      }).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }

  /* всё остальное — cache-first */
  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (resp) {
        var clone = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        return resp;
      });
    })
  );
});
