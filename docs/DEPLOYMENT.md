# Deployment

이 저장소는 **3개 티어**로 배포됩니다. 각 티어가 어디로 가는지부터 정리합니다.

## 0. 배포 아키텍처 (티어별 위치)

```
┌─────────────────────────────┐   ┌────────────────────────────────┐
│ FRONTEND (정적)               │   │ BACKEND (장기 실행 컨테이너)       │
│ apps/admin-frontend (Vite)   │   │ apps/gateway (Fastify+Puppeteer)│
│ apps/demo (정적 번들)          │   │ → Docker → GHCR → Fly/CloudRun  │
│ → Netlify / Vercel           │   │   /ECS/K8s, PORT=3000           │
└─────────────────────────────┘   └────────────────────────────────┘
            ▲                                   ▲
            │ deploy-netlify.yml                │ ci.yml(docker) + deploy-fly.yml
            │ (NETLIFY_* 시크릿 게이트)            │ (FLY_API_TOKEN 게이트)

┌──────────────────────────────────────────────────────────────────┐
│ LIBRARIES  packages/* (@heejun/spa-seo-gateway-core 등)            │
│ → npm 퍼블리시 (수동 / 릴리스 워크플로). 런타임 배포 아님.            │
└──────────────────────────────────────────────────────────────────┘
```

| 티어 | 산출물 | 빌드 커맨드 | 배포처 | CI 워크플로 |
|------|--------|------------|--------|------------|
| **Frontend** | `apps/demo/public` 정적 번들 (+ `/storybook` 서브경로) | `pnpm --filter @spa-seo-gateway/admin-frontend run build && pnpm --filter @spa-seo-gateway/demo run build` (+ `build-storybook`) | Netlify(주) / Vercel | `.github/workflows/deploy-netlify.yml`, `vercel.json` |
| **Backend** | `Dockerfile` 컨테이너 이미지 (`apps/gateway/dist/main.js`, PORT 3000) | `docker build .` → `pnpm run build` (멀티스테이지) | GHCR + Fly.io(또는 Cloud Run/ECS/K8s) | `.github/workflows/ci.yml`(docker job → GHCR), `.github/workflows/deploy-fly.yml`(Fly), `fly.toml` |
| **Libraries** | `packages/*/dist` | `pnpm run build` | npm (수동) | — |

### 필수 환경변수 / 시크릿

**Backend (게이트웨이 런타임)** — 전체 목록은 `.env.example` 참고. 운영 핵심:

| 변수 | 용도 | 비고 |
|------|------|------|
| `HOST` / `PORT` | 리슨 주소 | 기본 `0.0.0.0:3000` (컨테이너 호스트가 PORT 주입 가능) |
| `GATEWAY_MODE` | `render-only` / `proxy` / `cms` / `saas` | |
| `ORIGIN_URL` | SPA origin | proxy 모드 필수 |
| `ADMIN_TOKEN` | 관리자 API(`x-admin-token`) | **강한 시크릿. fly secrets / K8s Secret 로 주입** |
| `REDIS_URL` / `REDIS_CACHE_ENABLED` | 분산 캐시 | 멀티 노드 시 필수 |
| `PUPPETEER_EXECUTABLE_PATH` | 시스템 chromium | Dockerfile runtime 단계에 이미 설정됨 |

**GitHub Actions 시크릿** (없으면 해당 deploy job 이 **자동 skip** — 빨간 X 안 뜸):

