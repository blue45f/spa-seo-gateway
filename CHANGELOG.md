# Changelog

날짜는 한국 시간(KST). 모든 커밋은 [GitHub history](https://github.com/blue45f/spa-seo-gateway/commits/main) 참고.

## v1.10.0 — 2026-04-27

per-site / per-tenant 상세 + routes 인라인 편집 GUI 추가. Sites/Tenants 목록의 ID 를 클릭하면 상세 페이지로 이동, 메타데이터 + routes 한 화면에서 편집/저장.

### Added
- **`/admin/ui/sites/:id`** (CMS) — `pages/SiteDetail.tsx`:
  - 메타데이터 (name/origin/webhook/enabled) 인라인 편집
  - 사이트별 routes 추가/삭제/드래그 리오더/필터/셀 단위 편집
  - ⌘/Ctrl + S 저장, [목록으로] 링크
- **`/admin/ui/tenants/:id`** (SaaS) — `pages/TenantDetail.tsx`:
  - 메타데이터 (name/origin/plan/enabled) 인라인 편집
  - **API key 회전 버튼** — confirm 후 `crypto.getRandomValues` 로 새 키 발급 + 토스트 안내 (저장 전엔 미적용)
  - [복사] 버튼 (clipboard) + 마스킹 없이 전체 표시 (관리자 화면이므로)
  - 테넌트별 routes 인라인 편집
- **`components/RoutesEditor.tsx`** — 글로벌 Routes / SiteDetail / TenantDetail 가 공유하는 controlled component. 드래그 리오더, 필터, 추가/삭제/셀 편집을 한 곳에서 정의.
- Sites/Tenants 목록의 ID 컬럼이 상세 페이지로 이동하는 라우터 링크.
- 7건 신규 테스트 (`SiteDetail` 3건, `TenantDetail` 4건) — load/notFound/save POST/apiKey rotation.

### Changed
- 기존 `pages/Routes.tsx` 의 routes 테이블 인라인 코드를 `RoutesEditor` 호출로 교체. 동작/단축키/UX 동일.

### Tests
- 159 server + 124 frontend = **283 passing** (이전 276 + 7).

### Bumps
- admin-ui → 1.10.0 (frontend SPA + plugin 변경)

## v1.9.0 — 2026-04-27

CMS / SaaS 모드 전용 GUI 추가 — 단일 사이트 관리에 한정되어 있던 admin UI 가 다중 사이트 / 다중 테넌트도 직접 관리 가능.

### Added
- **Sites 탭** (CMS 모드 전용) — `/admin/ui/sites`:
  - 사이트 목록, +추가/편집/삭제 모달 폼 (id/name/origin/webhook/enabled)
  - 행별 [URL 무효화] / [Sitemap 워밍] / [편집] / [삭제] 액션
  - 백엔드 endpoint: `/admin/api/sites` (GET/POST), `/admin/api/sites/:id` (DELETE), `/admin/api/sites/:id/cache/invalidate`, `/admin/api/sites/:id/warm`
- **Tenants 탭** (SaaS 모드 전용) — `/admin/ui/tenants`:
  - 테넌트 목록, +추가/편집/삭제 모달 폼 (id/name/origin/apiKey/plan/enabled)
  - **API key 자동 생성** (`crypto.getRandomValues`, `tk_live_<40 hex>`) + 수동 [생성] 버튼
  - 마스킹 표시 + [복사] 버튼 → 클립보드, plan pill (free/pro/enterprise 색상 구분)
- **Mode-conditional nav 시스템** — `nav.ts` 의 `modes?: GatewayMode[]` 필드로 사이드바 / router / cmd palette 가 `publicInfo.mode` 기준 자동 필터.
  - cms 모드 → Sites 만, saas 모드 → Tenants 만 노출. render-only / proxy 모드에선 둘 다 숨김.
- **`Modal` 공용 컴포넌트**: Sites/Tenants form 공유, ESC + backdrop 닫기, size variant.
- **store.publicInfo**: zustand 로 publicInfo 글로벌화. Layout 이 한 번 fetch 후 모든 컴포넌트가 read.

### Tests
- 신규 18건 (frontend 117 / server 159 = **276 통과**):
  - `lib/nav`: 7건 — 16탭 카운트, modes 필드, visibleForMode 분기, mode-filter i18n
  - `pages/Sites`: 4건 — 목록/+추가/저장 POST/삭제 confirm
  - `pages/Tenants`: 5건 — `generateApiKey` 형식/유일성, 마스킹, 자동/재생성, 저장 POST
  - `components/Sidebar`: 2건 — mode-conditional 렌더

### Fixed
- **CMS / multi-tenant 가 admin-ui 쿠키를 받지 않던 문제**: 두 패키지의 `guardAdmin` 이 `x-admin-token` 헤더만 검사해 admin UI 의 쿠키 로그인 후 사이트/테넌트 CRUD 가 401. 이제 `seo-admin` httpOnly 쿠키도 동등하게 허용. 헤더 토큰은 legacy 호환으로 유지.

### Bumps
- core / admin-ui / multi-tenant / cms → 1.9.0

## v1.8.1 — 2026-04-27

### Fixed
- **SPA fallback 500 → 200**: `staticPlugin` 의 `decorateReply: false` 와 `reply.sendFile` 호출이 충돌해 `/admin/ui/<deep-link>` 직접 접근 시 500 이 발생. `readFile` 로 직접 본문을 응답하도록 변경.

### Added
- **SPA hosting 통합 테스트 11건** (`tests/admin-ui-spa.test.ts`):
  - public/ 빌드 산출물 존재 검증, index.html 의 React root + asset 경로 패턴 검사
  - `/admin/ui` 리다이렉트, `/admin/ui/` 200 + HTML, deep-link SPA fallback (4종 경로)
  - hashed JS/CSS 자산 200 + 정확한 content-type, 존재하지 않는 자산은 404
  - `/admin/api/public/info` 인증 없이 동작, `/admin/api/whoami` 미인증 보고
- 실제 게이트웨이 부팅 + curl 검증 완료: 로그인 쿠키, `/admin/api/site`, `/admin/api/audit/verify` 모두 정상.

### Internal
- 159 server + 99 frontend = **258 테스트 통과**, 10 패키지 빌드 green.

## v1.8.0 — 2026-04-27

🎉 **메이저 아키텍처 변경**: Admin UI 를 Alpine.js + Tailwind CDN 단일 HTML 에서 Vite + React 19 + TypeScript 기반 정식 SPA 로 전면 재작성. 백엔드(Fastify 플러그인) 와 프론트엔드가 패키지 수준에서 분리됨.

### Added
- **`apps/admin-frontend`** (신규 워크스페이스): Vite 8 + React 19 + Tailwind v4 + react-router 7 + Zustand 5 기반 admin SPA. `pnpm --filter @spa-seo-gateway/admin-frontend run dev` 로 별도 dev server 가능.
- **vitest + @testing-library/react 99건** 신규 프론트엔드 테스트:
  - `lib/`: api · i18n · metrics parser · format · store · nav (44건)
  - `components/`: Sidebar · CommandPalette · ToastContainer · AuthGate (16건)
  - `pages/`: Welcome · Dashboard · Routes · Cache · Warm · RenderTest · Metrics · Lighthouse · VisualDiff · AiSchema · AuditLog · ApiExplorer · Library · Help (39건)
- **모든 14개 탭 100% 포팅** — 디테일 누락 없이 동등 기능:
  - 사이드바 + 14탭 라우팅, command palette (⌘/Ctrl+K), shortcuts modal (?), 첫 방문 투어
  - 다크모드 (FOUC 방지 inline script + class strategy), KO/EN i18n
  - 쿠키 기반 인증 + AuthGate 컴포넌트, 글로벌 토스트 시스템
  - 라우트 드래그 리오더, ⌘S 저장, 라우트 필터
  - Prometheus 메트릭 파싱 + 5초 자동 갱신, p50/p95/p99 히스토그램
  - Visual diff baseline 모드 (auto/create/compare), AI schema (Anthropic + OpenAI 양쪽 가이드), audit chain 검증

### Changed
- **`packages/admin-ui`** 는 Fastify 플러그인 + 빌드된 SPA 호스팅 역할로 슬림화 — Alpine.js 단일 HTML 제거.
- 빌드 파이프라인: `admin-ui` 의 build 가 `admin-frontend` 의 Vite build 를 먼저 실행, 산출물을 `packages/admin-ui/public/` 로 자동 배치 (npm publish 그대로 호환).
- `BrowserRouter basename` 을 런타임에 자동 감지 — 게이트웨이 임베드 (`/admin/ui`) 와 정적 데모 (`/`) 모두 지원.
- `apps/demo` 의 build script 가 새 Vite 산출물을 복사하고 base 경로를 재작성 + 알림 배너 주입.
- 루트 `pnpm test` 가 server tests 와 frontend tests 둘 다 실행하도록 갱신.
- staticPlugin 의 wildcard 를 비활성화하고 명시적 SPA fallback 라우트로 `/admin/ui/<path>` 직접 접근에서도 client router 가 해석 가능.

### Internal
- 10 패키지 빌드 green · server 148/148 · frontend 99/99 = **총 247 테스트 통과**.
- React 19, Vite 8, Tailwind v4, vitest 4.1, react-router 7 — 모두 최신 안정 버전.

### Migration
- 기존 `@heejun/spa-seo-gateway-admin-ui` 사용자: 변경 없음 — `registerAdminUI(app)` API 그대로. 내부 구현만 React SPA 로 교체됨.
- 정적 자산 경로가 hash-suffixed 로 바뀜 (`/admin/ui/assets/index-<hash>.js`) — CSP / proxy 설정 시 `/admin/ui/assets/*` 허용 필요.

## v1.7.2 — 2026-04-27

OpenAI-compatible 어댑터 패키지 추가 — Anthropic 자매. resume 프로젝트의 multi-provider 패턴 참고.

### Added
- **`@heejun/spa-seo-gateway-openai`** (신규 패키지): OpenAI-compatible `chat/completions` 엔드포인트 어댑터.
  - 동일 코드로 OpenAI / Groq / OpenRouter / Together AI / Ollama / LM Studio 모두 사용 가능
  - SDK 의존 없음 — `fetch` 만 사용 (Node 18+ / 모던 브라우저)
  - 로컬 엔드포인트 (Ollama 등) 는 apiKey 불필요 — 자동 감지
  - 환경변수 `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` 자동 인식
- **단위 테스트 20건** (총 148건): pure 헬퍼 + 어댑터 통합 (인증 헤더, 엔드포인트, model 전달, error handling, maxSuggestions)

### Internal
- 9 → 10 패키지, 모든 빌드 green.
- vitest config + 루트 tsconfig 에 openai alias 추가.

## v1.7.1 — 2026-04-27

마감 작업 — 사용자 가시 영역 갱신 + 어댑터 테스트 보강. 코어 동작 변경 없음.

### Added
- **Anthropic 어댑터에 `client` 옵션** — 사용자 정의 SDK 인스턴스 주입 가능 (테스트 / 커스텀 retry 정책). `apiKey` 없이도 client 만 주입 가능.
- **Anthropic 어댑터 단위 테스트 17건** — `stripHtml`/`extractJson`/`isValidSuggestion` pure 헬퍼 + adapter integration (총 128건).
- **CLI doctor 점검 항목 2개**: `Audit HMAC`, `Anthropic API key` 환경변수 안내.
- **Migration 가이드** (`docs/MIGRATION-1.7.md`): v1.5 → v1.7 신기능 활성화 방법, breaking change 없음 명시.
- **Helm chart 신규 환경변수**: `audit.hmacSecret`, `ai.anthropic.apiKey/model` — Secret 주입 패턴 통일.
- **Admin UI EN locale**: 신규 3탭 (Visual/AI/Audit) 본문/버튼/필드 모두 i18n 키로 추출, 영어 번역 추가.

### Changed
- `docs/CONFIGURATION.md` — `AUDIT_*`, `ANTHROPIC_*` 환경변수 표 추가, `routes.variants` / `schemaTemplate` 필드 문서화.
- `docs/ARCHITECTURE.md` — v1.6/1.7 모듈 (ab-variants / visual-regression / adapters / audit chain / distributed lock) 설계 결정 섹션 신설.
- `docs/LIBRARY-USAGE.md` — v1.6/1.7 신기능 사용 예시 4개 추가.
- `docs/GETTING-STARTED.md` — admin UI 탭 목록에 Lighthouse/Visual/AI/Audit 추가.

### Internal
- 128개 테스트 통과, 9 패키지 빌드 green.
- CLI bump 1.1.0 → 1.2.0.

## v1.7.0 — 2026-04-27

v1.6.0 의 백엔드 신기능들을 사용자 가시 영역으로 확장 — 어드민 UI 탭 + 단위 테스트 + Anthropic 레퍼런스 어댑터.

### Added
- **어드민 UI 신규 탭 3개**:
  - `Visual Diff` — URL 입력 → 스크린샷 캡처 + baseline 비교 (mode/threshold/fullPage 조절)
  - `AI Schema` — URL 본문 → schema.org JSON-LD 자동 추론 (어댑터 미주입 시 501 가이드)
  - `Audit Log` — HMAC chain 기반 감사 이벤트 테이블 + 무결성 검증 버튼
- **`@heejun/spa-seo-gateway-anthropic`** (신규 패키지): `AiSchemaAdapter` 의 Anthropic Claude 레퍼런스 구현. resume 프로젝트의 `AnthropicProvider` 패턴 참고.
  - `createAnthropicSchemaAdapter({ apiKey, model, maxHtmlChars, maxSuggestions })`
  - 기본 모델 `claude-opus-4-7`, ANTHROPIC_API_KEY 환경변수 자동 인식
  - SYSTEM_PROMPT 가 confidence 0.5 미만 응답 자동 제외
- **단위 테스트 +16건** (총 111건):
  - `tests/ab-variants.test.ts` — selectVariant weight 분포, applyVariant HTML 변형
  - `tests/adapters.test.ts` — AI/Billing/SearchConsole 어댑터 set/get round-trip
  - `tests/audit-chain.test.ts` — recordAudit hash chain, verifyAuditChain 무결성
- **JSDoc 보강**: `selectVariant`, `applyVariant`, `runVisualDiff`, `setAiSchemaAdapter` 등 public API 에 의미·반환·side-effect 명시.

### Changed
- `setAiSchemaAdapter` / `setBillingAdapter` / `setSearchConsoleAdapter` 가 `null` 인자 허용 — 테스트/언마운트에서 명시적 reset 가능.
- README 의 핵심 특징 섹션에 v1.6.0 항목 4종 추가 (A/B variants, visual regression, BYO 어댑터, audit chain).

### Internal
- 신규 패키지 빌드 파이프라인에 추가 — pnpm workspace 가 자동으로 `@heejun/spa-seo-gateway-anthropic` 를 빌드 대상에 포함.
- 모든 테스트 통과 (111/111), 8 패키지 빌드 green.

## v1.6.0 — 2026-04-27

내부 시스템만으로 동작하는 고도화 — 외부 SaaS 의존 없이 게이트웨이 단독으로 A/B 테스트, 시각 회귀, 감사 로그 무결성 검증.

### Added
- **A/B variant 테스트** (`ab-variants`): 같은 URL 에 다른 title/description/og:* 를 weight 비율로 무작위 노출. `route.variants` 에 정의하면 렌더 후 자동 적용. 노출 인덱스는 `x-prerender-variant` 헤더 + `gateway_variant_impressions_total` 메트릭으로 노출되어 GA/Plausible 등 외부 분석과 매칭 가능.
- **Visual regression** (`visual-regression`): 봇 응답 후 풀에서 스크린샷을 캡처해 baseline 과 perceptual diff. percy/chromatic 같은 외부 서비스 없이 단일 게이트웨이에서 회귀 감지. baseline 은 `.data/baselines/` 에 저장.
- **BYO 어댑터 인터페이스** (`adapters`): `AiSchemaAdapter` (OpenAI/Anthropic 등으로 schema.org JSON-LD 추론), `BillingAdapter` (Stripe usage 보고), `SearchConsoleAdapter` (Google/Bing index 상태 조회). core 는 인터페이스만 정의 — 외부 SDK 는 사용자가 주입.
- **Audit chain 무결성**: HMAC-SHA256 + prevHash 체인. `verifyAuditChain()` 으로 변조 여부 즉시 검출. `AUDIT_HMAC_SECRET` 설정 시 모든 이벤트에 서명.
- **Distributed lock** (`withDistributedLock`): Redis SETNX 기반 — 다중 인스턴스 환경에서 동일 URL 중복 워밍 방지. fallback 옵션으로 lock 실패 시 캐시 응답.
- **Per-tenant rate limit** (multi-tenant): `PLAN_LIMITS` (free=100/min, pro=1000/min, enterprise=∞) 기반 429 + retry-after.
- **Helm chart** (`charts/spa-seo-gateway`): K8s 배포용 — Deployment/Service/PVC/Ingress/HPA/ServiceMonitor 템플릿.
- **Admin API endpoint 확장**: `POST /admin/api/visual-diff`, `POST /admin/api/ai/schema`, `GET /admin/api/audit/verify`.

### Changed
- `RouteOverride` 에 `variants` + `schemaTemplate` 필드 추가 (`config.ts`).
- 렌더러가 `optimizeHtml` 후 `applyVariant` 를 호출 — variant 선택 시 `x-prerender-variant` 헤더 부착.

### Internal
- `pixelmatch@7` + `pngjs@7` 추가 (visual diff).
- 95개 테스트 모두 통과 — 신규 모듈은 컴파일/타입 검증으로 회귀 방지.

## v1.1.0 — 2026-04-27

### Added
- **Audit log**: 모든 admin 액션을 메모리 + 파일/웹훅으로 기록. `GET /admin/api/audit` 로 최근 200건 조회.
- **Hot config reload**: `seo-gateway.config.json` 파일 변경 시 routes 자동 적용. `HOT_RELOAD=true` 또는 `SIGHUP`.
- **Cron sitemap warming**: `WARM_CRON_ENABLED=true` + `WARM_CRON_SITEMAP=...` 로 주기적 자동 워밍.
- **CLI 패키지** `@heejun/spa-seo-gateway-cli`: `init` / `doctor` / `render`. 인터랙티브 셋업.
- **정적 자산 URL skip**: 봇이 `.jpg/.css/.woff` 등을 요청하면 204 즉시 응답 (chromium 호출 안 함).
- **이미지 strip 옵션**: `STRIP_IMAGES_FROM_OUTPUT=true` 로 응답 HTML 의 `<img>/<picture>/<link rel=preload>` 제거 (alt 만 보존).
- **확장된 default block 패턴**: 25+ 도메인 (광고/애널리틱스/지원챗/CDN 등).
- **어드민 UI 개편**: 사이드바 9탭 + Welcome (public) + 메트릭 시각화 + API 익스플로러 + 라이브러리 가이드 + FAQ.

### Changed
- 모든 패키지 `@heejun/*` 스코프로 npm 발행.
- 메시징: "사전 렌더링" → "봇 접근 시 실시간 렌더링" 으로 통일 (캐시는 부가 최적화).

### Performance
- 정적 자산 skip — 봇이 `.jpg` 등 요청 시 chromium 풀 사용 안 함 → 풀 공간 절약.
- 이미지 strip — 응답 HTML 크기 30~70% 감소 (이미지 많은 페이지).

## v1.0.0 — 2026-04-27

초기 릴리즈. 8개 커밋으로 다음을 구현:
- Fastify 5 + Puppeteer 24 + isbot + cacheable + opossum 기반 게이트웨이
- 4가지 운영 모드 (render-only / proxy / cms / saas)
- pnpm 모노레포 + 4 패키지 (core / admin-ui / multi-tenant / cms)
- 어드민 UI (Alpine.js + Tailwind 단일 HTML)
- 95개 단위/통합 테스트
- Vercel 데모 배포
- Docker / docker-compose / GitHub Actions CI / husky 9 pre-commit & pre-push
