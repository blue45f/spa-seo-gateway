# `cms` 모드 — 다중 사이트 운영

한 조직 내에서 여러 사이트(마케팅 / 블로그 / 도큐먼트 등) 를 한 게이트웨이로 관리. 각 사이트는 자기 origin / routes / 캐시 네임스페이스를 가짐.

`saas` 모드와의 차이:
- **saas**: 외부 고객(테넌트) 대상. apiKey 인증, 빌링 모델.
- **cms**: 같은 조직 내부. host 기반 식별만. 빌링 없음.

## 활성화

```ini
GATEWAY_MODE=cms
ADMIN_TOKEN=<secret>
SITE_STORE_FILE=.data/sites.json
```

## Site 데이터 모델

```ts
type Site = {
  id: string;            // 영문 소문자 - 사이트 식별자 (cache 네임스페이스)
  name: string;          // 표시 이름
  origin: string;        // SPA origin URL
  routes: RouteOverride[];
  webhooks?: {
    onRender?: string;   // (TODO) 렌더 성공 시 호출
    onError?: string;    // (TODO) 렌더 실패 시 호출
  };
  enabled: boolean;
  createdAt?: number;
};
```

## 사이트 CRUD

```bash
# 사이트 추가
curl -X POST http://localhost:3000/admin/api/sites \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "id": "marketing",
    "name": "Marketing Site",
    "origin": "https://www.example.com",
    "routes": [
      {"pattern":"^/$","ttlMs":600000},
      {"pattern":"^/blog/","ttlMs":86400000}
    ]
  }'

curl -X POST http://localhost:3000/admin/api/sites \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{
    "id": "docs",
    "name": "Documentation",
    "origin": "https://docs.example.com",
    "routes": []
  }'

# 목록
curl http://localhost:3000/admin/api/sites -H "x-admin-token: $ADMIN_TOKEN"

# 삭제
curl -X DELETE http://localhost:3000/admin/api/sites/docs -H "x-admin-token: $ADMIN_TOKEN"

# 사이트별 캐시 무효화
curl -X POST http://localhost:3000/admin/api/sites/marketing/cache/invalidate \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"url":"https://www.example.com/blog/new-post"}'

# 사이트별 sitemap 워밍 (sitemap 미지정 시 origin/sitemap.xml 자동 사용)
curl -X POST http://localhost:3000/admin/api/sites/marketing/warm \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"max": 500}'

# 통계
curl http://localhost:3000/admin/api/cms/stats -H "x-admin-token: $ADMIN_TOKEN"
```

---

## 봇 트래픽 흐름

```
Googlebot ─→ CDN ─→ gateway:3000 (Host: www.example.com)
                        → site resolver (host=www.example.com)
                          → req.site = marketing
                        → bot detect ✓
                        → URL = site.origin + req.url
                        → routes = site.routes 매칭
                        → cacheKey(url, lang, "site:marketing")
                        → render or cache
                        → 응답 (x-site-id, x-cache, x-prerender-route)
```

사람 트래픽은 204 만 반환. CDN 에서 봇만 게이트웨이로 분기.

---

## Nginx 통합 예시

여러 사이트가 같은 Nginx 뒤에 있고, 봇만 게이트웨이로 라우팅:

```nginx
map $http_user_agent $is_bot {
  default 0;
  ~*(googlebot|bingbot|yeti|naverbot|facebookexternalhit) 1;
}

upstream seo_gateway { server seo:3000; keepalive 32; }

# 사이트 1
server {
  server_name www.example.com;
  location / {
    if ($is_bot) { proxy_pass http://seo_gateway; proxy_set_header Host $host; break; }
    proxy_pass http://marketing-spa;
  }
}

# 사이트 2 — 동일 게이트웨이가 host 로 자동 분기
server {
  server_name docs.example.com;
  location / {
    if ($is_bot) { proxy_pass http://seo_gateway; proxy_set_header Host $host; break; }
    proxy_pass http://docs-spa;
  }
}
```

---

## 사이트별 라우트 운영 패턴

