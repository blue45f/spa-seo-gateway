# @spa-seo-gateway/cms

`cms` 모드 구현. 한 조직이 여러 사이트를 한 게이트웨이로 운영.

## 사용법

```ts
import Fastify from 'fastify';
import { registerCms, FileSiteStore } from '@spa-seo-gateway/cms';

const app = Fastify();
const store = new FileSiteStore('./sites.json');

await registerCms(app, {
  store,
  adminToken: process.env.ADMIN_TOKEN,
});

await app.listen({ port: 3000 });
```

기본 사용은 [docs/CMS-MODE.md](../../docs/CMS-MODE.md) 참고. `apps/gateway` 가 `GATEWAY_MODE=cms` 일 때 자동 사용.

## 제공 클래스 / 함수

| | 설명 |
|--|--|
| `SiteSchema` | zod 스키마 |
| `Site` | 추출 타입 |
| `SiteStore` | 인터페이스 (`list/byId/byHost/upsert/remove`) |
| `InMemorySiteStore` | 테스트용 |
| `FileSiteStore(path)` | JSON 파일 영구화 |
| `registerCms(app, opts)` | Fastify 플러그인 |

## 등록되는 라우트

```
GET    /admin/api/sites                         (마스터 admin)
POST   /admin/api/sites
DELETE /admin/api/sites/:id
POST   /admin/api/sites/:id/cache/invalidate
POST   /admin/api/sites/:id/warm
GET    /admin/api/cms/stats
POST   /admin/api/cms/cache/clear

GET/HEAD /*                                      (사이트 인지 렌더)
```

## 캐시 격리

`cacheKey` 에 `site:<id>` namespace prefix 적용.

## saas 와 차이

|  | saas | cms |
|--|--|--|
| 식별 전략 | host/apiKey/subdomain/pathPrefix | host 만 |
| 인증 모델 | 마스터 admin + 테넌트별 apiKey | 마스터 admin 만 |
| 빌링 통합 지점 | `Tenant.plan` 필드 | 없음 |
| 외부 고객 대상 | yes | no |

## 라이선스

MIT