| 시크릿 | 사용 워크플로 | 없을 때 동작 |
|--------|--------------|-------------|
| `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | `deploy-netlify.yml` | 프론트 배포 skip |
| `FLY_API_TOKEN` | `deploy-fly.yml` | 백엔드 배포 skip |
| `GITHUB_TOKEN` (자동) | `ci.yml` docker job | GHCR push (시크릿 불필요) |

### Preview vs Production

- **Frontend**: `deploy-netlify.yml` 은 `main` 푸시 시 `--prod` 로 프로덕션만 배포. PR 프리뷰가 필요하면 Netlify 의 Git 연동(또는 `vercel.json`+Vercel Git 연동)을 사용하면 PR 마다 자동 프리뷰 URL 이 생성됨 (별도 워크플로 불필요).
- **Backend**: `ci.yml` 의 docker job 이 `main` 푸시마다 `ghcr.io/<repo>:latest` + `:<short-sha>` 를 발행. `deploy-fly.yml` 은 게이트웨이 관련 경로 변경 시 Fly 로 배포. 스테이징은 Fly 의 별도 app(예: `spa-seo-gateway-staging`) 으로 `fly.toml` 을 복제하거나 `--app` 플래그로 분리 권장.

### 메인테이너가 대시보드에서 직접 해야 하는 수동 단계

CI deploy 스텝은 시크릿이 없으면 skip 되므로, 최초 1회는 수동 설정이 필요합니다.

1. **Netlify**: 사이트 생성 → Site ID 확보 → GitHub repo 시크릿에 `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` 등록. (또는 Vercel 프로젝트를 import 하고 `vercel.json` 의 buildCommand/outputDirectory 를 그대로 사용.)
2. **Fly.io**: `fly launch --no-deploy --copy-config --name spa-seo-gateway` → `fly secrets set ADMIN_TOKEN=... REDIS_URL=...` → `fly tokens create deploy` 로 토큰 발급 후 GitHub repo 시크릿 `FLY_API_TOKEN` 등록. 이후 `deploy-fly.yml` 이 자동 동작.
3. **GHCR**: 추가 설정 불필요(`GITHUB_TOKEN` 자동). 외부 클러스터에서 pull 하려면 패키지를 public 으로 전환하거나 imagePullSecret 설정.

> 아래 섹션들은 **호스트별 상세 패턴**입니다. 위 표가 "어디에 무엇이 가는가"의 정본이고, 아래는 그 구현 디테일입니다.

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

세 워크플로가 티어별 배포를 담당하며, **deploy 워크플로는 시크릿이 없으면 모든 스텝을 skip** 합니다 (포크/외부 기여자 보호).

### `.github/workflows/ci.yml` — 품질 게이트 + 백엔드 이미지

- `quality` job: 모든 PR/push 에서 `pnpm run verify` (= `validate:architecture` + `format:check` + lint + typecheck + build + test + schema:gen).
- `docker` job: `main` 푸시 시에만, multi-arch (amd64+arm64) Docker 빌드 + GHCR push → `ghcr.io/<repo>:latest`, `:<short-sha>`. `GITHUB_TOKEN` 자동 사용(별도 시크릿 불필요).

### `.github/workflows/deploy-netlify.yml` — 프론트엔드 (정적)

- `apps/admin-frontend` / `apps/demo` / `packages/{core,admin-ui}` 변경 시 `main` 에서 트리거.
- admin-frontend + demo 빌드 → admin **Storybook** 빌드(`build-storybook` → `apps/admin-frontend/storybook-static`)를 `apps/demo/public/storybook/` 로 복사 → `netlify deploy --prod --dir apps/demo/public`.
  - Storybook 스테이징 스텝은 **반드시 데모 빌드 다음**에 실행됩니다. 데모 빌드(`apps/demo/build.js`)가 `apps/demo/public` 을 통째로 비우고 재생성하므로, 먼저 넣으면 지워집니다.
- 단일 배포(별도 사이트/컨텍스트 불필요)로 데모는 `/`, 디자인 시스템(Storybook)은 **`/storybook`** 경로에 함께 게시됩니다.
- `NETLIFY_AUTH_TOKEN` 또는 `NETLIFY_SITE_ID` 미설정 시 전 스텝 skip (Storybook 빌드/스테이징 스텝도 동일 게이트).

#### Storybook (디자인 시스템) 게시 경로

| 항목 | 값 |
|------|-----|
| URL | `https://<netlify-site>/storybook/` (예: 커스텀 도메인 사용 시 `https://<도메인>/storybook/`) |
| 빌드 커맨드 | `pnpm --filter @spa-seo-gateway/admin-frontend run build-storybook` (= 루트 `pnpm run build-storybook`) |
| 빌드 산출물 | `apps/admin-frontend/storybook-static` (gitignored) |
| 배포 위치 | `apps/demo/public/storybook/` 로 복사되어 데모 번들과 한 번에 배포 |

### `.github/workflows/deploy-fly.yml` — 백엔드 (게이트웨이 컨테이너)

- 게이트웨이/코어/Dockerfile/`fly.toml` 변경 시 `main` 에서 트리거.
- `flyctl deploy --remote-only --config fly.toml` (원격 빌드, 위 Dockerfile 사용).
- `FLY_API_TOKEN` 미설정 시 전 스텝 skip — Netlify 워크플로와 동일한 게이트 패턴.

> GHCR 이미지를 직접 끌어 쓰는 호스트(Cloud Run/ECS/K8s)는 `deploy-fly.yml` 없이 `ghcr.io/<repo>:latest` 만 pull 하면 됩니다. Fly 는 declarative IaC(`fly.toml`) 경로의 예시입니다.

## 7. 운영 체크리스트

- [ ] `ADMIN_TOKEN` 강한 시크릿. K8s Secret / AWS SSM / Vault / `fly secrets` 사용
- [ ] 보안 응답 헤더는 게이트웨이가 자동 부여 (nosniff/referrer-policy/admin frame guard, `apps/gateway/src/security-headers.ts`). TLS 종단(CDN/프록시)에서 HSTS 추가 권장
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
