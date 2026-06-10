/* eslint-disable no-undef */
const CACHE_NAME = 'spa-seo-gateway-pwa-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
          return response;
        })
        .catch(() =>
          // 오프라인 내비 폴백 — 등록 scope 루트(데모 '/', 임베드 '/admin/ui/')의 캐시된 셸.
          caches.match(request).then((cached) => cached || caches.match(self.registration.scope)),
        ),
    );
  }
});
