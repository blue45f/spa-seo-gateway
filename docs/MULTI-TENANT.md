# `saas` 모드 — 다중 테넌트 운영

한 게이트웨이 인스턴스가 여러 외부 고객(테넌트) 의 SPA 를 동시에 SEO 렌더링. 각 테넌트는 자기 origin / routes / API key 를 가지며, 서로 격리된 캐시 네임스페이스에서 동작.

## 활성화

```ini
GATEWAY_MODE=saas
ADMIN_TOKEN=<master-token>
TENANT_STORE_FILE=.data/tenants.json   # JSON 파일에 영구 저장 (기본)
```

`ADMIN_TOKEN` 은 마스터 토큰 — 테넌트를 추가/삭제할 수 있는 권한. 노출되면 안 됨.

---

## 테넌트 데이터 모델

```ts
type Tenant = {
  id: string;             // 영문 소문자/숫자/-/_ (cache 네임스페이스로 사용)
  name: string;
  origin: string;         // 테넌트의 SPA origin URL
  apiKey: string;         // 길이 ≥ 20. 테넌트가 자기 캐시 무효화할 때 사용
  routes: RouteOverride[]; // 테넌트별 라우트 룰
  plan: 'free' | 'pro' | 'enterprise';
  enabled: boolean;
  createdAt?: number;
};
```

JSON 파일에 영구 저장. 분산 환경에서는 외부 KV/DB 어댑터를 직접 구현해 `TenantStore` 인터페이스를 만족하도록.

---

## 테넌트 CRUD (마스터 admin)

```bash
# 추가
curl -X POST http://localhost:3000/admin/api/tenants \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "id": "acme",
    "name": "ACME Inc",
    "origin": "https://www.acme.com",
    "apiKey": "tk_live_'$(openssl rand -hex 16)'",
    "plan": "pro",
    "routes": [
      {"pattern":"^/$","ttlMs":600000},
      {"pattern":"^/(account|cart)","ignore":true}
    ]
  }'

# 목록
curl http://localhost:3000/admin/api/tenants -H "x-admin-token: $ADMIN_TOKEN"

# 삭제
curl -X DELETE http://localhost:3000/admin/api/tenants/acme -H "x-admin-token: $ADMIN_TOKEN"

# 통계
curl http://localhost:3000/admin/api/multi-tenant/stats -H "x-admin-token: $ADMIN_TOKEN"
```

---

## 테넌트 식별 전략 (요청 → 어떤 테넌트?)

기본 순서: `host` → `apiKey`.

### A) Host 기반 (가장 일반적)

테넌트 origin 의 host (`www.acme.com`) 와 들어오는 요청의 `Host` 헤더가 매칭되면 그 테넌트로 라우팅. 일반 CDN / 리버스프록시가 `Host` 를 보존해 게이트웨이로 보내면 됨.

```
Bot ─→ CDN ─→ gateway (Host: www.acme.com) ─→ tenant: acme
```

### B) API Key 기반 (외부 시스템 통합용)

테넌트가 직접 게이트웨이 API 를 호출할 때 (예: 빌드 후 캐시 무효화):

```bash
curl -X POST https://gateway.example.com/api/cache/invalidate \
  -H "x-api-key: tk_live_xxxx" \
  -H "content-type: application/json" \
  -d '{"url":"https://www.acme.com/posts/123"}'
```

### C) Subdomain (테넌트 ID = 서브도메인)

`acme.gateway.example.com` 형태로 SaaS 호스팅할 때:

```ts
// 코드 레벨에서 활성 (apps/gateway/src/main.ts 의 registerMultiTenant 호출 부분)
await registerMultiTenant(app, { store, resolve: ['subdomain', 'apiKey'] });
```

### D) Path Prefix (개발/테스트용)

`/t/acme/...` 경로의 테넌트 ID 를 추출.

---

## 봇 트래픽 흐름

