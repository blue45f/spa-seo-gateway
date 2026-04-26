# 아키텍처

## 패키지 토폴로지 (pnpm workspace)

```
spa-seo-gateway/
├── packages/
│   ├── core/          @spa-seo-gateway/core         — HTTP 비의존 엔진
│   ├── admin-ui/      @spa-seo-gateway/admin-ui     — Fastify 플러그인 (옵션 A)
│   ├── multi-tenant/  @spa-seo-gateway/multi-tenant — Fastify 플러그인 (옵션 B)
│   └── cms/           @spa-seo-gateway/cms          — Fastify 플러그인 (옵션 C)
└── apps/
    └── gateway/       @spa-seo-gateway/gateway      — 실행 바이너리
                                                       (mode 별 플러그인 합성)
```

**의존 그래프 (DAG)**:
```
core ─→ admin-ui ─┐
   │              ├─→ apps/gateway
   ├─→ multi-tenant ┘
   └─→ cms ─────────┘
```

`core` 만 외부 npm 의존성을 가지고, 나머지 패키지는 core 와 fastify 만 의존. workspace 외부에서도 `npm i @spa-seo-gateway/core` 로 자체 게이트웨이를 만들 수 있는 구조.

## 전체 구조

```
                    ┌──────────────────────────────────────────────┐
                    │                  검색엔진 봇                    │
                    │     (Googlebot, Bingbot, Naver Yeti 등)        │
                    └────────────────────┬─────────────────────────┘
                                         │
                                         ▼
       ┌──────────────────────────────────────────────────────────┐
       │           Edge / CDN / Reverse Proxy (선택)                │
       │      (Cloudflare, Fastly, Nginx — 봇 UA 분기 또는 통과)        │
       └─────────────────────┬────────────────────────────────────┘
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
       ┌────────────────────┐   ┌─────────────────────┐
       │   사람(브라우저)         │   │     봇 / 크롤러       │
       │   원본 SPA 그대로        │   │ spa-seo-gateway     │
       └────────────────────┘   └─────────┬───────────┘
                                          │
            ┌─────────────────────────────┼──────────────────────────┐
            │                             ▼                          │
            │           ┌────────────────────────────────┐           │
            │           │     Fastify HTTP Server         │           │
            │           │  + compress + cors + rateLimit  │           │
            │           └─────────────┬──────────────────┘           │
            │                         │                              │
            │       ┌─────────────────┼──────────────────┐           │
            │       ▼                 ▼                  ▼           │
            │  ┌────────┐      ┌─────────────┐    ┌───────────┐      │
            │  │ Bot    │      │ URL 정규화    │   │  Admin    │      │
            │  │ Detect │      │ + 캐시 키       │    │  /metrics │      │
            │  └────────┘      └──────┬──────┘    └───────────┘      │
            │                         │                              │
            │                         ▼                              │
            │       ┌────────────────────────────────────┐           │
            │       │  Cache (Memory LRU → Redis)         │           │
            │       │  + Stale-While-Revalidate           │           │
            │       │  + In-flight Dedup                  │           │
            │       └─────────────────┬──────────────────┘           │
            │                         │ MISS                         │
            │                         ▼                              │
            │       ┌────────────────────────────────────┐           │
            │       │       Browser Pool (Puppeteer)      │           │
            │       │  - 1~N 브라우저, 컨텍스트 단위 격리           │           │
            │       │  - 슬롯 세마포어로 동시성 제한                  │           │
            │       │  - 요청 N 회 후 자동 재시작                   │           │
            │       └─────────────────┬──────────────────┘           │
            │                         │                              │
            │                         ▼                              │
            │       ┌────────────────────────────────────┐           │
            │       │  Render Pipeline                    │           │
            │       │  1) 헤더 포워딩 (lang, cookie, auth)        │           │
            │       │  2) 리소스 차단 (image/media/font/ads)       │           │
            │       │  3) goto + waitUntil (networkidle2)          │           │
            │       │  4) prerenderReady / 셀렉터 보조 대기            │           │
            │       │  5) page.content() + HTML 후처리              │           │
            │       └─────────────────┬──────────────────┘           │
            │                         │                              │
            └─────────────────────────┼──────────────────────────────┘
                                      ▼
                           ┌────────────────────┐
                           │   원본 SPA Origin    │
                           └────────────────────┘
```

