const CACHE_NAME = 'bpt-assets-v1'; // При обновлении дизайна меняй v1 на v2, v3 и т.д.

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Установка: кэшируем оболочку сайта
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Активация: чистим старый кэш приложений
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

// Перехват запросов: кэшируем обложки, интерфейс берем из кэша
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Игнорируем аудиофайлы с Dropbox (чтобы не ломать перемотку Range-запросов)
  if (url.href.includes('dropbox.com') && (url.pathname.endsWith('.mp3') || url.search.includes('raw=1'))) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(e.request).then((networkResponse) => {
        // Кэшируем на лету картинки и обложки альбомов
        if (networkResponse && networkResponse.status === 200 && (url.href.includes('dropbox.com') || e.request.destination === 'image')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      });
    })
  );
});