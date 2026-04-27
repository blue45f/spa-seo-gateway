# spa-seo-gateway

[![npm](https://img.shields.io/npm/v/@heejun/spa-seo-gateway-core?label=%40heejun%2Fspa-seo-gateway-core)](https://www.npmjs.com/package/@heejun/spa-seo-gateway-core) [![tests](https://img.shields.io/badge/tests-283%20passing-brightgreen)](https://github.com/blue45f/spa-seo-gateway/tree/main/tests) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

SPA(React/Vue/Svelte 등) 가 만드는 **동적 콘텐츠를 봇이 요청한 시점에 헤드리스 Chromium 으로 실시간 렌더링** 해 봇에게는 완성된 HTML, 사람에게는 원본 SPA 를 그대로 전달하는 **고성능·범용 다이내믹 렌더링 게이트웨이**. 캐시·SWR·자동 워밍은 부가 최적화 — 본질은 봇 접근 시점의 on-demand 렌더링입니다.

> Google [Dynamic Rendering 가이드](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering) 의 OSS 구현. Rendertron / Prerender.io 의 자리를 대체.

```bash
# npm 으로 라이브러리 설치
pnpm add @heejun/spa-seo-gateway-core @heejun/spa-seo-gateway-admin-ui fastify

# 또는 소스 클론으로 단일 바이너리 운영
git clone https://github.com/blue45f/spa-seo-gateway && cd spa-seo-gateway
pnpm install && pnpm dev
```

---

## 세 가지 운영 모드 (단일 바이너리 / `GATEWAY_MODE` 로 전환)

| 모드 | 용도 | 특징 |
|--|--|--|
| **`render-only`** (기본) / **`proxy`** | 단일 사이트 운영 | 가장 단순. CDN 뒤 또는 자체 프록시 |
| **`cms`** | 한 조직이 여러 사이트 관리 | host 헤더로 사이트 분기. 사이트별 origin/routes/캐시 격리 |
| **`saas`** | 다중 테넌트 (외부 고객 대상) | apiKey 또는 host 로 테넌트 식별. 마스터 admin 이 테넌트 CRUD 관리 |

세 모드 모두 같은 코어를 사용하고, 어드민 UI(`/admin/ui`) 도 모드를 자동 인식합니다.

---

## 핵심 특징

- **고성능 풀**: `puppeteer-cluster` `CONCURRENCY_CONTEXT` 모델 + 자동 재시작 (메모리 누수 방어)
- **2-tier 캐시**: 메모리 LRU + Redis. **Brotli 압축** + **SWR** + **In-flight Dedup**
- **공격적 리소스 차단**: 이미지/폰트/광고 도메인 차단으로 평균 렌더 50–70% 단축
- **품질 게이트**: soft 404 / 빈 페이지 자동 감지 → 짧은 TTL 만 캐싱
- **Circuit breaker**: host 별 (opossum) 실패율 기반 차단
- **SSRF 방어**: DNS resolve 후 사설 IP/loopback 차단 (5분 LRU 캐시)
- **Sitemap 사전 워밍**: 재귀 sitemap-index 파싱 + 동시 N개 워밍
- **임베드 어드민 UI**: Alpine.js + Tailwind. 라우트/캐시/사이트/테넌트 GUI 관리
- **봇 자동 감지**: `isbot` (1,000+ UA 패턴) + 모바일 뷰포트 자동 분기
- **관측성**: Prometheus `/metrics` (host 라벨), `/health`, `/health/deep`
- **A/B variant 테스트** (v1.6.0): 같은 URL 에 다른 title/description weight 비율 노출, `x-prerender-variant` + 인상 메트릭
- **Visual regression** (v1.6.0): pixelmatch 기반 baseline diff — 외부 SaaS 없이 단독 회귀 감지
- **BYO 어댑터** (v1.6.0): AI schema(Anthropic 레퍼런스 포함) / Stripe billing / Search Console 인터페이스
- **Audit chain** (v1.6.0): SHA-256 + HMAC 서명 hash chain — 변조 즉시 검출 (`verifyAuditChain`)

---

## 모노레포 구조 (pnpm workspace)

```
spa-seo-gateway/
├── packages/
│   ├── core/          @heejun/spa-seo-gateway-core         — 엔진 (HTTP 비의존, 18+ 모듈)
│   ├── admin-ui/      @heejun/spa-seo-gateway-admin-ui     — Fastify 플러그인 + Alpine SPA
│   ├── multi-tenant/  @heejun/spa-seo-gateway-multi-tenant — saas 모드 구현
│   ├── cms/           @heejun/spa-seo-gateway-cms          — cms 모드 구현
│   ├── cli/           @heejun/spa-seo-gateway-cli          — init/doctor/render CLI
│   ├── anthropic/     @heejun/spa-seo-gateway-anthropic    — Claude AI schema 어댑터 (옵션)
│   └── openai/        @heejun/spa-seo-gateway-openai       — OpenAI/Groq/Ollama 어댑터 (옵션)
├── apps/
│   ├── gateway/       실행 가능한 단일 바이너리
│   ├── admin-frontend Vite + React 19 + Tailwind v4 admin SPA — admin-ui 가 빌드 산출물을 서빙
│   └── demo/          Vercel 데모용 정적 빌드 (admin-frontend 의 SPA + 배너)
└── docs/                                            — 운영/아키텍처 가이드
```

각 패키지는 npm 발행 가능한 형태로 분리되어 있어 외부 Fastify 앱에서 라이브러리로 import 가능.

---

## 5분 안에 시작

```bash
# 1) 설치 — pnpm 9+ 필요
pnpm install

# 2) 환경 설정
cp .env.example .env
# .env: ORIGIN_URL=https://your-spa.example.com, ADMIN_TOKEN=secret

# 3) 개발 모드
pnpm run dev

# 4) 봇 테스트
curl -A "Googlebot" http://localhost:3000/some/route

# 5) 어드민 UI
open http://localhost:3000/admin/ui
```

자세한 가이드는 [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

---

## 문서 인덱스

| 분류 | 문서 | 내용 |
|--|--|--|
| 시작 | [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) | 설치 → 첫 렌더 → 어드민 |
| 설정 | [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | 모든 env / config 파일 / route override |
| **라이브러리** | **[docs/LIBRARY-USAGE.md](docs/LIBRARY-USAGE.md)** | **외부 프로젝트에서 npm 패키지로 사용 (6 시나리오)** |
| 모드 | [docs/MULTI-TENANT.md](docs/MULTI-TENANT.md) | `saas` 모드 — 외부 고객 대상 SaaS |
| 모드 | [docs/CMS-MODE.md](docs/CMS-MODE.md) | `cms` 모드 — 다중 사이트 운영 |
| 아키텍처 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 설계 결정과 trade-off |
| 동시성 | [docs/CONCURRENCY.md](docs/CONCURRENCY.md) | 풀 / 큐 / dedup / SWR |
| 운영 | [docs/USAGE.md](docs/USAGE.md) | Nginx / Caddy / CDN / K8s 연동 |
| 성능 | [docs/BENCHMARKS.md](docs/BENCHMARKS.md) | 측정 시나리오와 기대 수치 |
| 배포 | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker / K8s / Cloudflare / Nginx |

API 레벨 문서: [packages/core/README.md](packages/core/README.md), [packages/admin-ui/README.md](packages/admin-ui/README.md)

---

## 라이선스

MIT