## 요청 흐름

### 1. 봇 요청 — 캐시 HIT (Hot path)

```
Request → Fastify
       → Bot Detect (isbot UA) ✓
       → URL 정규화 + 캐시 키 (sha1)
       → Memory LRU: HIT (~50µs)
       → 응답 (gzip/br 압축)
```
지연시간: **5~15ms** (네트워크 제외)

### 2. 봇 요청 — 캐시 MISS (Cold path)

```
Request → Fastify
       → Bot Detect ✓
       → Cache 조회 → MISS
       → In-flight 등록
       → BrowserPool.withPage()
           → 슬롯 세마포어 acquire
           → 라운드로빈으로 가장 한가한 브라우저 선택
           → BrowserContext.create() (격리)
           → page.setRequestInterception (광고/이미지 차단)
           → page.goto(url, networkidle2)
           → waitForFunction(window.prerenderReady)
           → page.content()
           → context.close() (전체 정리)
       → optimizeHtml (메타 추가)
       → cache.set (Memory + Redis)
       → 응답
```
지연시간: **500ms ~ 3s** (대상 SPA 의 복잡도에 따름)

### 3. 봇 요청 — Stale-While-Revalidate

```
Request → Cache 조회 → STALE (TTL 초과, SWR 윈도우 내)
       → stale 즉시 반환 (Hot path 와 동일 지연)
       → 백그라운드에서 재렌더링 → 캐시 갱신
```
지연시간: **5~15ms** + 백그라운드 작업

### 4. 사람 요청 (proxy 모드)

```
Request → Bot Detect ✗
       → fetch(originUrl + path) — Node native undici
       → headers/body 스트림 통과
       → 응답
```

---

## 핵심 설계 결정

### A. 컨텍스트 단위 격리 (puppeteer-cluster CONCURRENCY_CONTEXT)

**선택: 매 요청마다 새 `BrowserContext` (incognito) + Page**

| | 페이지 재사용 (CONCURRENCY_PAGE) | 컨텍스트 격리 (CONCURRENCY_CONTEXT, 본 구현)| 브라우저 격리 (CONCURRENCY_BROWSER) |
|--|--|--|--|
| 속도 | 가장 빠름 | 빠름 (cluster 가 단일 브라우저 공유) | 느림 (매번 launch) |
| 격리 | cookie/storage 잔존 | 완전 격리 | 완전 격리 |
| 메모리 | 천천히 누적 | 작업 후 컨텍스트 close | 매번 회수 |

SEO 렌더링에서는 격리가 중요 (이전 사용자의 인증 쿠키 노출 방지). CONTEXT 가 격리/속도/메모리의 최적 균형입니다.

### B. 동시성 제어 — puppeteer-cluster

`puppeteer-cluster@0.25` 의 `Cluster.launch({ concurrency: CONCURRENCY_CONTEXT, maxConcurrency: POOL_MAX })`:

- **maxConcurrency** = 동시 활성 작업 상한
- 초과 작업은 **cluster 내부 FIFO 큐**가 처리 → backpressure / OOM 방어
- **timeout / taskerror 이벤트**로 hung worker 자동 회수
- 게이트웨이는 한 줄로 호출: `browserPool.withPage(async (page) => { ... })`

### C. 2-tier 캐시 구조

```
요청 → Memory LRU (in-process, ~50µs)
        ↓ miss
      Redis (network, ~500µs)
        ↓ miss
      백엔드 렌더 (500ms+)
```

- **Memory LRU**: 단일 노드 핫 데이터. 압축되지 않은 HTML. 매우 빠름.
- **Redis**: 멀티 노드 공유 캐시. 한 노드가 렌더한 결과를 다른 노드도 사용.
- Redis 가 죽어도 게이트웨이는 정상 동작 (메모리만 사용).

### D. SWR (Stale-While-Revalidate)

봇은 가장 최신 데이터가 필요한 게 아니라 **빨리** 응답받기를 원합니다. SWR 패턴:

