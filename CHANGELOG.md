# Changelog

날짜는 한국 시간(KST). 모든 커밋은 [GitHub history](https://github.com/blue45f/spa-seo-gateway/commits/main) 참고.

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
