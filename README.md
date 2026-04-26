# spa-seo-gateway

SPA(React/Vue/Svelte 등 클라이언트 렌더링 앱)를 검색엔진/봇이 제대로 인덱싱할 수 있도록, 헤드리스 Chromium 으로 페이지를 사전 렌더링해 봇에게는 완성된 HTML 을, 사람에게는 원본 SPA 를 전달하는 **범용 다이내믹 렌더링 게이트웨이** 입니다.

> Google 의 [Dynamic Rendering 가이드](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering)를 그대로 구현한 오픈소스 형태입니다. Rendertron / Prerender.io 의 자리를 대체할 수 있도록 설계되었습니다.

## 핵심 특징

- **범용성**: 어떤 SPA 프레임워크든 URL 만 알면 렌더링. 코드 변경 0%.
- **두 가지 운영 모드**
  - `render-only` — 단순 렌더 API (Nginx/CDN/Edge 가 봇 분기 후 호출)
  - `proxy` — 자체 리버스 프록시. 봇은 렌더, 사람은 원본으로 패스스루
- **고성능 헤드리스 풀**: 직접 작성한 동시성 제한 + 컨텍스트 격리 + 메모리 누수 방지를 위한 자동 재시작
- **2-tier 캐시**: 인메모리 LRU + Redis. 분산 캐시로 멀티 노드 운용 가능
- **Stale-While-Revalidate** + **In-flight Dedup**: 동일 URL 동시 요청은 1번만 렌더, 만료 직후엔 stale 응답 + 백그라운드 갱신
- **공격적 리소스 차단**: 이미지/폰트/미디어/광고/애널리틱스 차단으로 평균 렌더 시간 50–70% 단축
- **봇 자동 감지**: [`isbot`](https://github.com/omrilotan/isbot) (1,000+ 봇 시그니처)
- **관측성 내장**: Prometheus `/metrics`, 헬스체크 `/health`, 관리자 `/admin/*`
- **Docker 일체형**: `docker compose up` 한 번으로 게이트웨이 + Redis 동시 기동

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 에서 ORIGIN_URL 등을 수정

# 3. 개발 모드
npm run dev

# 4. 봇으로 테스트
curl -A "Googlebot" http://localhost:3000/some/spa/route
# → 헤드리스로 렌더된 완성형 HTML

# 5. 사람으로 테스트 (render-only 모드)
curl http://localhost:3000/some/spa/route
# → 204 No Content (앞단 프록시가 SPA 원본을 서빙해야 함)
```

### Docker 로 한 번에

```bash
docker compose up -d
docker compose logs -f gateway
```

## 폴더 구조

```
spa-seo-gateway/
├── src/
│   ├── server.ts        # Fastify 엔트리
│   ├── handlers.ts      # 라우트 (render / proxy / admin / metrics)
│   ├── renderer.ts      # 페이지 렌더링 파이프라인
│   ├── pool.ts          # Puppeteer 브라우저 풀
│   ├── optimize.ts      # 리소스 차단 + HTML 후처리
│   ├── cache.ts         # 메모리/Redis 2-tier + SWR + dedup
│   ├── bot.ts           # 봇 탐지
│   ├── url.ts           # URL 정규화 / 캐시 키 / 호스트 화이트리스트
│   ├── metrics.ts       # Prometheus 메트릭
│   ├── logger.ts        # Pino 구조화 로거
│   └── config.ts        # zod 기반 설정 로더
├── benchmarks/          # autocannon 벤치마크
├── docs/
│   ├── ARCHITECTURE.md
│   ├── USAGE.md
│   └── BENCHMARKS.md
├── Dockerfile
└── docker-compose.yml
```

## 자세한 문서

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 아키텍처와 설계 결정
- [docs/CONCURRENCY.md](docs/CONCURRENCY.md) — 동시 요청 처리 방식 (세마포어, dedup, SWR, puppeteer-cluster 비교)
- [docs/USAGE.md](docs/USAGE.md) — 운영 가이드 (Nginx/Caddy/CDN 연동, 캐시 무효화)
- [docs/BENCHMARKS.md](docs/BENCHMARKS.md) — 성능 측정 방법과 기대 수치

## 라이선스

MIT
