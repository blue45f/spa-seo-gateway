# @heejun/spa-seo-gateway-multi-tenant

`saas` 모드 구현. 한 게이트웨이가 여러 외부 고객(테넌트) 의 SPA 를 동시에 SEO 렌더링.

## 사용법

```ts
import Fastify from 'fastify';
import { registerMultiTenant, FileTenantStore } from '@heejun/spa-seo-gateway-multi-tenant';

const app = Fastify();
const store = new FileTenantStore('./tenants.json');

await registerMultiTenant(app, {
  store,
  adminToken: process.env.ADMIN_TOKEN,
  resolve: ['host', 'apiKey'],   // 식별 전략 (순서대로 시도)
});

await app.listen({ port: 3000 });
```

기본 사용은 [docs/MULTI-TENANT.md](../../docs/MULTI-TENANT.md) 참고. 위 코드는 `apps/gateway` 가 `GATEWAY_MODE=saas` 일 때 자동으로 수행함.

## 제공 클래스 / 함수

| | 설명 |
|--|--|
| `TenantSchema` | zod 스키마 |
| `Tenant` | 추출 타입 |
| `TenantStore` | 인터페이스 (`list/byId/byApiKey/byHost/upsert/remove`) |
| `InMemoryTenantStore` | 테스트용 |
| `FileTenantStore(path)` | JSON 파일 영구화 (atomic rename) |
| `registerMultiTenant(app, opts)` | Fastify 플러그인 |

외부 KV/DB 어댑터는 `TenantStore` 인터페이스를 만족하면 자유롭게 교체.

## 등록되는 라우트

```
GET    /admin/api/tenants                  (마스터 admin)
POST   /admin/api/tenants
DELETE /admin/api/tenants/:id
GET    /admin/api/multi-tenant/stats
POST   /admin/api/multi-tenant/cache/clear

POST   /api/cache/invalidate               (테넌트 apiKey 인증)
GET/HEAD /*                                 (테넌트 인지 렌더)
```

## 캐시 격리

`cacheKey` 에 `tenant:<id>` namespace prefix 를 붙여 다른 테넌트의 캐시와 자동 격리. cross-tenant 노출 불가.

## 라이선스

MIT
