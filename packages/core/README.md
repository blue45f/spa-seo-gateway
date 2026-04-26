# @spa-seo-gateway/core

SPA SEO 게이트웨이의 **HTTP 비의존 엔진**. 다른 Fastify 앱에서 라이브러리로 import 해 자체 게이트웨이를 만들 수도 있음.

## 모듈 일람

| 모듈 | 책임 |
|--|--|
| `config` | zod 기반 설정 로더 (env + JSON file). `ConfigSchema`, `config`, `RouteOverride` |
| `runtime-config` | 런타임에 변경 가능한 routes 와 영구화 |
| `bot` | UA + header 기반 봇 탐지 |
| `url` | URL 정규화, cache key, host 화이트리스트, **SSRF DNS 검사** |
| `optimize` | 리소스 차단 (Puppeteer) + HTML 후처리 (canonical / og:url 자동 주입) |
| `quality` | soft 404, 빈 페이지 감지 / 짧은 TTL 추천 |
| `cache` | Memory LRU + Redis (cacheable + @keyv/redis), Brotli 압축, SWR, in-flight dedup |
| `pool` | puppeteer-cluster 기반 브라우저 풀 (CONCURRENCY_CONTEXT) + 자동 재시작 |
| `circuit-breaker` | host 별 opossum 서킷 브레이커 |
| `renderer` | 렌더 파이프라인 (SSRF + breaker + retry + quality + optimize) |
| `prerender-warmer` | sitemap-index 재귀 파싱 + 동시 워밍 |
| `metrics` | Prometheus 메트릭 (per-host duration, cache events, breaker events) |
| `logger` | pino 구조화 로거 |

## 주요 API

### 렌더

```ts
import { render, type RenderInput } from '@spa-seo-gateway/core';

const entry = await render({
  url: 'https://www.example.com/',
  headers: { 'user-agent': 'Googlebot/2.1' },
  route: null,  // 또는 RouteOverride
});
// { body: string, status: number, headers: Record<string,string>, createdAt: number, ttlOverrideMs?: number }
```

`render()` 는 다음을 자동 수행:
1. SSRF DNS 검사
2. host 별 circuit breaker 적용
3. 1회 retry (transient 오류)
4. 풀에서 페이지 획득 → context 격리
5. 리소스 차단 + UA 설정 + 모바일 뷰포트 자동 감지
6. waitUntil + waitSelector + waitMs 적용
7. quality 검사 (soft 404 → status 404, error → 503)
8. canonical/og:url 자동 주입
9. 헤더에 `x-prerender-*` 메타데이터 추가

### 캐시 + SWR + dedup

```ts
import { cacheSwr, cacheKey } from '@spa-seo-gateway/core';

const key = cacheKey('https://...', 'ko', 'site:marketing');  // namespace prefix
const result = await cacheSwr(key, () => render({ url, headers, route }), customTtlMs);
// result.entry, result.fromCache: 'cache' | null, result.stale: boolean
```

### Sitemap warming

```ts
import { warmFromSitemap } from '@spa-seo-gateway/core';

const report = await warmFromSitemap('https://www.example.com/sitemap.xml', {
  max: 1000,
  concurrency: 4,
});
// { sitemap, found, warmed, skipped, errors, durationMs }
```

### 런타임 라우트 변경

```ts
import { setRoutes, getRoutes, persistRoutesToFile, matchRoute } from '@spa-seo-gateway/core';

setRoutes([{ pattern: '^/blog/', ttlMs: 86400000 }]);
const matched = matchRoute('https://www.example.com/blog/abc');  // RouteOverride | null
await persistRoutesToFile();  // seo-gateway.config.json 에 영구 저장
```

### Prometheus 메트릭

```ts
import { registry } from '@spa-seo-gateway/core';

app.get('/metrics', async (_req, reply) => {
  reply.header('content-type', registry.contentType);
  return registry.metrics();
});
```

## 설정

```ts
import { config, ConfigSchema } from '@spa-seo-gateway/core';

console.log(config.renderer.poolMax);   // typed
// ConfigSchema 는 zod schema — JSON Schema 생성 등 활용 가능
```

설정 우선순위: env > seo-gateway.config.json > 기본값.

## 의존성

- `puppeteer` ^24 + `puppeteer-cluster` ^0.25
- `cacheable` + `@cacheable/memory` + `@keyv/redis`
- `isbot`, `normalize-url`, `opossum`, `fast-xml-parser`
- `pino`, `prom-client`, `zod`

## 라이선스

MIT
