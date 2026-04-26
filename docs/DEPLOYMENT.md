# Deployment

게이트웨이를 운영 환경에 배포하는 패턴 모음.

## 1. Docker Compose (권장 시작점)

```bash
docker compose up -d
```

`docker-compose.yml` 은 게이트웨이 + Redis 를 함께 띄움. `docker compose logs -f gateway` 로 로그 확인.

환경변수는 `compose.yml` 또는 별도 `.env` 파일로 주입. 디스크 영구화가 필요한 항목 (multi-tenant/cms store) 은 named volume 추가:

```yaml
services:
  gateway:
    volumes:
      - gateway-data:/app/.data
volumes:
  gateway-data:
```

## 2. Docker (단독 컨테이너)

```bash
docker build -t spa-seo-gateway .
docker run -d \
  -p 3000:3000 \
  -e ORIGIN_URL=https://www.example.com \
  -e ADMIN_TOKEN=secret \
  -e REDIS_URL=redis://redis-host:6379 \
  -e REDIS_CACHE_ENABLED=true \
  --shm-size=1gb \
  -v gateway-data:/app/.data \
  spa-seo-gateway
```

`--shm-size=1gb` 는 Chromium 의 shared memory 크래시 방지를 위해 필수.

## 3. Kubernetes

`Deployment` + `Service` 예시:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spa-seo-gateway
spec:
  replicas: 3
  selector:
    matchLabels: { app: spa-seo-gateway }
  template:
    metadata:
      labels: { app: spa-seo-gateway }
    spec:
      containers:
      - name: gateway
        image: ghcr.io/blue45f/spa-seo-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: GATEWAY_MODE
          value: "cms"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef: { name: redis-creds, key: url }
        - name: REDIS_CACHE_ENABLED
          value: "true"
        - name: ADMIN_TOKEN
          valueFrom:
            secretKeyRef: { name: gateway-secrets, key: admin-token }
        resources:
          requests: { memory: "1Gi", cpu: "500m" }
          limits:   { memory: "2Gi", cpu: "2"   }
        livenessProbe:
          httpGet: { path: /health, port: 3000 }
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet: { path: /health/deep, port: 3000 }
          initialDelaySeconds: 30
          periodSeconds: 60
          timeoutSeconds: 30
        volumeMounts:
        - name: dshm
          mountPath: /dev/shm
        - name: data
          mountPath: /app/.data
      volumes:
      - name: dshm
        emptyDir: { medium: Memory, sizeLimit: 1Gi }
      - name: data
        persistentVolumeClaim:
          claimName: gateway-data-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: spa-seo-gateway
spec:
  selector: { app: spa-seo-gateway }
  ports:
  - port: 80
    targetPort: 3000
```

### graceful drain

`SIGTERM` 수신 후 30초 동안 in-flight 요청을 마무리하고 새 요청은 503. K8s rolling update 와 잘 맞음. `terminationGracePeriodSeconds: 60` 설정 권장.

### multi-tenant / cms 모드의 영구 저장

`Site` / `Tenant` 가 JSON 파일에 저장되므로 PVC 가 필수. 또는 외부 store 어댑터 작성 (Postgres, DynamoDB 등) 후 `FileTenantStore` 대신 사용.

## 4. CDN / Edge 통합

봇만 게이트웨이로, 사람은 origin 으로 분기:

### Cloudflare Workers

```js
export default {
  async fetch(req, env) {
    const ua = req.headers.get('user-agent') ?? '';
    const isBot = /googlebot|bingbot|yeti|naverbot|facebookexternalhit|twitterbot|slackbot/i.test(ua);
    if (!isBot) return fetch(req);  // 사람 → origin

    const url = new URL(req.url);
    url.hostname = env.SEO_GATEWAY_HOST;
    return fetch(url, { headers: req.headers });
  },
};
```

### Vercel (Edge Middleware)

```ts
import { NextResponse, type NextRequest } from 'next/server';

export const config = { matcher: '/((?!_next|api|favicon.ico).*)' };

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  if (!/googlebot|bingbot|yeti|naverbot/i.test(ua)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.hostname = process.env.SEO_GATEWAY_HOST!;
  return NextResponse.rewrite(url);
}
```

### Nginx

```nginx
map $http_user_agent $is_bot {
  default 0;
  ~*(googlebot|bingbot|yeti|naverbot|facebookexternalhit|twitterbot|slackbot|linkedinbot|telegrambot|whatsapp|kakaotalk-scrap|discordbot) 1;
}

upstream seo_gateway { server seo:3000; keepalive 32; }
upstream origin_spa  { server origin:3000; keepalive 32; }

