# 벤치마크

## 측정 환경 (참고치)

| 항목 | 사양 |
|--|--|
| CPU | Apple M2 Pro / AMD Ryzen 7 5800X 동급 |
| RAM | 16GB+ |
| Node | 24 LTS |
| Chromium | 130+ (Puppeteer 24 번들) |
| 대상 SPA | https://example.com (정적, 단순), 일반 React 앱 (중간) |

수치는 **상대값** 으로 보세요. 절대값은 호스트 환경, 대상 SPA 의 무게, 네트워크에 크게 의존합니다.

---

## 시나리오 1 — Hot cache (캐시 HIT 처리량)

같은 URL 을 반복 요청. 메모리 LRU 만 작동.

```bash
npm run bench:cache
# BENCH_CONNECTIONS=200 / BENCH_DURATION=30s
```

| 지표 | 기대치 |
|--|--|
| Requests/sec | **8,000–15,000** |
| p50 latency | **2–5 ms** |
| p99 latency | **15–30 ms** |
| CPU | 50–70% (1 core dominant) |
| Memory | 안정 (~150MB + 캐시 사이즈) |

> Fastify + lru-cache 의 한계에 가까운 수치. 대부분의 봇 트래픽은 같은 URL 이 반복되므로 실제 운영에서 핫 패스에 진입.

---

## 시나리오 2 — Cold cache (실제 렌더링 처리량)

매번 새로운 URL. 실제 헤드리스 렌더 시간을 측정.

```bash
npm run bench:cold
# BENCH_CONNECTIONS=8 / 8개 동시 unique URL
```

| 대상 SPA 복잡도 | 평균 렌더 | p95 | 처리량 |
|--|--|--|--|
| 정적 HTML 가까움 (example.com) | **300–500 ms** | 700 ms | ~15 req/s |
| 일반 React 앱 (API 1–3개) | **800–1500 ms** | 2.5 s | ~6 req/s |
| 무거운 SPA (다수 API + 차트) | **2–5 s** | 7 s | ~2 req/s |

`POOL_MAX` 와 호스트의 메모리/CPU 가 처리량의 상한입니다.

---

## 시나리오 3 — Mixed (실전 시뮬레이션)

봇 트래픽의 실제 분포: 95% 캐시 히트 + 5% 미스.

```bash
# 60s, 100 conn, 8개 URL 풀에서 랜덤
BENCH_DURATION=60 BENCH_CONNECTIONS=100 \
BENCH_TARGETS=$(printf 'https://www.example.com/posts/%d,' {1..200}) \
npm run bench:cold
```

| 지표 | 기대치 |
|--|--|
| Requests/sec | **3,000–6,000** |
| p50 latency | **5–15 ms** |
| p95 latency | **40–200 ms** |
| p99 latency | **800 ms ~ 2s** (cold miss 분포) |
| 캐시 hit ratio | 95%+ |

---

## 리소스 차단 효과

같은 URL 에 대해 `BLOCK_RESOURCE_TYPES` 변경:

| 차단 설정 | 평균 렌더 시간 | 네트워크 트래픽 |
|--|--|--|
| 차단 없음 | 100% (기준) | 100% |
| `image,media` | 60–70% | 30–50% |
| `image,media,font` (기본) | **45–60%** | **20–35%** |
| `image,media,font,stylesheet` | 35–50% | 15–25% |

stylesheet 차단은 layout 의존 사이트에서 문제 발생 가능. 기본값 권장.

---

## 다른 솔루션과의 비교

| 솔루션 | 라이선스 | 자체 호스팅 | 캐시 | 동시성 | 운영 이슈 |
|--|--|--|--|--|--|
| **spa-seo-gateway (본 프로젝트)** | MIT | ✅ | 메모리 + Redis + SWR | 풀 + 슬롯 세마포어 | — |
| Rendertron (Google) | Apache 2 | ✅ | 메모리만 (App Engine 캐시 의존) | App Engine 인스턴스 | **2022년 이후 유지보수 중단** |
| Prerender.io OSS | MIT | ✅ | 플러그인 (S3, FS, MongoDB 등) | 단일 큐 | 자체 호스팅 시 캐시/스케일 직접 구현 필요 |
| Prerender.io SaaS | 유료 | ❌ | ✅ | 자동 | 월 $90~ |
| Next.js / Nuxt SSR | — | ✅ | 프레임워크 종속 | — | SPA 가 아닌 새 앱으로 바꿔야 함 |

본 프로젝트는 Rendertron 의 단순함 + Prerender.io 의 캐시/SWR 을 결합한 형태입니다.

---

## 튜닝 가이드

### 처리량을 더 올리고 싶다면

1. `POOL_MAX` 를 CPU 코어 × 2 까지 점진적으로 증가
2. `MEMORY_CACHE_MAX_BYTES` 를 가용 RAM 의 30% 수준까지
3. Redis 활성 → 다중 노드 캐시 공유
4. `BLOCK_RESOURCE_TYPES` 에 `stylesheet` 추가 (layout 검증 후)
5. `WAIT_UNTIL=domcontentloaded` + `WAIT_PRERENDER_READY=true` (SPA 가 명시 시그널 노출하는 경우)

### 안정성을 더 올리고 싶다면

1. `MAX_REQUESTS_PER_BROWSER` 를 200~500 으로 낮춤 (메모리 누수 위험 감소)
2. `PAGE_TIMEOUT_MS` 를 줄여 hung 페이지 빠르게 폐기
3. K8s pod replica 2+ 로 redundancy

---

## 측정 방법

### 1. 로컬 실행 + 부하 테스트

```bash
# 터미널 1
npm run dev

# 터미널 2
BENCH_TARGET="https://www.your-spa.example.com/" \
BENCH_CONNECTIONS=100 BENCH_DURATION=30 \
npm run bench:cache
```

### 2. Docker + Redis 로 분산 시뮬레이션

```bash
docker compose up -d
sleep 10  # Chromium 워밍업
BENCH_URL=http://localhost:3000/ \
BENCH_TARGET=https://your-spa.example.com/ \
BENCH_CONNECTIONS=200 BENCH_DURATION=60 \
npm run bench:cache
```

### 3. Lighthouse / WebPageTest 로 SEO 품질 검증

렌더 결과물의 SEO 품질도 별도 검증:

```bash
# 봇 UA 로 직접 fetch
curl -A "Googlebot" http://localhost:3000/?_render_target=https://your-spa.com > out.html

# Lighthouse SEO 카테고리 점검
npx lighthouse file://$(pwd)/out.html --only-categories=seo
```

---

## CPU / 메모리 프로파일링

```bash
# CPU 프로파일
NODE_OPTIONS="--cpu-prof --cpu-prof-interval=100" npm start

# 힙 스냅샷 (운영 중)
kill -SIGUSR2 $(pidof node)  # heapsnapshot 파일 생성
```

Chrome DevTools 로 `.cpuprofile` / `.heapsnapshot` 분석.
