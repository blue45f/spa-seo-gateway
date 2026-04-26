# @spa-seo-gateway/cms

**Status: alpha scaffold** — option C 의 골격. 한 조직 내에서 여러 사이트를 GUI 로 관리.

## 제공하는 것 (현재)

- `Site` 타입 + 메모리 SiteStore
- `registerCms(app, { store })` 로 `/cms/api/sites` CRUD 노출

## 채울 것 (TODO)

- admin-ui 와 통합된 사이트 선택기 (드롭다운)
- 사이트별 라우트 에디터 (기존 admin-ui 의 라우트 편집기를 사이트 컨텍스트로 분기)
- 사이트별 캐시 네임스페이스 (cacheKey 에 siteId prefix)
- 사이트별 origin/blockResourceTypes/풀 설정 분리
- 배포 webhook 수신 → 자동 cache invalidate
- Slack/Discord 알림 (renderError, breaker open 시)
- B(multi-tenant) 와의 차이: B 는 외부 고객 대상, C 는 내부 조직 대상

## A 와의 관계

`admin-ui` (option A) 는 단일 사이트 전제. CMS 는 여러 사이트를 관리하므로 admin-ui 를
import 해 사이트 컨텍스트 안에 띄우는 형태가 됩니다.