server {
  listen 443 ssl http2;
  server_name www.example.com;
  location / {
    if ($is_bot) { proxy_pass http://seo_gateway; proxy_set_header Host $host; break; }
    proxy_pass http://origin_spa;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
  }
}
```

### Caddy

```caddyfile
www.example.com {
  @bots header_regexp User-Agent "(?i)(googlebot|bingbot|yeti|naverbot|facebookexternalhit)"
  handle @bots {
    reverse_proxy seo:3000
  }
  reverse_proxy origin:3000
}
```

## 5. AWS / Cloud Run / 기타

### Cloud Run

- min instances ≥ 1 (cold start 방지)
- CPU ≥ 1, RAM ≥ 1 GiB
- concurrency: 80 (기본값) 도 OK. 더 높이면 풀이 saturate
- chromium 다운로드는 빌드 시. 또는 `@sparticuz/chromium` 활용

### AWS ECS / Fargate

- task definition 의 `linuxParameters.sharedMemorySize: 1024` 설정 (Docker 의 `--shm-size=1gb` 동급)
- 1 vCPU + 2GB 가 시작점

### AWS Lambda

⚠ 비추천. Puppeteer 는 콜드 스타트 6–10초. 대신 컨테이너 호스팅을 권장.

### Vercel

⚠️ **Vercel Functions 단독 배포는 비추천.** 이유:

1. **Puppeteer 번들 크기**: chromium 이 ~250MB. `@sparticuz/chromium-min` 으로 ~30MB 까지 줄여도 Hobby 50MB 한도에 빠듯
2. **콜드 스타트**: Function 재시작마다 chromium 다시 launch → 5–10초 지연
3. **풀 / 캐시 휘발**: Function 인스턴스 사이에 브라우저 풀이나 메모리 캐시가 공유 안 됨 → Redis 필수, 그래도 풀의 효과는 0
4. **타임아웃**: 무거운 SPA 는 최대 함수 실행 시간을 넘길 수 있음 (Pro 300s, Hobby 60s)

**대안 1 — 하이브리드 (권장)**: Vercel 에는 SPA / 어드민 UI 만, 렌더 서비스는 별도 컨테이너 호스트.

```
┌──────────┐         ┌──────────────────┐         ┌────────────────┐
│  사용자    │ ─────→ │ Vercel (Edge)    │ ─bot──→ │ spa-seo-gateway│
│           │         │ + SPA + Edge MW  │         │ (Cloud Run/Fly)│
└──────────┘         └──────────────────┘         └────────────────┘
                              │ human
                              ▼
                          SPA origin
```

`middleware.ts` 에서 봇만 게이트웨이로 rewrite:

```ts
// middleware.ts (Vercel Edge)
import { type NextRequest, NextResponse } from 'next/server';

export const config = { matcher: '/((?!_next|api|favicon.ico).*)' };

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  const isBot = /googlebot|bingbot|yeti|naverbot|facebookexternalhit/i.test(ua);
  if (!isBot) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.hostname = process.env.SEO_GATEWAY_HOST!; // Cloud Run 등 외부 호스트
  return NextResponse.rewrite(url);
}
```

`SEO_GATEWAY_HOST` 환경변수에 게이트웨이 도메인 설정. 게이트웨이는 Cloud Run / Fly.io / Railway 등 컨테이너 호스트에 띄움.

**대안 2 — Vercel 에 직접 (실험적)**: Fluid Compute + `@sparticuz/chromium-min`

Vercel 의 Fluid Compute 는 Function 인스턴스를 재사용하므로 Lambda 보다 풀 효과가 일부 있음. 하지만:
- chromium-min 사용 필수
- 풀 사이즈 1 (인스턴스당 1 브라우저만)
- 캐시는 Redis (Upstash) 강제
- 단순 사이트 + 트래픽 적음에 한해 검토 가능

```ts
// api/render.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
// ... core 의 render 호출 시 executablePath 를 chromium.executablePath() 로
```

**현실적 결론**: 게이트웨이 자체는 **Cloud Run / Fly.io / Railway / ECS** 같은 장기 실행 컨테이너 호스트가 최적. Vercel 은 SPA + 봇 분기 미들웨어 용도로 활용.

## 6. CI/CD

`.github/workflows/ci.yml` 이 미리 셋업되어 있음:
- PR/push 마다: lint + typecheck + build + test + 스키마 생성
- main 푸시 시: multi-arch (amd64+arm64) Docker 빌드 + GHCR push

`ghcr.io/<org>/spa-seo-gateway:latest` 또는 `:short-sha` 로 이미지 pull.

## 7. 운영 체크리스트

- [ ] `ADMIN_TOKEN` 강한 시크릿. K8s Secret / AWS SSM / Vault 사용
- [ ] Redis 활성. 멀티 노드 시 필수
- [ ] CDN 에서 봇 분기 (게이트웨이가 사람 트래픽 받지 않도록)
- [ ] Liveness probe = `/health`, Readiness probe = `/health/deep` (실 렌더 확인)
- [ ] Prometheus 스크레이프 + 알람:
  - `histogram_quantile(0.95, rate(gateway_render_duration_ms_bucket[5m])) > 5000` → 느려짐
  - `rate(gateway_render_errors_total[5m]) > 0.5` → 오류 폭증
  - `sum(rate(gateway_cache_events_total{event="hit"}[5m])) / sum(rate(gateway_cache_events_total{event=~"hit|miss"}[5m])) < 0.7` → cache hit 떨어짐
- [ ] 정기 backup: `.data/sites.json` / `.data/tenants.json` (cms/saas 모드)
- [ ] log shipping: pino 의 stdout JSON 을 Loki/CloudWatch/Datadog 로
- [ ] tracing: OpenTelemetry 통합은 다음 마일스톤
