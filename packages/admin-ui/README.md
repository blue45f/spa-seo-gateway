# @spa-seo-gateway/admin-ui

임베드형 어드민 UI. **Fastify 플러그인** + **Alpine.js + Tailwind 단일 HTML** 로 구성. 외부 빌드 불필요.

## 통합

```ts
import Fastify from 'fastify';
import { registerAdminUI } from '@spa-seo-gateway/admin-ui';

const app = Fastify();
await registerAdminUI(app, {
  prefix: '/admin/ui',           // 기본
  tokenHeader: 'x-admin-token',  // 기본
});
await app.listen({ port: 3000 });

// open http://localhost:3000/admin/ui
```

## 인증

`config.adminToken` (env `ADMIN_TOKEN`) 미설정 시 어드민 API/UI 가 자동으로 disabled (404). 토큰 설정 후 UI 의 로그인 박스에 입력하면 localStorage 에 저장.

## 기능 탭

| 탭 | API | 동작 |
|--|--|--|
| 대시보드 | `GET /admin/api/site` | 모드/origin/캐시/circuit breaker 요약 |
| 라우트 | `GET / PUT /admin/api/routes` | 런타임 변경 + `persist:true` 시 디스크 영구화 |
| 캐시 | `POST /admin/api/cache/{invalidate,clear}` | URL 무효화, 전체 초기화 |
| 워밍 | `POST /admin/api/warm` | sitemap-index 재귀 파싱 + 동시 워밍 |
| 렌더 테스트 | `POST /admin/api/render-test` | 단일 URL 즉시 렌더 + 본문 미리보기 |

## 등록되는 모든 라우트

```
GET    /admin/ui/                   (정적)
GET    /admin/ui                    -> redirect to /admin/ui/
GET    /admin/api/site
GET    /admin/api/routes
PUT    /admin/api/routes
POST   /admin/api/cache/invalidate
POST   /admin/api/cache/clear
POST   /admin/api/warm
POST   /admin/api/render-test
```

## CDN / Tailwind 의존

UI 는 다음 CDN 을 사용 (인터넷 접근 필요):
- Tailwind CSS — `https://cdn.tailwindcss.com`
- Alpine.js — `https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js`

오프라인 환경이라면 `public/index.html` 의 `<script>`/`<link>` 를 자체 호스팅 자산으로 교체.

## 모드 인식

`/admin/api/site` 응답에 `multiContext: true|false` 가 포함됨. UI 가 모드를 인지해 향후 사이트/테넌트 셀렉터 표시 (현재 베이스라인 UI 만 제공).

## 라이선스

MIT
