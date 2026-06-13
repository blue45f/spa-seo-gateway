import type { ScopedRoute } from './types'

/**
 * 라우트 편집 상태를 서버 전송용으로 직렬화 — 빈 pattern 행 제거, falsy 옵션 필드 생략.
 * Routes/SiteDetail/TenantDetail 의 저장 경로가 공유하던 동일 블록을 단일화.
 * 반환 타입은 추론에 맡긴다(falsy 필드가 빠진 좁혀진 형태이지 ScopedRoute[] 가 아님).
 */
export function cleanRoutes(routes: ScopedRoute[]) {
  return routes
    .filter((r) => r.pattern)
    .map((r) => ({
      pattern: r.pattern,
      ...(r.ttlMs ? { ttlMs: Number(r.ttlMs) } : {}),
      ...(r.waitUntil ? { waitUntil: r.waitUntil } : {}),
      ...(r.waitSelector ? { waitSelector: r.waitSelector } : {}),
      ...(r.waitMs ? { waitMs: Number(r.waitMs) } : {}),
      ...(r.ignore ? { ignore: true } : {}),
    }))
}