마케팅 사이트:
```json
{
  "id": "marketing",
  "origin": "https://www.example.com",
  "routes": [
    { "pattern": "^/$", "ttlMs": 300000 },
    { "pattern": "^/blog/", "ttlMs": 86400000, "blockResourceTypes": ["image","media","font","stylesheet"] },
    { "pattern": "^/(about|pricing|features)", "ttlMs": 3600000 },
    { "pattern": "^/(account|admin)(/|$)", "ignore": true }
  ]
}
```

블로그/문서 사이트:
```json
{
  "id": "docs",
  "origin": "https://docs.example.com",
  "routes": [
    { "pattern": "^/", "ttlMs": 86400000, "waitSelector": ".docs-content" }
  ]
}
```

각 라우트는 첫 매칭 승. 패턴 순서가 중요한 경우 더 구체적인 패턴을 위로.

---

## 어드민 UI 통합 (v1.9+)

게이트웨이를 `cms` 모드로 띄우면 `/admin/ui` 의 사이드바에 **Sites** 탭이 자동으로 노출됩니다 (`publicInfo.mode === 'cms'` 일 때만). 더 이상 curl 로만 사이트를 관리할 필요 없음.

**Sites 탭 (`/admin/ui/sites`)** 에서 가능한 작업:
- **사이트 목록**: id / name / origin / routes count / enabled 한 화면에서 확인
- **+ 추가**: 모달 폼에 id (소문자/숫자/-/_), name, origin URL, webhook (선택), enabled 입력 → 저장
- **편집 / 삭제**: 행별 액션. 삭제는 confirm 으로 보호되며 캐시 네임스페이스도 자동 정리
- **URL 무효화**: 행 액션에서 단일 URL 입력 → `POST /admin/api/sites/:id/cache/invalidate`
- **Sitemap 워밍**: 행 [Sitemap 워밍] 클릭 → `POST /admin/api/sites/:id/warm` (max 500)

라우트 편집은 v1.9 시점에서는 여전히 `/admin/api/sites` POST 로 routes 배열을 통째로 수정 (사이트별 routes 인라인 편집 GUI 는 다음 마일스톤). curl 로 routes 만 갱신하려면:

```bash
curl -X POST -H "x-admin-token: $T" -H "content-type: application/json" \
  -d '{"id":"docs","name":"Docs","origin":"https://docs.example.com","routes":[{"pattern":"^/$","ttlMs":3600000}],"enabled":true}' \
  http://localhost:3000/admin/api/sites
```

> **인증 메모**: admin UI 의 쿠키 로그인 (`POST /admin/api/login` 이 `seo-admin` httpOnly 쿠키 발급) 으로 모든 `/admin/api/sites/*` 도 호출 가능. 헤더 `x-admin-token` 도 legacy 호환으로 유지.

---

## 운영 체크리스트

- [ ] `SITE_STORE_FILE` 디스크가 영구화 (Docker volume / K8s PVC)
- [ ] Redis 활성 (다중 노드 시) — 사이트 stores 도 노드 간 공유 필요 시 외부 store 어댑터로
- [ ] 사이트별 sitemap.xml 이 있다면 `/admin/api/sites/:id/warm` 으로 일괄 워밍
- [ ] CDN 에서 봇만 게이트웨이로 분기 (사람은 사이트 origin 으로 직행)
- [ ] Prometheus alerting: 사이트별 latency 모니터링은 `gateway_render_duration_ms{host="..."}` 라벨로
- [ ] 백업: `SITE_STORE_FILE` 정기 backup

---

## SaaS 와 CMS 의 선택 기준

| 질문 | saas | cms |
|--|--|--|
| 외부 고객에게 서비스? | yes | no |
| 빌링 / 사용량 측정 필요? | yes (외부 SDK 필요) | no |
| 사이트별 API key 발급? | yes (`apiKey` 필드) | no (마스터 admin 만) |
| Subdomain / pathPrefix 식별 필요? | yes | no (host 만) |
| 여러 사이트를 한 조직이 운영? | possible but B 가 무거움 | yes — best fit |

내부 운영이면 **cms**, 외부 SaaS 면 **saas** 로 시작. 둘 다 같은 코어를 사용하므로 나중에 전환도 어렵지 않음.
