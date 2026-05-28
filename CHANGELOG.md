# Changelog

날짜는 한국 시간(KST). 모든 커밋은 [GitHub history](https://github.com/blue45f/spa-seo-gateway/commits/main) 참고.

## v1.14.2 — 2026-05-28

🔧 **Node 26 전반 일관성 + localStorage 호환성 픽스**.

### Node 26 정렬 (PR #32)
- `ci.yml`: `node-version: 22` → `26` (Dockerfile 과 일치)
- `.nvmrc`: `24` → `26`
- `store.ts`: 직접 `localStorage.{get,set}Item` → `window.localStorage?.{get,set}Item` (Node 26 + happy-dom 환경에서 bare localStorage global undefined)
- 테스트 setup.ts: `window.localStorage` 미노출 환경용 in-memory 폴리필 추가 (happy-dom v20.x + Node 26 호환)
- 테스트 store.test.ts: 동일 이유로 `window.localStorage?.getItem` 로 수정

### Verified
- CI Quality gate 통과 (Node 26)
- 149 admin-frontend tests pass on Node 26 (localStorage polyfill 적용 후)

## v1.14.1 — 2026-05-28

🔒 **보안 패치 + 개발 환경 개선**.

### 보안 패치 (PR #30)
- `pnpm-workspace.yaml` overrides:
  - `path-to-regexp: >=6.3.0` (GHSA-9wv6-86v2-598j HIGH — `@vercel/node` transitive dep, backtracking regex)
  - `uuid: >=11.1.1` (GHSA-w5hq-g745-h8pq MODERATE — `autocannon>hyperid` transitive dep, buffer bounds)
- `pnpm audit` 결과: **0 vulnerabilities**
- `biome.json`: schema `2.4.15` → `2.4.16` (`biome migrate --write`)

### 개발 환경 (이번 스프린트)
- `vitest.workspace.ts` 추가: VS Code Vitest 확장이 gateway + admin-frontend 테스트를 한 탐색창에서 인식
- `.vscode/settings.json` `vitest.workspaceConfig` 참조 파일 실체화

### Verified
- `pnpm audit` — No known vulnerabilities found
- 701 tests pass / biome 0 warnings / typecheck clean

## v1.14.0 — 2026-05-28

📦 **Package 문서 + 에디터 설정 추적**.

### Package README 강화 (PR #29)
- 7개 패키지 (core / admin-ui / cms / multi-tenant / anthropic / openai / cli) 모두에 npm version + license 배지 추가
- `core`, `cms`, `multi-tenant`, `admin-ui` — `## Install` 섹션 추가 (이전 누락)
- shields.io 배지: 공개 npm 패키지 기준 버전 자동 반영

### .vscode 설정 트래킹 (PR #29)
- `.gitignore`: `.vscode/` → `.vscode/*` 로 변경 + `!settings.json` / `!extensions.json` 예외 추가
- `.vscode/settings.json` — biome formatter / formatOnSave / tsdk / vitest workspace 설정 공유
- `.vscode/extensions.json` — biomejs.biome, vitest.explorer, tailwindcss 등 권장 확장 목록

### Verified
- 701 tests pass (552 gateway + 149 admin-frontend)
- 커버리지 98.67% (lines)
- biome 0 warnings

## v1.13.1 — 2026-05-28

🔧 **pnpm 11 + Docker base image 갱신 + branch protection 일관성**.

### pnpm 9 → 11 (PR #27)
- `package.json`: `packageManager: pnpm@11.4.0`, `engines.pnpm: >=11.0.0`. `pnpm.overrides` 제거
- `pnpm-workspace.yaml`: pnpm 10+ `allowBuilds: { esbuild, puppeteer }` (post-install approval), pnpm 11 `minimumReleaseAgeExclude` (@biomejs/* + @vercel/*), `overrides` 통합
- `packages/{anthropic,cli,openai}/package.json`: devDep `@heejun/spa-seo-gateway-core: workspace:*` → `^1.9.0` (외부 publish 시 정상 의존, 내부 monorepo 는 pnpm 이 workspace 우선)
- `Dockerfile`: `corepack prepare pnpm@9.14.4` → `@11.4.0` (3 stages 모두). lockfile v11 호환
- 새 `pnpm-lock.yaml` (v11 format, +796 라인)

### Docker base image (PR #24)
- `node:24-slim` → `node:26-slim` (4 stages). dependabot.yml 의 새 `docker` ecosystem 이 자동 감지한 첫 PR — 인프라 검증 사례

### Branch protection consistency (PR #26)
- `branch-protection.yml` 의 `REQUIRED_CHECKS_JSON` 이 `CodeRabbit` status 를 누락 → workflow 재실행 시 정책 silent downgrade. 3개 (`Quality gate` + `CodeRabbit` + `CodeRabbit review gate`) 모두 유지

### Verified
- `pnpm verify` EXIT=0 — 701 tests / 0 lint warnings
- pnpm 11 lockfile + workspace: \* 해제 후 monorepo 내부 의존 정상
- GitHub API rate limit 5000/h 도달 후 reset 대기 → 자동 머지 (응급 우회 패턴 유지)

## v1.13.0 — 2026-05-28

🧰 **Developer & community baseline + CI 자동화 마무리**.

### Community files
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 (한국어 발췌)
- `.github/CODEOWNERS` — 단독 메인테이너 + 보안 민감 파일 (`url.ts` / `audit.ts` / `distributed-lock.ts`) ownership
- `.github/ISSUE_TEMPLATE/bug_report.yml` — 버전 / 운영 모드 / 재현 / 환경 form
- `.github/ISSUE_TEMPLATE/feature_request.yml` — 문제 / 제안 / 대안 / 영향 범위
- `.github/ISSUE_TEMPLATE/config.yml` — blank 비활성, 보안은 advisory, 일반 질문은 Discussions 로 분기
- `.github/FUNDING.yml` — GitHub Sponsors

### DX
- `.nvmrc` = `24` — fnm / nvm 자동 적용 (engines node>=20 과 정합)
- README 문서 인덱스에 `docs/CI-AUTOMATION.md` + `docs/OBSERVABILITY.md` 추가
- `docs/CI-AUTOMATION.md` — branch protection / required check / CodeRabbit APPROVED gate / Dependabot auto-merge / 응급 우회 절차 문서화

### Dependabot grouping
- npm groups: `storybook` / `vitest` / `types` / `eslint-biome` / `build-tooling` / `runtime-prod` — 매주 14 PR burst → 카테고리 묶음
- `docker` ecosystem 추가 (월간)
- Actions monthly group

### CI workflows
- **`branch-protection.yml`** (new) — `workflow_dispatch` admin tool. `GH_ADMIN_TOKEN` 으로 main protection 재적용. 응급 우회 후 복구 자동화에 활용
- **`auto-merge-on-green.yml`** (new) — 라벨 (`automerge` / `auto-merge`) 기반 일반 PR auto-merge. Dependabot 검출은 별도 워크플로우로 분리
- `ci.yml` — `concurrency.cancel-in-progress`, `timeout-minutes: 20`, `docker/setup-qemu-action` v3→v4, `docker/metadata-action` v5→v6, job `name: "Quality gate"` (branch protection required context 와 매치)
- `dependabot-auto-merge.yml` — `types: [opened, reopened, synchronize, labeled]` 명시, concurrency cancel-in-progress, `head.repo.full_name == github.repository` 검증, `dependabot/fetch-metadata` v2 → v3, `github.actor` → `pull_request.user.login` (재실행 안정성), 5m timeout, `github_actions` + `direct:development` major 까지 auto-merge

### Dependencies
- `@biomejs/biome` 2.4.15 → 2.4.16 (patch)

### Verified
- 23 PR 머지 (#1 ~ #23) — CodeRabbit Free plan rate limit 으로 #19 ~ #23 은 admin enforce 임시 토글 후 즉시 복구 패턴 적용
- 701 tests passing, 0 lint warnings, 0 audit vulnerabilities

## v1.12.2 — 2026-05-28

🛡 **CodeRabbit APPROVED 리뷰 gate + CI 하드닝**.

### CodeRabbit APPROVED review gate (`.github/workflows/coderabbit-gate.yml`)
- 기존 `CodeRabbit` status check 는 *어떤 응답이든* success 가 떨어지면 통과. 새 gate workflow 는 **CodeRabbit 의 review state 가 `APPROVED` 일 때만** 통과
- `pull_request` (opened/synchronize/reopened/ready_for_review) + `pull_request_review` (submitted/edited/dismissed) 양쪽 트리거
- **최신 head SHA 에 대한 리뷰만** 카운트 — stale review 무효화. 새 commit 푸시하면 gate 다시 빨간색
- `COMMENTED` / `CHANGES_REQUESTED` / `DISMISSED` / `PENDING` 모두 명시적 fail. "코멘트만 남기고 통과되는" 사고 차단
- CodeRabbit 봇 login 변경 대비: `coderabbitai[bot]` / `coderabbitai` / `coderabbit-ai[bot]` / `coderabbit[bot]` 모두 허용
- Draft PR 자동 skip (CodeRabbit 이 draft 자동 리뷰 안 함). Ready-for-review 전환 시 재 트리거
- 5 분 timeout, `concurrency` 로 같은 PR 의 review 이벤트들 순차 실행 (cancel-in-progress: false)

### CI workflow 하드닝 (`.github/workflows/ci.yml`)
- **`concurrency: { group: workflow-ref, cancel-in-progress: true }`** — 같은 브랜치에 새 push 가 오면 이전 run 자동 cancel. PR #15 같은 hang 상황 자동 정리
- `quality` job: `name: Quality gate`, `timeout-minutes: 20` — 무한 hang 방지

### Dependabot auto-merge 조건 정교화 (`.github/workflows/dependabot-auto-merge.yml`)
- `on.pull_request.branches: [main]` 명시 — main 외 base 로 만들어진 dependabot PR 무시
- `dependabot/fetch-metadata@v2` 에 `github-token` 명시
- self-approve 단계 제거 — branch protection 이 status check 기반이므로 review approval 불필요. CodeRabbit gate 가 진짜 approval 책임
- 자동 머지 조건 확장:
  - patch / minor 업데이트
  - `package-ecosystem == github_actions` (액션 버전 업)
  - `dependency-type == direct:development` 의 major (devDep major 도 OK)
  - 그 외 runtime major 는 수동 검토 유지

### PR template
- 체크리스트에 **`CodeRabbit review gate 통과`** 항목 추가 — 머지 전 검증 항목 명시

### Required status checks (branch protection)
- `[quality, CodeRabbit]` 외에 **`CodeRabbit review gate`** 추가 필요 (이 PR 머지 직후 적용)

## v1.12.1 — 2026-05-28

🔒 **보안 audit 0건 + branch protection 하드닝**.

### Security
- **`pnpm audit` 12 → 0 vulnerabilities** (5 high + 6 moderate + 1 low → 0). 모두 `apps/demo > @vercel/node` 의 transitive. root `package.json` 에 pnpm `overrides` 추가로 patched 버전 강제:
  - `minimatch: ">=10.2.3"` (ReDoS via 반복 wildcard / nested extglobs / matchOne 백트래킹)
  - `undici: ">=6.24.0"` (WebSocket 무한 메모리 / Unhandled exception / Request smuggling / CRLF injection / 무한 decompression chain). 5.x → 6.x 강제했지만 verify 통과 — `@vercel/node` 호환성 유지
  - `ajv: ">=8.18.0"` (ReDoS via `$data` option)
  - `smol-toml: ">=1.6.1"` (TOML DoS)
- `pnpm install` 후 `pnpm audit --prod` → **No known vulnerabilities found**

### CI Hardening
- **`enforce_admins: true`** — main branch protection 이 admin(소유자) 도 우회 불가. 응급 시 토글 패턴 필요. `required_status_checks` `[quality, CodeRabbit]` strict 정책이 모든 머지에 100% 적용

### Verified
- `pnpm verify` EXIT=0 (701 tests / 0 lint warnings)
- undici 5.x → 6.x 강제 후 `@vercel/node`, `apps/demo` 빌드/테스트 정상

## v1.12.0 — 2026-05-28

🤖 **자동화 & 코드 품질 — Dependabot auto-merge + CodeRabbit AI 리뷰 + lint 0 warnings**. 의존성 14건 일괄 머지, biome warning 25 → 0, main branch protection (CI + CodeRabbit 통과 강제).

### CI & Automation
- **Dependabot auto-merge** (`.github/workflows/dependabot-auto-merge.yml`) — patch / minor 업데이트는 `dependabot/fetch-metadata@v2` 로 판별 후 자동 approve + squash auto-merge. major 는 수동 검토 유지
- **Main branch protection rule** — `required_status_checks: [quality, CodeRabbit]`, `strict: true` (up-to-date 강제), force-push / 삭제 차단. `enforce_admins: false` 로 응급 시 admin 우회 가능
- **Repo 설정** — `allow_auto_merge=true`, `delete_branch_on_merge=true`, `allow_update_branch=true`, `can_approve_pull_request_reviews=true` (Actions self-approval) 일괄 활성화
- **CI 안정화 5 commits** (오리진 fast-forward) — docker workspace dependency install fix, biome lint baseline 정렬, admin UI prebuild before tests, renderer wait delay assertion 안정화, pnpm setup + schema 생성 정돈

### CodeRabbit AI Review
- **`.coderabbit.yaml`** — `language: ko-KR`, `auto_review.enabled: true`, lock/dist/node_modules path filter. PR 생성 시 자동 한국어 리뷰 트리거
- Status context 이름 `CodeRabbit` 을 branch protection required check 에 추가 — review 통과해야 머지 가능

### Code Quality (biome lint 25 → 0)
- **`packages/core/src/lighthouse.ts`** — `any` 3개 제거 (`LighthouseRunner` / `ChromeLauncher` / `LighthouseResult` / `LighthouseCategory` / `LighthouseAudit` 타입 정의). 사용하지 않는 `catch (e)` 바인딩 제거. `chrome.kill()` 의 `Promise<void> | void` 모두 처리하도록 `Promise.resolve(...).catch(...)` 래핑
- **`packages/core/src/optimize.ts` + `tests/coverage-final-*.test.ts`** — string concat 4곳 → template literal
- **`apps/admin-frontend/src/pages/{SiteDetail,TenantDetail,Sites,Tenants}.tsx`** — `Field` 래퍼 컴포넌트 `<label>` → `<div>` 리팩토링으로 `noLabelWithoutControl` 해결 (자식 컨트롤에 자체 label association 의존)
- **`apps/admin-frontend/src/components/CommandPalette.tsx`** — `autoFocus` 속성 → `useRef` + `useEffect` 패턴
- **`apps/admin-frontend/src/components/{Modal,ShortcutsModal,Layout}.tsx`** — modal/backdrop a11y biome-ignore (Escape 핸들러 부재 경고는 글로벌 keydown 리스너로 처리하기 때문)
- **`apps/admin-frontend/src/styles.css`** — x-cloak + prefers-reduced-motion 블록의 `!important` biome-ignore (Tailwind utility override 의도)

### Dependencies (PRs #1 – #14, 모두 squash 머지)
**Runtime**:
- `puppeteer` 25.0.4 → 25.1.0 (#6)
- `@anthropic-ai/sdk` 0.97.1 → 0.99.0 (#14)
- `@vercel/node` 5.8.3 → 5.8.6 (#9)

**Dev — Storybook 10.4.0 → 10.4.1**:
- `storybook` (#10), `@storybook/react` (#11), `@storybook/react-vite` (#8), `@storybook/addon-themes` (#13), `@storybook/addon-docs` (#12)
- `vite` 8.0.13 → 8.0.14 (#7)

**GitHub Actions**:
- `actions/checkout` v4 → v6 (#5)
- `pnpm/action-setup` v4 → v6 (#2)
- `docker/setup-buildx-action` v3 → v4 (#1)
- `docker/setup-qemu-action` v3 → v4 (#4)
- `docker/login-action` v3 → v4 (#3)

### Verified
- `pnpm verify` (format / lint / typecheck / build / test / schema): **EXIT=0**
- Lint: 25 → **0 warnings** (across 214 files)
- Tests: gateway 552 / admin-frontend 149 = **701 / 701 passing** (변동 없음)
- Build: vite production bundle 65 modules, react-vendor 73.72 kB gzip, index 18.44 kB gzip

## v1.11.0 — 2026-05-21

🧪 **테스트 sprint + 보안 강화 + Storybook + 의존성 현대화**. 게이트웨이 라인 커버리지 46% → **98.67%**, 283 → **701 테스트** (+418).

### Added
- **Storybook 10 통합** (`apps/admin-frontend/.storybook/`): Vite 빌더, `@storybook/addon-themes` 로 다크 모드 토글, Tailwind v4 스타일 자동 로드. 8개 스토리:
  - `Modal` / `ToastContainer` / `ShortcutsModal` / `CommandPalette` / `LoginForm` / `MobileMenu` / `RoutesEditor` / `Sidebar` (gateway mode 별 variants 포함)
  - 루트 스크립트: `pnpm storybook` / `pnpm build-storybook`
- **`ErrorBoundary`** 컴포넌트 — `Layout` 의 `<Outlet>` + `Suspense` 를 감싸 페이지 단위 런타임 에러에 fallback UI 제공
- **`Skeleton` / `CardGridSkeleton`** 로딩 컴포넌트 (role="status" + aria-label). Dashboard 초기 로딩이 `"loading..."` 텍스트에서 카드 스켈레톤으로 교체
- **`apps/gateway`** `buildApp()` 팩토리 export — 테스트가 puppeteer/hot-reload/warm-cron 부작용 없이 Fastify 앱을 빌드 가능. `main()` 은 `import.meta.url === argv[1]` 가드로 직접 실행 시에만 동작
- **`packages/cli`** 순수 유틸 export 추가: `parseArgs`, `resolveUserAgent`, `checkPort`, `commandExists` (동작 변경 없음, 테스트 가능성 위함)

### Tests (418건 신규)
- **게이트웨이 (159 → 552, +393)** — 17개 테스트 파일 신규:
  - `pool.test.ts` (17) — puppeteer-cluster 모킹으로 풀 시작/재활용/통계
  - `renderer.test.ts` (22) — 모바일 UA 분기, 품질 게이트 (soft-404 / 500), retry, SSRF, A/B variant, schema template
  - `gateway-e2e.test.ts` (16) — 실제 Fastify boot + fetch (health/metrics/admin login/SPA fallback/CORS)
  - `admin-ui-api.test.ts` (28) — login/logout/cookie auth, /site /routes /audit /cache /warm /render-test /visual-diff /ai/schema /lighthouse
  - `cms-deep.test.ts` (19), `multi-tenant-deep.test.ts` (18) — store, preHandler, render handler branches, rate-limit trip
  - `cli-*.test.ts` (72건 across 6 files) — render parseArgs, doctor checks, init interactive (clack mock), index dispatcher (resetModules), runRender, error paths
  - `distributed-lock-redis.test.ts` (14) — Redis SETNX 락 획득/대기/폴링/실패 fallback (@keyv/redis 모킹)
  - `lighthouse-full.test.ts` (9), `warm-cron-tick.test.ts` (6) — 동적 import + fake timer 기반
  - `url-ssrf*.test.ts` (30) — 0.0.0.0, IPv4-mapped IPv6 (dotted+hex), RFC1918, link-local, AWS metadata 차단
  - `optimize-deep.test.ts` (12) — stripImages, schemaTemplate (Article/Product/FAQ/HowTo/WebSite), breadcrumb 중복 방지
  - `audit-extra.test.ts` (8) — HMAC 서명, 파일 sink, webhook POST/실패 swallow
  - `visual-regression.test.ts` (5) — browserPool 모킹으로 baseline 생성/비교/사이즈 mismatch
  - `hot-reload.test.ts` (6), `warm-cron.test.ts` (4), `distributed-lock.test.ts` (3), `lighthouse.test.ts` (2), `telemetry.test.ts` (5)
  - `coverage-final-*.test.ts` (64) — 잔여 분기 보완 (applyRequestInterception, prerender-warmer 분기, audit file 에러, url cache 축출, SWR 재검증, config process.exit, telemetry OTEL init log 등)
- **Admin-frontend (124 → 149, +25)**:
  - `ErrorBoundary` (4), `Skeleton` (4), `Modal` a11y (6), `RoutesEditor` (6), `LoginForm` (5)

### Coverage (gateway, line %)
| 모듈 | Before | After |
|---|---|---|
| pool.ts | 20.68 | **100** |
| distributed-lock.ts | 22.22 | **100** |
| lighthouse.ts | 42.10 | **100** |
| warm-cron.ts | 48.00 | **100** |
| cli/* | 17.87 | **100** (lines, branches 95+) |
| admin-ui | 89.44 | **100** |
| audit / hot-reload / optimize / prerender-warmer / telemetry / url | 88–95 | **100** |
| renderer.ts | 40.86 | **96.52** |
| config.ts | 71.42 | **97.61** |
| cms / multi-tenant | 50–87 | **95–99** |
| **Overall** | **46** | **98.67** |

남은 unreachable 분기는 모두 defensive fallback (예: `??` 기본값 도달 불가, `URL` parse catch 가 schema 통과한 입력에 닿지 않음) — 테스트 코멘트에 명시.

### Security hardening (`packages/core`)
- **`url.ts` SSRF 강화**:
  - `0.0.0.0`, `[::]`, `::ffff:127.0.0.1` / `::ffff:7f00:1` (dotted+hex IPv4-mapped IPv6) 명시 차단
  - RFC1918 IPv4 (10/8, 172.16/12, 192.168/16) 리터럴은 DNS 조회 없이 즉시 거부 — AWS 메타데이터 (`169.254.169.254`) 포함
  - `safeCache` 1024 항목 바운드 (FIFO 축출)
  - `isHostAllowed` 가 invalid URL 입력에 throw 하지 않고 false 반환
- **`circuit-breaker.ts`** breakers Map 512 항목 바운드 + 축출 시 `breaker.shutdown()` 으로 opossum 타이머 회수
- **`hot-reload.ts`** `startHotReload()` idempotent — 중복 SIGHUP 핸들러 등록 방지. `stopHotReload()` 가 listener + debounce timer 모두 정리
- **`lighthouse.ts`** 점수 캐시 256 항목 바운드
- **`runtime-config.ts`** `setRoutes()` 의 정규식 컴파일 → 원자적 swap 패턴 명시화

### Design + a11y (admin-frontend)
- **16개 sub-page React.lazy 적용** — 초기 JS 번들 **132 KB → 63 KB (-52%)**, gzip 29.8 KB → 18.4 KB
- `Modal`: `aria-labelledby` + body-scroll lock + focus restore + close 버튼 focus ring
- `Sidebar` 활성 링크 `aria-current="page"`, 테마/언어 토글 `aria-label`, 모든 토글 버튼 focus-visible ring
- `MobileMenu` `aria-expanded` / `aria-controls`, `GlobalErrorBanner` `role="alert"`, `ToastContainer` 에러 토스트 `role="alert"`
- `LoginForm` `aria-busy` + `autoComplete="current-password"` + focus ring
- `styles.css` `prefers-reduced-motion` 미디어 쿼리 — 토스트/사이드바/스켈레톤 애니메이션 무력화
- 컴포넌트 분리: `ErrorBoundary.tsx`, `Skeleton.tsx`

### Modernized
- **Storybook**: 8.6 → **10.4** — `addon-essentials` 폐기 → core 기본 + `addon-docs` 명시. Vite 8 공식 peer 지원
- **puppeteer**: 24 → **25** — 새 Chrome 148 헤드리스 사용
- **@cacheable/utils**: 1 → **2**, **zod**: 4.3 → 4.4, **isbot** / **pixelmatch** / **fast-xml-parser** 최신
- **vite**: 8.0.10 → 8.0.13, **vitest**: 4.1.5 → 4.1.7, **react**: 19.2.5 → 19.2.6, **react-router**: 7.14 → 7.15
- **tailwindcss**: 4.2 → 4.3, **@vitejs/plugin-react**: 6.0.1 → 6.0.2
- **biome**: 2.4.13 → 2.4.15, **@types/node**: 25.6 → 25.9, **tsx**: 4.21 → 4.22
- **@clack/prompts**: 1.2 → 1.4

### Testing technique 메모
pnpm 워크스페이스로 격리된 패키지의 transitive 의존성 (`puppeteer-cluster`, `@keyv/redis` 등) 을 vitest 4 `vi.mock()` 으로 대체하려면 bare specifier 가 통하지 않음. 해결책:

```ts
const pkgPath = vi.hoisted(() => {
  const req = createRequire(`${process.cwd()}/packages/core/src/index.js`);
  return req.resolve('puppeteer-cluster');
});
vi.mock(pkgPath, () => ({ ... }));
```

`tests/pool.test.ts`, `tests/distributed-lock-redis.test.ts` 헤더에 패턴 문서화.

### Bumps
- 패키지 메이저 변경 없음 (테스트/모듈 내부 개선). `core`, `admin-ui`, `cms`, `multi-tenant`, `anthropic`, `openai`, `cli` 모두 1.10.x 호환.

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
