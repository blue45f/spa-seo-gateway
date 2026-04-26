# Configuration Reference

세 가지 입력 방식이 합쳐집니다 (우선순위: 환경변수 > 설정 파일 > 기본값).

```
defaults < seo-gateway.config.json < env vars
```

## 환경변수 전체 목록

### 서버 / 모드
| 변수 | 기본 | 설명 |
|--|--|--|
| `HOST` | `0.0.0.0` | 바인딩 호스트 |
| `PORT` | `3000` | 포트 |
| `GATEWAY_MODE` | `render-only` | `render-only` / `proxy` / `cms` / `saas` |
| `ORIGIN_URL` | (없음) | 단일 사이트 origin. `proxy` 모드에서 필수 |
| `LOG_LEVEL` | `info` | `fatal/error/warn/info/debug/trace` |
| `LOG_PRETTY` | `false` | dev 에서 `true` 로 컬러 출력 |
| `ADMIN_TOKEN` | (없음) | `/admin/*` 접근 토큰 |

### 봇 탐지
| 변수 | 기본 | 설명 |
|--|--|--|
| `FORCE_RENDER_HEADER` | `x-force-render` | 강제 렌더 헤더 이름 |
| `BYPASS_QUERY_PARAM` | `_no_render` | 렌더 우회 쿼리 파라미터 |
| `DETECT_MOBILE` | `true` | 모바일 봇 UA 자동 감지 → mobileViewport 적용 |

### 풀 / 렌더링
| 변수 | 기본 | 설명 |
|--|--|--|
| `POOL_MIN` | `2` | 사전 워밍 브라우저 수 |
| `POOL_MAX` | `8` | 동시 활성 페이지 상한 |
| `PAGE_TIMEOUT_MS` | `25000` | 단일 렌더 최대 시간 |
| `WAIT_UNTIL` | `networkidle2` | `load`/`domcontentloaded`/`networkidle0`/`networkidle2` |
| `WAIT_SELECTOR` | (없음) | 렌더 후 추가로 기다릴 CSS 셀렉터 |
| `WAIT_PRERENDER_READY` | `false` | `window.prerenderReady === true` 시그널 대기 |
| `WAIT_PRERENDER_READY_TIMEOUT_MS` | `2000` | prerenderReady 시그널 timeout |
| `MAX_REQUESTS_PER_BROWSER` | `1000` | 자동 재시작 임계 |
| `BLOCK_RESOURCE_TYPES` | `image,media,font` | CSV — image/media/font/stylesheet/script/xhr/fetch/websocket/other |
| `BLOCK_URL_PATTERNS` | `google-analytics.com,...` | CSV — URL 부분문자열 매칭 |
| `QUALITY_CHECK` | `true` | soft 404 / 빈 페이지 자동 감지 |
| `MIN_TEXT_LENGTH` | `50` | body 텍스트 최소 길이 (그 이하면 too-small 로 마킹) |
| `USER_AGENT_SUFFIX` | `spa-seo-gateway/1.0` | 렌더 시 UA 끝에 append |
| `VIEWPORT_WIDTH/HEIGHT` | `1280/800` | 데스크톱 viewport |
| `MOBILE_VIEWPORT_WIDTH/HEIGHT` | `390/844` | 모바일 봇용 viewport |
| `PUPPETEER_EXECUTABLE_PATH` | (auto) | 시스템 chromium 경로 |

### 캐시
| 변수 | 기본 | 설명 |
|--|--|--|
| `CACHE_ENABLED` | `true` | 캐시 마스터 스위치 |
| `MEMORY_CACHE_ENABLED` | `true` | 메모리 LRU |
| `MEMORY_CACHE_MAX_ITEMS` | `500` | LRU 최대 엔트리 수 |
| `MEMORY_CACHE_MAX_BYTES` | `100MB` | LRU 최대 메모리 |
| `MEMORY_CACHE_TTL_MS` | `24h` | 기본 TTL |
| `REDIS_CACHE_ENABLED` | `false` | Redis 2-tier |
| `REDIS_URL` | (없음) | `redis://...` |
| `REDIS_CACHE_TTL_SEC` | `7d` | Redis 키 만료 |
| `REDIS_KEY_PREFIX` | `spa-seo:` | Redis 키 prefix |
| `SWR_WINDOW_MS` | `1h` | TTL 만료 후 stale 응답 + bg 갱신 윈도우 |

### 보안 / 제한
| 변수 | 기본 | 설명 |
|--|--|--|
| `RATE_LIMIT_ENABLED` | `true` | per-IP 요청 제한 |
| `RATE_LIMIT_MAX` | `120` | 윈도우당 최대 요청 |
| `RATE_LIMIT_WINDOW` | `1 minute` | 시간 윈도우 |
| `ALLOWED_HOSTS` | (origin 만) | CSV — render 가능한 호스트 화이트리스트 |

### Audit log (v1.5+)
| 변수 | 기본 | 설명 |
|--|--|--|
| `AUDIT_LOG_FILE` | (없음) | 모든 admin 액션을 JSONL 파일로 기록 |
| `AUDIT_WEBHOOK_URL` | (없음) | 액션 발생 시 POST. body 에 SHA-256 hash + prevHash 포함 |
| `AUDIT_WEBHOOK_SECRET` 또는 `HMAC_SECRET` | (없음) | HMAC-SHA256 서명 활성화. 변조 검출에 사용 |

### AI Schema 어댑터 (v1.6+, BYO)
| 변수 | 기본 | 설명 |
|--|--|--|
| `ANTHROPIC_API_KEY` | (없음) | `@heejun/spa-seo-gateway-anthropic` 어댑터가 자동 인식 |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | 어댑터에서 사용할 Claude 모델 |

