/* Service Worker для Мем-шоу
   Стратегия: cache-first с динамическим пополнением кеша.
   - Первый визит: файлы скачиваются и кладутся в кеш.
   - Повторный визит: отдаём из кеша (мгновенно, работает оффлайн).
   При обновлении контента — поднимите версию CACHE, иначе браузер
   будет отдавать старую версию из кеша. */

const CACHE = 'mem-show-v1';

/* Обязательный минимум — если хоть один файл не скачается,
   install провалится и SW не активируется. Поэтому тут только
   то, что точно есть в репозитории. */
const CORE = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Только GET и только same-origin
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Навигационные запросы — отдаём index.html из кеша (оффлайн-оболочка)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Всё остальное — cache-first с пополнением
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        // Не кешируем ошибки и opaque-ответы
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      });
    })
  );
});