```
[캐시 시점] ──── TTL ──── [만료] ──── SWR 윈도우 ──── [완전 만료]
   fresh             stale (즉시 응답 + bg 갱신)        miss (블로킹 렌더)
```

- TTL 기본 24h, SWR 윈도우 1h → 캐시 만료 직후 1시간 동안은 stale 즉시 응답
- 결과: **캐시 히트율 95%+ 유지** + **갱신 지연 0**

### E. In-flight Dedup

동일한 URL 에 대해 100개 봇이 동시에 들어와도 렌더는 1번만:

```ts
const inflight = new Map<string, Promise<CacheEntry>>();

async function dedup(key, fetcher) {
  if (inflight.has(key)) return inflight.get(key)!;  // 기존 Promise 공유
  const p = fetcher().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
```

`<thundering herd>` 시나리오 방지. 봇 폭주 시에도 백엔드는 평온.

### F. 공격적 리소스 차단

`Page.setRequestInterception(true)` 로 다음을 abort:

| 카테고리 | 차단 효과 |
|--|--|
| 이미지/미디어/폰트 | 페이지 가중치 ~70% 감소 |
| 광고/애널리틱스 | 외부 도메인 round-trip 제거 |
| stylesheets | (선택) 더 빠르지만 layout 깨질 수 있음 |

봇은 이미지를 보지 않습니다. 텍스트 콘텐츠와 메타데이터만 필요.

### G. 메모리 누수 방지 — 자동 재시작

Chromium 은 장시간 가동 시 메모리가 천천히 증가합니다. `MAX_REQUESTS_PER_BROWSER` 회 처리 후:

1. 새 요청 받지 않음 (`recycling = true`)
2. 활성 페이지 모두 종료 대기
3. `browser.close()`
4. min 보다 적으면 즉시 새 브라우저 생성

다운타임 0, 풀 사이즈 일정.

### H. Fastify 선택 이유

- Express 보다 ~2배 빠른 ASGI 프레임워크
- 스키마 기반 검증, 직렬화 최적화
- HTTP/2 지원, 스트림 응답
- `@fastify/compress`, `@fastify/rate-limit` 등 1급 플러그인

---

## 보안 고려사항

- **호스트 화이트리스트** (`ALLOWED_HOSTS`): 임의 URL 렌더링 방지 (SSRF 방어)
- **rate limit**: IP 별 분당 요청 수 제한
- **관리자 토큰**: `/admin/*` 은 `X-Admin-Token` 필수
- **`--no-sandbox`**: 컨테이너 내에서만 사용 (호스트는 컨테이너 격리에 의존)
- **헤더 포워딩 화이트리스트**: `accept-language`, `cookie`, `authorization` 만 전달
- **Hop-by-hop 헤더 제거**: 프록시 모드에서 `connection`, `transfer-encoding` 등 제거

---

## 주요 라이브러리

| 라이브러리 | 용도 | 선정 이유 |
|--|--|--|
| [`fastify`](https://fastify.dev) | HTTP 서버 | Express 대비 ~2배 처리량 |
| [`puppeteer`](https://pptr.dev) | 헤드리스 Chromium | 사실상의 표준, 풍부한 API |
| [`puppeteer-cluster`](https://github.com/thomasdondorf/puppeteer-cluster) | 동시성 풀 | CONCURRENCY_CONTEXT 모델, 검증된 큐/timeout/recovery |
| [`isbot`](https://github.com/omrilotan/isbot) | 봇 탐지 | 1,000+ UA 패턴, 매주 업데이트 |
| [`lru-cache`](https://github.com/isaacs/node-lru-cache) | 인메모리 캐시 | size/ttl 기반 LRU, allowStale |
| [`ioredis`](https://github.com/redis/ioredis) | Redis 클라이언트 | 클러스터/센티넬 지원 |
| [`pino`](https://getpino.io) | 구조화 로깅 | Node 에서 가장 빠른 로거 |
| [`prom-client`](https://github.com/siimon/prom-client) | 메트릭 | Prometheus 표준 |
| [`zod`](https://zod.dev) | 설정 검증 | 런타임 타입 안전 |
