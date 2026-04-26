# Getting Started

5분 안에 게이트웨이를 띄우고 봇 요청 → 렌더 → 캐시 동작을 확인합니다.

## 사전 요구사항

- **Node.js 20+** (24 LTS 권장)
- **pnpm 9+** — `npm i -g pnpm` 또는 `corepack enable && corepack prepare pnpm@9 --activate`
- **Chromium** — Puppeteer 가 자동 다운로드. 시스템 Chromium 사용 시 `PUPPETEER_EXECUTABLE_PATH` 지정
- **선택**: Redis (분산 캐시), Docker

## 1) 설치

```bash
git clone https://github.com/blue45f/spa-seo-gateway
cd spa-seo-gateway
pnpm install
```

postinstall 에서 husky 가 자동 활성화되고 puppeteer 가 chromium 을 다운로드합니다.

## 2) 환경 변수

```bash
cp .env.example .env
```

최소 설정:

```ini
# 단일 사이트 (기본)
GATEWAY_MODE=render-only
ORIGIN_URL=https://your-spa.example.com
ADMIN_TOKEN=change-me

# 또는 다중 사이트 운영
# GATEWAY_MODE=cms
# SITE_STORE_FILE=.data/sites.json

# 또는 SaaS
# GATEWAY_MODE=saas
# TENANT_STORE_FILE=.data/tenants.json
```

JSON 설정 파일 (`seo-gateway.config.json`) 도 자동 인식:

```json
{
  "$schema": "./schema/seo-gateway.config.schema.json",
  "originUrl": "https://your-spa.example.com",
  "renderer": { "poolMin": 2, "poolMax": 8, "waitUntil": "networkidle2" },
  "routes": [
    { "pattern": "^/products/", "ttlMs": 21600000, "waitSelector": "[data-product-loaded]" }
  ]
}
```

env > file > 기본값 순서로 적용. 자세한 설정은 [CONFIGURATION.md](CONFIGURATION.md).

## 3) 개발 모드 실행

```bash
pnpm run dev      # tsx watch
```

출력:

```
✓ browser pool ready (puppeteer-cluster CONCURRENCY_CONTEXT)
✓ Server listening at http://0.0.0.0:3000
✓ spa-seo-gateway ready
```

## 4) 봇 요청 테스트

```bash
# 봇으로 요청 → 렌더된 HTML 반환
curl -A "Googlebot" http://localhost:3000/some/spa/route

# 사람 UA → render-only 모드는 204 리턴 (CDN 이 SPA 원본 서빙해야 함)
curl http://localhost:3000/some/spa/route

# 강제 렌더 헤더로 디버깅
curl -H "x-force-render: true" http://localhost:3000/some/spa/route

# 캐시 우회
curl -A "Googlebot" "http://localhost:3000/some/spa/route?_no_render"
```

응답 헤더 확인:
- `x-cache: HIT|MISS`
- `x-prerendered: true`
- `x-prerender-status: 200`
- `x-prerender-viewport: desktop|mobile`
- `x-prerender-route: <pattern>` (라우트 매치 시)

## 5) 어드민 UI

```bash
open http://localhost:3000/admin/ui
```

로그인 박스에 `ADMIN_TOKEN` 값을 넣고 [연결] 클릭 → localStorage 저장 후 모든 탭 사용 가능.

탭:
- **대시보드** — 모드 / origin / 캐시 / circuit breaker
- **라우트** — URL 패턴별 TTL/waitUntil/selector/ignore. 메모리 저장 또는 디스크 영구화
- **캐시** — URL 무효화, 전체 초기화
- **워밍** — sitemap.xml 입력 → 재귀 파싱 + 동시 워밍
- **렌더 테스트** — URL/UA 입력 → 즉시 렌더 결과와 본문 미리보기

## 6) 단일 URL CLI 테스트

별도 서버 없이도 단발 렌더 가능:

```bash
pnpm run check -- https://www.example.com/ --out out.html
pnpm run check -- https://www.example.com/m --mobile  # 모바일 UA
```

## 7) 빌드 / 운영 모드 실행

```bash
pnpm run build           # packages/* + apps/* tsc 컴파일
pnpm run start           # apps/gateway/dist/main.js 실행
```

또는 Docker:

```bash
docker compose up -d
```

## 8) 모니터링

```bash
curl http://localhost:3000/health         # liveness
curl http://localhost:3000/health/deep    # 실제 1회 렌더 수행 후 OK 반환
curl http://localhost:3000/metrics        # Prometheus exposition
```

핵심 메트릭:
- `gateway_render_duration_ms{outcome="ok",host="..."}`
- `gateway_cache_events_total{event="hit|miss|swr"}`
- `gateway_browser_pool{state="active|total"}`
- `gateway_render_errors_total{reason="ssrf|circuit-open|timeout|..."}`

상세는 [USAGE.md](USAGE.md) 의 Prometheus / 알람 레시피 참고.

## 다음 단계

- [CONFIGURATION.md](CONFIGURATION.md) — 모든 설정 옵션
- [CMS-MODE.md](CMS-MODE.md) — 한 인스턴스로 N 개 사이트 운영
- [MULTI-TENANT.md](MULTI-TENANT.md) — SaaS 형태로 외부 고객에게 서비스
- [ARCHITECTURE.md](ARCHITECTURE.md) — 내부 동작 원리
- [USAGE.md](USAGE.md) — Nginx / Caddy / CDN / K8s 통합

## 트러블슈팅

| 증상 | 원인 / 해결 |
|--|--|
| `chromium not found` | `npx puppeteer browsers install chromium` 또는 `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` |
| `Cannot find module '@spa-seo-gateway/core'` | `pnpm run build` 한 번 실행 (vitest는 src 직접 참조하므로 보통은 불필요) |
| 어드민 UI `404 admin disabled` | `ADMIN_TOKEN` 환경변수 미설정. .env 에 추가 후 재시작 |
| 모든 요청에 `204` 응답 | `render-only` 모드 + 사람 UA. 봇 UA 로 다시 요청 또는 모드 변경 |
| `Method 'OPTIONS' already declared` | @fastify/cors 와 충돌. 보통 자동 해소되며 발생 시 issue 제보 |
| Redis 연결 실패 로그만 뜨고 동작은 함 | 정상 동작. 메모리 캐시로 자동 강등되며 운영에 지장 없음 |

추가 도움 — [github.com/blue45f/spa-seo-gateway/issues](https://github.com/blue45f/spa-seo-gateway/issues)
