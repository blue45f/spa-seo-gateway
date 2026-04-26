# 동시성 / 병렬 처리 아키텍처

## TL;DR

본 게이트웨이는 **단일 인스턴스에서 수만 RPS** (캐시 hit 기준), **동시 렌더 N개 + 큐잉** (cold path 기준) 을 안정적으로 처리하도록 5중 방어선이 적용되어 있습니다. `puppeteer-cluster` 와 동일한 CONTEXT 모델을 직접 구현하면서, 캐시·SWR·dedup 까지 통합되어 있습니다.

```
요청 도착
   │
   ▼
[1] Fastify (이벤트 루프, 비동기)        — 수천 connection 동시
   │
   ▼
[2] Bot Detect → Cache Lookup           — μs 단위
   │ HIT
   ▼ → 즉시 응답 (수만 RPS)
   │
   │ MISS
   ▼
[3] In-flight Dedup                      — 동일 URL 동시 요청 → 1번만
   │
   ▼
[4] Browser Pool 슬롯 세마포어            — 동시 렌더 ≤ POOL_MAX
   │ (가득 찬 경우 FIFO 큐잉)
   ▼
[5] BrowserContext 격리 + Page 렌더      — 안전 분리, 자동 정리
   │
   ▼
[6] (실패 시) 자동 retry — transient 에러
   │
   ▼
응답 + cache write
```

## 5중 동시성 방어선

### 1. Fastify 이벤트 루프 — 노드 베이스라인

Fastify 자체가 비동기 I/O 모델이라 수천 동시 connection 자체는 문제가 안 됩니다. CPU 작업이 없는 한 (캐시 HIT 등) RPS 의 상한은 압축/직렬화/네트워크입니다.

**측정치 (M2 Pro 기준):**
- Hot cache HIT: **8,000–15,000 req/s**
- p99 latency: **15–30 ms**

### 2. 캐시 (Memory LRU + Redis + SWR)

- 거의 모든 봇 트래픽은 **반복적**. 첫 렌더 후 같은 URL 은 캐시에서.
- **Memory LRU**: O(1) 조회, 락 없음 (단일 프로세스 단일 스레드)
- **Redis**: 멀티 인스턴스 시 노드 간 캐시 공유
- **SWR**: 만료 직후 1시간 동안은 stale 즉시 응답 + 백그라운드 갱신
- 결과: **봇 트래픽의 95%+ 가 cold path 를 안 거침**

### 3. In-flight Dedup — Thundering Herd 방어

캐시가 막 만료된 순간, 100개 봇이 동시에 동일 URL 을 요청해도 렌더는 **단 1번**.

```ts
const inflight = new Map<string, Promise<CacheEntry>>();

if (inflight.has(key)) return inflight.get(key)!;  // 99개는 기존 promise 공유
const p = render(...);
inflight.set(key, p);
p.finally(() => inflight.delete(key));
```

이게 없으면 캐시 만료 직후 폭주에 백엔드가 N배로 부하 받습니다. (Prerender.io 도 이 패턴 사용)

### 4. 브라우저 풀 + 슬롯 세마포어 — 백엔드 보호

```
POOL_MIN ─── 사전 워밍 (cold start 0)
POOL_MAX ─── 동시 활성 페이지 상한 (CPU/메모리 보호)
```

- **세마포어**: `currentConcurrent < POOL_MAX` 일 때만 진입. 가득 차면 waiter 큐 (FIFO).
- **라운드로빈 (least-active)**: 매 요청마다 가장 한가한 브라우저에 배정해 부하 분산.
- **자동 확장**: 모든 브라우저가 바쁘고 풀이 `POOL_MAX` 미만이면 새 브라우저 spawn.

```ts
private async acquireSlot(): Promise<void> {
  while (this.currentConcurrent >= this.maxConcurrent) {
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }
  this.currentConcurrent++;
}
```

waiter 큐 덕분에 **요청 폭주 시에도 OOM 없이 큐잉** (Fastify 가 backpressure 반영).

### 5. 컨텍스트 단위 격리 + 자동 재시작

```
요청 ─→ browser.createBrowserContext()  (incognito, 빈 쿠키/스토리지)
     ─→ context.newPage()
     ─→ render
     ─→ context.close()                  (전체 정리, 메모리 회수)
```