> 어댑터는 사용자가 시작 시 `setAiSchemaAdapter()` 로 직접 주입해야 함. 자세히는 [LIBRARY-USAGE.md](LIBRARY-USAGE.md).

### 다중 모드
| 변수 | 기본 | 설명 |
|--|--|--|
| `TENANT_STORE_FILE` | `.data/tenants.json` | `saas` 모드 테넌트 저장 |
| `SITE_STORE_FILE` | `.data/sites.json` | `cms` 모드 사이트 저장 |

### 설정 파일 위치
| 변수 | 기본 | 설명 |
|--|--|--|
| `GATEWAY_CONFIG_FILE` | (자동) | 기본 후보: `seo-gateway.config.json`, `.seo-gateway.json` (cwd) |

---

## 설정 파일 (JSON) — 자동 자동완성

`seo-gateway.config.json` 에 `$schema` 를 지정하면 VSCode/IDEA 가 자동완성/검증 제공:

```json
{
  "$schema": "./schema/seo-gateway.config.schema.json",
  "originUrl": "https://www.example.com",
  "mode": "render-only",
  "renderer": {
    "poolMin": 2,
    "poolMax": 8,
    "waitUntil": "networkidle2"
  },
  "cache": {
    "memory": { "ttlMs": 86400000 },
    "swrWindowMs": 3600000,
    "redis": { "enabled": true, "url": "redis://localhost:6379" }
  },
  "routes": [
    { "pattern": "^/$", "ttlMs": 600000 },
    { "pattern": "^/products/", "ttlMs": 21600000, "waitSelector": "[data-loaded]" },
    { "pattern": "^/(account|admin|cart)(/|$)", "ignore": true }
  ],
  "rateLimit": { "max": 240 }
}
```

스키마 재생성:

```bash
pnpm run schema:gen
```

전체 예시는 `seo-gateway.config.example.json`.

---

## Per-route Override

`routes[]` 의 각 항목은 **URL 의 pathname+search 에 대한 정규식 매칭**. 매칭 시 해당 override 가 단일/CMS/SaaS 모드의 해당 컨텍스트에 적용됨.

| 필드 | 타입 | 설명 |
|--|--|--|
| `pattern` | string (regex) | 필수. 예: `"^/products/[0-9]+"` |
| `ignore` | boolean | true 면 렌더 스킵, 204 응답 |
| `ttlMs` | number | 라우트별 캐시 TTL 오버라이드 |
| `waitUntil` | enum | 라우트별 waitUntil 변경 |
| `waitSelector` | string | 추가 셀렉터 대기 |
| `waitMs` | number | 고정 대기시간 (waitUntil 후) |
| `blockResourceTypes` | string[] | 라우트별 차단 리소스 |
| `viewport` | `{width,height}` | 라우트별 viewport |
| `schemaTemplate` | enum | `Article` / `Product` / `FAQ` / `HowTo` / `WebSite` — 응답에 schema.org JSON-LD 자동 삽입 (v1.5+) |
| `variants` | array | A/B variant 메타 태그 — 같은 URL 에 다른 title/description weight 비율 노출 (v1.6+) |

#### `variants` 항목

```json
{
  "pattern": "^/products/",
  "variants": [
    { "title": "구매 30% 할인", "description": "...", "weight": 1 },
    { "title": "지금 구매하면 무료배송", "description": "...", "weight": 2 }
  ]
}
```

선택된 variant 인덱스는 응답 헤더 `x-prerender-variant` + Prometheus `gateway_variant_impressions_total{route,variant}` 로 노출. GA/Plausible 등 외부 분석과 매칭 가능.

매칭은 첫 매치가 승리 (위에서 아래로). 라우트 어드민 UI 에서 드래그 정렬은 미지원 — 순서가 중요하면 더 구체적인 패턴을 위로.

---

## 운영 모드별 추가 설정

### `cms` 모드 (다중 사이트)

사이트는 런타임에 `/admin/api/sites` 로 추가. 각 Site:

```json
{
  "id": "marketing",
  "name": "Marketing site",
  "origin": "https://www.example.com",
  "routes": [...],
  "enabled": true
}
```

자세한 운영은 [CMS-MODE.md](CMS-MODE.md).

### `saas` 모드 (다중 테넌트)

테넌트는 `/admin/api/tenants` 로 추가. 각 Tenant:

```json
{
  "id": "acme",
  "name": "ACME",
  "origin": "https://www.acme.com",
  "apiKey": "tk_live_xxxxxxxxxxxxxxxxxxxx",
  "plan": "pro",
  "routes": [...],
  "enabled": true
}
```

식별 전략 (기본): `host` → `apiKey` → `subdomain` → `pathPrefix` 순서. 자세한 사용은 [MULTI-TENANT.md](MULTI-TENANT.md).

---

## 모범 사례

1. **개발/스테이징**: `LOG_PRETTY=true`, `RATE_LIMIT_ENABLED=false`, 작은 `POOL_MAX`
2. **운영**: `REDIS_CACHE_ENABLED=true` (멀티 노드), `ADMIN_TOKEN` 비밀로, `ALLOWED_HOSTS` 명시
3. **Docker**: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (이미지에 chromium apt 설치)
4. **K8s**: shm_size ≥ 1GB, liveness=`/health`, readiness=`/health/deep`
5. **CDN 뒤**: `trustProxy: true` 는 자동 적용. `X-Forwarded-Host`/`Proto` 헤더 신뢰
