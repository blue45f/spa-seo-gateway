# Changelog

날짜는 한국 시간(KST). 모든 커밋은 [GitHub history](https://github.com/blue45f/spa-seo-gateway/commits/main) 참고.

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
