const CACHE_NAME = 'bpt-assets-v3';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/config.js',
  './js/db.js',
  './js/auth.js',
  './js/sync.js',
  './js/player.js',
  './js/radar.js',
  './js/ui.js',
  './js/main.js',
];

// Установка: кэшируем оболочку сайта
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Активация: чистим старый кэш
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

// Слушаем сигнал на принудительную активацию обновления
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// Перехват запросов
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Игнорируем аудиофайлы с Dropbox
  if (url.href.includes('dropbox.com') && (url.pathname.endsWith('.mp3') || url.search.includes('raw=1'))) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && (url.href.includes('dropbox.com') || e.request.destination === 'image')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      });
    })
  );
});
