# @spa-seo-gateway/multi-tenant

**Status: alpha scaffold** — option B 의 골격. SaaS 형태로 게이트웨이를 운영할 때 사용.

## 제공하는 것

- `Tenant` 타입 (zod 스키마 포함)
- `TenantStore` 인터페이스 + `InMemoryTenantStore` 구현
- `registerMultiTenant(app, { store, strategy })` Fastify 플러그인 — host/subdomain/apiKey/pathPrefix 4가지 식별 전략
- `req.tenant` decorator (Fastify) 로 라우트 핸들러에서 즉시 사용

## 아직 없는 것 (TODO)

- Postgres/Drizzle 어댑터
- 빌링 (Stripe webhooks)
- 로그인/대시보드 UI (별도 `@spa-seo-gateway/cms` 와 통합 예정)
- 사용량 측정 (요청당 메트릭 + 정산)
- 무료/유료 플랜 quota
- 화이트라벨 도메인 매핑

## 사용 예시 (운영 시점)

```ts
import Fastify from 'fastify';
import { registerGateway } from '@spa-seo-gateway/server';
import { registerMultiTenant, InMemoryTenantStore } from '@spa-seo-gateway/multi-tenant';

const store = new InMemoryTenantStore();
await store.upsert({
  id: 'acme',
  name: 'ACME',
  origin: 'https://www.acme.example.com',
  apiKey: '<long-key>',
  routes: [],
  plan: 'pro',
});

const app = Fastify();
await registerMultiTenant(app, { store, strategy: 'host', required: true });
// 이후 라우트 핸들러는 req.tenant 로 사이트별 분기
```