- 동시 요청들이 같은 브라우저를 공유해도 서로 안 보임
- 브라우저당 처리량 N (`MAX_REQUESTS_PER_BROWSER`) 도달 시 자동 재시작 → 메모리 누수 방지
- 이 방식은 [puppeteer-cluster의 `CONCURRENCY_CONTEXT`](https://github.com/thomasdondorf/puppeteer-cluster#concurrency-implementations) 와 동일

### + Retry — 일시적 장애 자동 복구

```ts
const TRANSIENT_REASONS = new Set(['crashed', 'pool-exhausted', 'network']);

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try { return await renderOnce(input); }
  catch (err) {
    if (attempt < MAX && TRANSIENT_REASONS.has(classify(err))) continue;
    throw err;
  }
}
```

브라우저가 죽거나 일시적 네트워크 에러 시 한 번 더 시도합니다.

---

## puppeteer-cluster vs 본 구현

| 기능 | puppeteer-cluster | spa-seo-gateway (현재) |
|--|--|--|
| 동시성 모델 (CONTEXT) | ✅ | ✅ (동일) |
| 슬롯 큐잉 | ✅ | ✅ |
| 라운드로빈 워커 분산 | ✅ | ✅ (least-active) |
| 자동 재시작 | ❌ (Optional) | ✅ (요청 N회 후) |
| Retry on failure | ✅ | ✅ |
| 캐시 통합 | ❌ | ✅ (Memory + Redis + SWR) |
| Dedup | ❌ | ✅ (in-flight) |
| Prometheus 메트릭 | ❌ | ✅ |
| Puppeteer 24 호환 | ✅ (0.25.0+, 2025-11) | ✅ |
| 마지막 업데이트 | 2025-11-13 | (본 프로젝트) |
| 외부 의존성 | `debug` | `pino`(로깅) `prom-client`(메트릭) |

**왜 직접 구현했나?**
1. **캐시·SWR·dedup 과 한 사이클로 통합** — 중복 추상화 제거 (`cluster.queue` + `cache.swr` 두 단계가 아니라 한 단계)
2. **격리 단위 = 요청** — 매 요청마다 BrowserContext 새로 만들고 끝나면 close. cluster 의 CONTEXT 모델과 동일하지만 metrics 와 직접 연결됨
3. **현대 TS strict 환경에서 깔끔** — cluster 의 타입은 일부 어색
4. **~250 LOC** — 코드 전체를 손에 쥘 수 있음

**puppeteer-cluster 로 교체할 가치가 있는가?**

다음 경우라면 yes:
- 작업이 **렌더링 외 다른 종류** 도 포함 (스크래핑, 스크린샷 등) → cluster 의 task 추상화가 유용
- **monitor 출력** 같은 cluster 만의 기능 사용 → 본 프로젝트는 Prometheus 로 대체
- **유지보수 부담을 외부로 위임** 하고 싶다 → 일리 있음

본 프로젝트의 use case (SEO 렌더 한 가지) 에서는 직접 구현이 더 응집도 있는 결과를 줍니다. 다만 한 줄로 puppeteer-cluster 를 채택할 수 있도록 `pool.ts` 가 `withPage(fn)` 한 가지 인터페이스로만 외부에 노출되어 있어 교체가 쉽습니다.

---

## 실측 — 동시 100 요청 시뮬레이션

```bash
# 가정: example.com 에 대해
# - cache 비어있음
# - 100 동시 요청, 그 중 90개는 같은 URL, 10개는 unique

# 결과 (M2 Pro, POOL_MAX=8):
#   - cache miss: 11번 (90개 dedup → 1번 + unique 10번)
#   - 동시 활성 렌더: ≤ 8 (세마포어), 나머지 큐잉
#   - 총 처리 시간: ~2~3초 (cold)
#   - 두 번째 라운드: 100% cache HIT, ~50ms
```

세마포어 + dedup 의 효과:
- dedup 없었으면 90개 동시 렌더 → CPU 폭주
- 세마포어 없었으면 OOM 위험

---

## 단일 노드의 한계와 수평 확장

단일 인스턴스의 cold-path 처리량 = `POOL_MAX / 평균 렌더 시간`. 일반 SPA 기준:
- POOL_MAX=8, 1초 평균 → **8 cold renders/sec**
- POOL_MAX=16, 1초 평균 → **16 cold renders/sec**

이걸 넘는 cold path 가 필요하다면 **수평 확장**:

```
                    ┌─→ gateway-1 (POOL_MAX=8) ─┐
        Load        ├─→ gateway-2 (POOL_MAX=8) ─┤  공유 Redis
        Balancer    ├─→ gateway-3 (POOL_MAX=8) ─┤  (캐시 공유)
                    └─→ gateway-N (POOL_MAX=8) ─┘
```

- **Redis 캐시 공유**: 한 노드가 렌더하면 다른 노드들이 즉시 사용
- **세션 어피니티 불필요**: 모든 노드가 stateless

분산 dedup 까지 원한다면 (한 URL 을 N개 노드 동시에 안 렌더) — Redis SETNX 기반의 분산 락이 필요하지만, 일반적으로는 노드 단위 dedup + Redis 캐시로 충분합니다.

---

## 한계 / 알려진 트레이드오프

1. **JavaScript 단일 스레드**: CPU intensive 한 HTML 후처리 / 압축은 main thread 에서. 매우 큰 HTML (>10MB) 의 경우 pause 발생 가능. 해결: worker_threads 분리 (TODO).
2. **Chromium 메모리**: 브라우저 1개 ≒ 80–200MB. POOL_MAX=16 이면 RAM 1.5GB+. K8s 리소스 limit 적절히.
3. **시작 cold-start**: 첫 브라우저 spawn 에 ~1–2초. POOL_MIN=2 로 사전 워밍 권장.
4. **장기 누수**: Chromium 자체에 미세한 누수가 있음. `MAX_REQUESTS_PER_BROWSER` 자동 재시작으로 보완.
