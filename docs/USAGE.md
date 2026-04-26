# 사용 가이드

## 1. 운영 모드 선택

### A. `render-only` 모드 (권장)

게이트웨이는 **렌더 API** 역할만. 봇/사람 분기는 앞단의 Nginx/Caddy/CDN/Edge 에서 수행.

```
                        UA 가 봇이면 ──→ spa-seo-gateway:3000
   봇 ─→ Nginx
                        UA 가 사람이면 ─→ origin-spa.example.com
```

**장점**: 분기 로직이 인프라 레이어에 있어서 자유로움. 게이트웨이는 stateless 렌더 서비스.

### B. `proxy` 모드

게이트웨이가 직접 리버스 프록시. 봇은 렌더, 사람은 origin 으로 통과.

```
모든 요청 ─→ spa-seo-gateway:3000 ─→ origin-spa.example.com (사람)
                                  └─→ headless render (봇)
```

**장점**: 인프라 단순. 단일 컴포넌트.

`.env` 에서:
```ini
GATEWAY_MODE=proxy
ORIGIN_URL=https://origin-spa.example.com
```

---

## 2. Nginx 와 연동 (render-only 모드)

```nginx
map $http_user_agent $is_bot {
    default 0;
    ~*(googlebot|bingbot|yandexbot|baiduspider|duckduckbot|naverbot|yeti|facebookexternalhit|twitterbot|slackbot|linkedinbot|telegrambot|whatsapp|kakaotalk-scrap|discordbot) 1;
}

upstream spa_origin {
    server origin-spa.internal:3000;
    keepalive 32;
}

upstream spa_seo_gateway {
    server seo-gateway.internal:3000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name www.example.com;

    location / {
        if ($is_bot) {
            proxy_pass http://spa_seo_gateway;
            break;
        }
        proxy_pass http://spa_origin;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`X-Render-URL` 헤더로 게이트웨이에 정확한 대상 URL 을 알릴 수도 있습니다. 미지정 시 `Host` + `URL` 로 자동 조립.

## 3. Caddy 연동

```caddyfile
www.example.com {
    @bots header_regexp User-Agent "(?i)(googlebot|bingbot|yeti|naverbot|facebookexternalhit)"
    handle @bots {
        reverse_proxy seo-gateway.internal:3000
    }
    reverse_proxy origin-spa.internal:3000
}
```

## 4. Cloudflare Workers 연동

봇만 Workers 에서 게이트웨이로 라우팅:

```js
export default {
  async fetch(req, env) {
    const ua = req.headers.get('user-agent') ?? '';
    const isBot = /googlebot|bingbot|yeti|naverbot|facebookexternalhit/i.test(ua);
    if (isBot) {
      const url = new URL(req.url);
      url.hostname = env.SEO_GATEWAY_HOST;
      return fetch(url.toString(), { headers: req.headers });
    }
    return fetch(req);
  },
};
```

## 5. 환경 변수 전체 목록

`.env.example` 참고. 주요 항목:

### 풀 튜닝
- `POOL_MIN` (기본 2): 사전 워밍할 브라우저 수
- `POOL_MAX` (기본 8): 동시 렌더 가능한 페이지 수
- `MAX_REQUESTS_PER_BROWSER` (기본 1000): 자동 재시작 임계
- `PAGE_TIMEOUT_MS` (기본 25000): 단일 렌더 최대 시간

### 대기 전략
- `WAIT_UNTIL`: `load` / `domcontentloaded` / `networkidle0` / `networkidle2`
  - **networkidle2** (기본): 가장 안전. 500ms 동안 ≤2 연결.
  - **networkidle0**: 더 엄격. 느린 사이트엔 부담.
  - **domcontentloaded**: 가장 빠름. SPA 는 비추천 (콘텐츠 미렌더).
- `WAIT_PRERENDER_READY=true` 인 경우, SPA 코드에서:
  ```js
  // 데이터 로드 끝나면
  window.prerenderReady = true;
  ```
  로 명시 시그널 가능. 5초까지 대기.
- `WAIT_SELECTOR=#main-content` 처럼 셀렉터 등장까지 대기 가능.

