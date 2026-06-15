const CACHE_NAME = 'spa-seo-gateway-pwa-v1'

globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim())
})

globalThis.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {})
          return response
        })
        .catch(() =>
          // 오프라인 내비 폴백 — 등록 scope 루트(데모 '/', 임베드 '/admin/ui/')의 캐시된 셸.
          caches.match(request).then((cached) => cached || caches.match(globalThis.registration.scope))
        )
    )
  }
})
