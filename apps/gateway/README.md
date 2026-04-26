# @spa-seo-gateway/gateway

실행 가능한 단일 바이너리. core + admin-ui + (mode 별로) cms 또는 multi-tenant 를 합성.

## 모드 분기

`GATEWAY_MODE` 환경변수에 따라 다른 플러그인 조합:

| 모드 | 등록되는 플러그인 | 동작 |
|--|--|--|
| `render-only` (기본) | core + admin-ui | 단일 origin. 봇만 렌더, 사람은 204 |
| `proxy` | core + admin-ui (+ http-proxy) | 단일 origin. 봇은 렌더, 사람은 origin 으로 패스스루 |
| `cms` | core + cms + admin-ui | 다중 사이트. host 로 사이트 식별 |
| `saas` | core + multi-tenant + admin-ui | 다중 테넌트. host/apiKey 로 테넌트 식별 |

## 실행

```bash
# 개발
pnpm dev

# 운영
pnpm build && pnpm start

# CLI 테스트 (별도 서버 없이)
pnpm check -- https://www.example.com/ --out result.html
```

## 항상 등록되는 라우트

```
GET    /health           — liveness
GET    /health/deep      — sample 렌더 후 OK
GET    /metrics          — Prometheus
GET    /admin/ui/*       — 어드민 UI
GET    /admin/api/*      — 어드민 API (모드별 추가 엔드포인트)
```

## 모드별 런타임 차이

### `render-only` / `proxy`
- `app.all('/*')` 에서 봇 분기 → core 의 `render()` 호출
- `cacheKey` 의 namespace 는 빈 문자열 (단일 사이트)

### `cms`
- `preHandler` hook 으로 host → site 매칭
- `req.site` 에 부착
- `cacheKey` 에 `site:<id>` namespace prefix
- `/admin/api/sites` CRUD 노출

### `saas`
- `preHandler` hook 으로 host/apiKey → tenant 매칭
- `req.tenant` 에 부착
- `cacheKey` 에 `tenant:<id>` namespace prefix
- `/admin/api/tenants` CRUD 노출
- `/api/cache/invalidate` (apiKey 인증) 추가

## 라이선스

MIT