### 리소스 차단
- `BLOCK_RESOURCE_TYPES=image,media,font` — 평균 50%+ 단축
- `BLOCK_URL_PATTERNS=google-analytics.com,googletagmanager.com,...` — 불필요한 외부 호출 제거

### 캐시
- `MEMORY_CACHE_TTL_MS=86400000` (24h)
- `SWR_WINDOW_MS=3600000` (1h) — 만료 직후 stale 응답 윈도우
- `REDIS_CACHE_ENABLED=true` + `REDIS_URL=redis://...` — 분산 환경에서 활성

### 보안
- `ALLOWED_HOSTS=www.example.com,m.example.com` — 빈 값이면 `ORIGIN_URL` 호스트만
- `RATE_LIMIT_MAX=120` / 분
- `ADMIN_TOKEN=...` — `/admin/*` 인증

---

## 6. 캐시 무효화

배포 후 즉시 새 콘텐츠를 봇에게 보여주려면:

```bash
# 단일 URL 무효화
curl -X POST http://localhost:3000/admin/cache/invalidate \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"url":"https://www.example.com/posts/123"}'

# 전체 무효화
curl -X POST http://localhost:3000/admin/cache/clear \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

CI/CD 에 추가 (예: Vercel `postdeploy`, GitHub Actions):

```yaml
- name: Invalidate SEO cache
  run: |
    curl -X POST https://seo.example.com/admin/cache/clear \
      -H "X-Admin-Token: ${{ secrets.SEO_ADMIN_TOKEN }}"
```

---

## 7. 모니터링

### Prometheus 스크레이프

```yaml
scrape_configs:
  - job_name: spa-seo-gateway
    metrics_path: /metrics
    static_configs:
      - targets: ['seo-gateway:3000']
```

### 핵심 메트릭

| 메트릭 | 의미 |
|--|--|
| `gateway_render_duration_ms` | 렌더 소요 시간 히스토그램 |
| `gateway_cache_events_total` | hit / miss / swr / dedup |
| `gateway_browser_pool` | total / active / idle / concurrent |
| `gateway_inflight_renders` | 현재 진행 중 렌더 수 |
| `gateway_render_errors_total` | reason = timeout / network / crashed / pool-exhausted |
| `gateway_http_requests_total` | route × status × kind |

### 추천 알람

```yaml
- alert: SeoGatewayHighRenderLatency
  expr: histogram_quantile(0.95, rate(gateway_render_duration_ms_bucket[5m])) > 5000
- alert: SeoGatewayCacheHitDrop
  expr: |
    sum(rate(gateway_cache_events_total{event="hit"}[5m])) /
    sum(rate(gateway_cache_events_total{event=~"hit|miss"}[5m]))
    < 0.7
- alert: SeoGatewayPoolExhausted
  expr: increase(gateway_render_errors_total{reason="pool-exhausted"}[5m]) > 0
```

---

## 8. 배포 옵션

### Docker (권장)

```bash
docker compose up -d
```

### Kubernetes

`docker-compose.yml` 의 환경 변수를 그대로 ConfigMap/Secret 으로. shared memory 가 중요:
```yaml
spec:
  containers:
  - name: gateway
    image: spa-seo-gateway:latest
    resources:
      requests: { memory: "1Gi", cpu: "500m" }
      limits:   { memory: "2Gi", cpu: "2"   }
  volumes:
  - name: dshm
    emptyDir: { medium: Memory, sizeLimit: "1Gi" }
  volumeMounts:
  - mountPath: /dev/shm
    name: dshm
```

### Vercel / Cloud Run

⚠️ Puppeteer 는 큰 의존성이라 cold-start 가 느립니다. 다음을 권장:
- **Cloud Run**: min instances ≥ 1, CPU 1, RAM 1Gi+
- **Vercel**: Functions 으로는 부적합. Vercel Sandbox 또는 별도 컨테이너 호스트 사용

### AWS Lambda / Functions

`@sparticuz/chromium` (Lambda 용 슬림 chromium) 으로 교체:
```ts
import chromium from '@sparticuz/chromium';
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args,
  headless: 'shell',
});
```
하지만 성능상 컨테이너 / VM 호스트가 훨씬 유리.