```
Googlebot
  → CDN
  → gateway:3000  (Host: www.acme.com)
    → tenant resolver (host) → req.tenant = acme
    → bot detect → isBot = true
    → URL = req.tenant.origin + req.url
    → routes = req.tenant.routes 매칭
    → cacheKey(url, lang, namespace="tenant:acme")  // 격리된 캐시
    → cacheSwr → render(if miss)
    → 응답 (x-tenant-id: acme, x-cache: HIT/MISS)
```

사람 트래픽은 게이트웨이가 204 만 반환 → CDN 이 SPA 원본을 직접 서빙해야 함 (CDN 레벨에서 봇만 게이트웨이로 분기 권장).

---

## CDN / Edge 통합 예시

### Cloudflare Workers

```js
export default {
  async fetch(req, env) {
    const ua = req.headers.get('user-agent') ?? '';
    const isBot = /googlebot|bingbot|yeti|naverbot|facebookexternalhit/i.test(ua);
    if (!isBot) return fetch(req);  // 사람 → origin 직접

    const url = new URL(req.url);
    url.host = env.SEO_GATEWAY_HOST;
    return fetch(url, {
      headers: { ...req.headers, host: req.headers.get('host') ?? '' },
    });
  },
};
```

테넌트 origin 의 host 가 게이트웨이로 전달되어 자동 매칭됨.

### Nginx (자체 origin 보유)

```nginx
map $http_user_agent $is_bot { default 0; ~*(googlebot|bingbot) 1; }

server {
  server_name www.acme.com;
  location / {
    if ($is_bot) {
      proxy_pass http://seo-gateway:3000;
      proxy_set_header Host $host;
      break;
    }
    proxy_pass http://acme-spa-origin;
  }
}
```

각 테넌트의 server { } 블록을 동일 패턴으로 추가하거나, `map $http_host` 로 테넌트 풀 라우팅.

---

## 테넌트별 캐시 무효화

```bash
# 테넌트 자체 (apiKey 인증)
curl -X POST https://gateway.example.com/api/cache/invalidate \
  -H "x-api-key: $TENANT_API_KEY" \
  -d '{"url":"https://www.acme.com/products/123"}'

# 마스터 admin 이 전체 무효화 (모든 테넌트 영향)
curl -X POST https://gateway.example.com/admin/api/multi-tenant/cache/clear \
  -H "x-admin-token: $ADMIN_TOKEN"
```

---

## 운영 체크리스트

- [ ] `ADMIN_TOKEN` 강한 값 (32자+) — git 에 절대 commit 금지
- [ ] `TENANT_STORE_FILE` 의 디스크가 영구화 (Docker volume / K8s PVC)
- [ ] Redis 활성 (`REDIS_CACHE_ENABLED=true`) — 멀티 노드 배포 시 필수
- [ ] `ALLOWED_HOSTS` 는 비워두는 게 좋음 (각 테넌트 origin 이 자동 화이트리스트 역할)
- [ ] `RATE_LIMIT_MAX` 를 테넌트 수에 비례해 상향
- [ ] Prometheus 알람: `gateway_render_duration_ms{host=...}` p95 임계
- [ ] `/admin/api/multi-tenant/stats` 정기 모니터링

## 보안 모델

- **Tenant isolation**: cache key prefix 로 보장 (`tenant:<id>` ). 다른 테넌트 캐시 누출 불가
- **SSRF**: render 전 DNS resolve → 사설 IP 차단 (글로벌, [코어 보안](ARCHITECTURE.md#보안-고려사항))
- **Origin 강제**: 들어온 URL 이 테넌트의 origin host 와 다르면 403 (cross-tenant 노출 방지)
- **API key**: 캐시 무효화 외에는 사용처 없음. 빌링용 식별자는 별도 시스템에서

## 한계 & 향후 마일스톤

- DB 어댑터 미제공 (현재는 JSON 파일). Postgres/Drizzle 어댑터는 PR 환영
- 빌링/사용량 측정 없음 (Stripe 통합은 별도 SDK 권장)
- 로그인 UI 없음 (apiKey 기반만). per-tenant 어드민 UI 는 옵션 C(`cms`) 와 통합 예정
- 테넌트별 quota / 동시성 분리 없음 (모든 테넌트가 같은 풀 공유)
