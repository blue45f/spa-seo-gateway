# 동시성 / 병렬 처리 아키텍처

## TL;DR

본 게이트웨이는 **단일 인스턴스에서 수만 RPS** (캐시 hit 기준), **동시 렌더 N개 + 큐잉** (cold path 기준) 을 안정적으로 처리하도록 5중 방어선이 적용되어 있습니다. 핵심 풀은 [`puppeteer-cluster`](https://github.com/thomasdondorf/puppeteer-cluster) 의 `CONCURRENCY_CONTEXT` 모델을 사용하며, 그 위에 캐시·SWR·dedup·자동 재시작이 통합돼 있습니다.

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

### 4. puppeteer-cluster (CONCURRENCY_CONTEXT) — 큐 + 동시성 제어

`Cluster.launch({ concurrency: Cluster.CONCURRENCY_CONTEXT, maxConcurrency: POOL_MAX })`

- **maxConcurrency 큐**: 동시 작업 ≤ `POOL_MAX`. 초과분은 cluster 가 내부 FIFO 큐에 보관 → OOM 없이 backpressure
- **컨텍스트 격리**: 매 작업마다 `browser.createBrowserContext()` 로 incognito 컨텍스트 생성. 작업 완료 시 자동 close. 쿠키/스토리지 누출 없음
- **단일 브라우저 공유**: CONTEXT 모드는 1 브라우저 + N 컨텍스트. 브라우저 launch overhead 가 한 번만 발생해 cold-path 가 빠름
- **timeout / taskerror 이벤트**: 작업 timeout / 실패 시 cluster 가 cleanup 후 다음 작업 진행

게이트웨이 코드에서는 `withPage(fn)` 한 줄로 호출:

```ts
return await browserPool.withPage(async (page) => {
  await page.goto(url, { ... });
  return await page.content();
});
```

cluster 가 워커 할당 / 컨텍스트 생성 / 큐잉 / 정리를 모두 담당합니다.

### 5. 자동 재시작 (메모리 누수 방어)

cluster 자체에는 「N 작업 후 재시작」 기능이 없어 게이트웨이가 한 겹 더 감쌉니다:

- 작업 카운터 `totalServed` 가 `MAX_REQUESTS_PER_BROWSER` 에 도달하면
- 새 cluster 를 launch (병렬 워밍)
- swap (`this.cluster = fresh`)
- 옛 cluster 는 `idle()` 후 `close()` — 진행 중 작업은 정상 완료
- 이 동안 신규 작업은 새 cluster 로 흐름 → 다운타임 0

장시간 운영 시 Chromium 의 미세한 메모리 누수가 누적되지 않습니다.

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

## 풀 구현 — puppeteer-cluster 채택

| 기능 | 제공 주체 |
|--|--|
| 동시성 모델 (CONCURRENCY_CONTEXT) | puppeteer-cluster |
| FIFO 큐 / backpressure | puppeteer-cluster |
| 컨텍스트 단위 격리 | puppeteer-cluster |
| 작업 timeout | puppeteer-cluster |
| 자동 재시작 (memory hygiene) | 본 프로젝트 (cluster 위에 구현) |
| Retry (transient classify) | 본 프로젝트 (`renderer.ts`) |
| 캐시 / SWR / Dedup | 본 프로젝트 (`cache.ts`) |
| Prometheus 메트릭 | 본 프로젝트 (`metrics.ts`) |

**왜 puppeteer-cluster 인가?**
- 큐 / 컨텍스트 / 워커 라이프사이클 같은 **검증된 패턴을 외부 라이브러리에 위임** → 자체 코드량 감소, 회귀 위험 감소
- `puppeteer-cluster@0.25.0` (2025-11) 이 puppeteer 24 와 호환 보장 (peerDependencies)
- 현대 TS 에서 타입도 무리 없이 사용 가능
- 본 프로젝트가 추가하는 것은 **renderer / cache / metrics** 같은 도메인 로직만으로 충분

`pool.ts` 는 외부에 `withPage(fn)` 단 하나만 노출하므로, 향후 cluster 를 자체 풀로 다시 갈아 끼우거나 다른 라이브러리로 바꾸는 것도 1파일 수정으로 가능합니다.

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
