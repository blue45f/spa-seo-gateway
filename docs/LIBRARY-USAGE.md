# Library Usage Guide

`spa-seo-gateway` 의 패키지들을 **외부 프로젝트에서 라이브러리로 사용**하는 방법을 자세히 설명합니다.

## 어떤 시나리오에 라이브러리로 쓰나?

| 상황 | 어떤 패키지 |
|--|--|
| 단일 사이트 SEO 게이트웨이를 빠르게 띄우고 싶다 | `@spa-seo-gateway/gateway` 클론 + 환경변수 |
| 기존 Fastify 앱에 봇 렌더링 미들웨어를 끼워 넣고 싶다 | `@heejun/spa-seo-gateway-core` 만 |
| SaaS 형태로 여러 고객 사이트를 서비스 한다 | `core` + `multi-tenant` (+ 선택: `admin-ui`) |
| 같은 조직이 여러 사이트를 관리한다 | `core` + `cms` (+ 선택: `admin-ui`) |
| 빌드 단계에서 정적 HTML 생성 (SSG-like) | `core` 만 (`render()` 직접 호출) |
| Cron 으로 sitemap 워밍만 하고 싶다 | `core` 만 (`warmFromSitemap()`) |

## 패키지 구성 한 줄 정리

```
@heejun/spa-seo-gateway-core           ← 렌더링 엔진 (HTTP 비의존)
@heejun/spa-seo-gateway-admin-ui       ← Fastify 플러그인 + Alpine SPA (이 어드민 콘솔)
@heejun/spa-seo-gateway-multi-tenant   ← SaaS 다중 테넌트 (Fastify 플러그인)
@heejun/spa-seo-gateway-cms            ← 다중 사이트 (Fastify 플러그인)
@spa-seo-gateway/gateway        ← 위 4개를 합성한 실행 가능한 앱 (참조용)
```

---

## 설치

```bash
# 가장 흔한 조합
pnpm add @heejun/spa-seo-gateway-core @heejun/spa-seo-gateway-admin-ui fastify

# SaaS 모드
pnpm add @heejun/spa-seo-gateway-core @heejun/spa-seo-gateway-multi-tenant @heejun/spa-seo-gateway-admin-ui fastify

# CMS 모드
pnpm add @heejun/spa-seo-gateway-core @heejun/spa-seo-gateway-cms @heejun/spa-seo-gateway-admin-ui fastify

# 코어만 (직접 미들웨어로 끼우는 경우)
pnpm add @heejun/spa-seo-gateway-core
```

`puppeteer` 는 core 의 의존성이라 자동 설치되며, 처음에 chromium 을 다운로드합니다.
시스템 chromium 을 쓰려면 설치 전 `PUPPETEER_SKIP_DOWNLOAD=true` + `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` 환경변수.

### TypeScript

모든 패키지는 d.ts 가 동봉되어 있어 별도 `@types/...` 가 필요 없습니다. `tsconfig.json` 의 `module: "NodeNext"` 권장.

---

## 시나리오 1 — 직접 게이트웨이 구성

가장 흔한 사용법. `apps/gateway` 가 하는 일을 직접 작성.

```ts
// my-gateway.ts
import Fastify from 'fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import {
  browserPool,
  cacheKey,
  cacheSwr,
  config,
  detectBot,
  logger,
  registry,
  render,
  shutdownCache,
} from '@heejun/spa-seo-gateway-core';
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui';

const app = Fastify({
  loggerInstance: logger,
  trustProxy: true,
  bodyLimit: 4 * 1024 * 1024,
  keepAliveTimeout: 65_000,
});

await app.register(compress, { encodings: ['br', 'gzip'] });
await app.register(cors);

// /health, /metrics 직접 노출
app.get('/health', async () => ({ ok: true, uptime: process.uptime() }));
app.get('/metrics', async (_req, reply) => {
  reply.header('content-type', registry.contentType);
  return registry.metrics();
});

// 어드민 UI (선택)
await registerAdminUI(app, { prefix: '/admin/ui' });

// 봇 분기 + 렌더
app.all('/*', async (req, reply) => {
  if (req.url.startsWith('/health') || req.url.startsWith('/metrics') || req.url.startsWith('/admin')) {
    return null;
  }
  const detection = detectBot(req.headers['user-agent'], req.headers, req.query);
  if (!detection.isBot) {
    reply.code(204).send();
    return null;
  }

  const target = new URL(req.url, config.originUrl ?? 'https://your-spa.example.com').toString();
  const key = cacheKey(target);
  const result = await cacheSwr(key, () =>
    render({ url: target, headers: req.headers }),
  );

  reply.code(result.entry.status);
  for (const [k, v] of Object.entries(result.entry.headers)) reply.header(k, v);
  reply.header('x-cache', result.fromCache ? 'HIT' : 'MISS');
  return result.entry.body;
});

await browserPool.start();
await app.listen({ host: '0.0.0.0', port: 3000 });

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  await app.close();
  await browserPool.stop();
  await shutdownCache();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

`config.originUrl` 은 환경변수 `ORIGIN_URL` 로 자동 채워집니다.

---

## 시나리오 2 — SaaS 다중 테넌트

```ts
import Fastify from 'fastify';
import { browserPool } from '@heejun/spa-seo-gateway-core';
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui';
import {
  FileTenantStore,
  registerMultiTenant,
  type Tenant,
  type TenantStore,
} from '@heejun/spa-seo-gateway-multi-tenant';

const app = Fastify();
const store = new FileTenantStore('./data/tenants.json');

await registerMultiTenant(app, {
  store,
  adminToken: process.env.ADMIN_TOKEN,
  resolve: ['host', 'apiKey'],   // 인입 테넌트 식별 우선순위
});

await registerAdminUI(app, { prefix: '/admin/ui' });
await browserPool.start();
await app.listen({ port: 3000 });
```

테넌트 추가는 admin API (또는 부팅 시 코드에서):

```ts
await store.upsert({
  id: 'acme',
  name: 'ACME Inc',
  origin: 'https://www.acme.com',
  apiKey: `tk_live_${Math.random().toString(36).slice(2)}`,
  routes: [
    { pattern: '^/$', ttlMs: 600_000 },
    { pattern: '^/(account|cart)', ignore: true },
  ],
  plan: 'pro',
  enabled: true,
});
```

### 커스텀 TenantStore (Postgres 예시)

`TenantStore` 인터페이스만 만족하면 어떤 백엔드든 OK.

```ts
import { type Tenant, type TenantStore } from '@heejun/spa-seo-gateway-multi-tenant';
import { sql } from './db.js';

export class PostgresTenantStore implements TenantStore {
  async list(): Promise<Tenant[]> {
    return (await sql`SELECT id, name, origin, api_key as "apiKey", routes, plan, enabled FROM tenants`) as Tenant[];
  }
  async byId(id: string) {
    const r = await sql`SELECT * FROM tenants WHERE id = ${id} LIMIT 1`;
    return (r[0] as Tenant) ?? null;
  }
  async byApiKey(key: string) {
    const r = await sql`SELECT * FROM tenants WHERE api_key = ${key} LIMIT 1`;
    return (r[0] as Tenant) ?? null;
  }
  async byHost(host: string) {
    const r = await sql`SELECT * FROM tenants WHERE origin LIKE ${'%' + host + '%'} LIMIT 1`;
    return (r[0] as Tenant) ?? null;
  }
  async upsert(t: Tenant) {
    await sql`INSERT INTO tenants (id, name, origin, api_key, routes, plan, enabled)
              VALUES (${t.id}, ${t.name}, ${t.origin}, ${t.apiKey}, ${JSON.stringify(t.routes)}, ${t.plan}, ${t.enabled})
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                origin = EXCLUDED.origin,
                routes = EXCLUDED.routes,
                plan = EXCLUDED.plan,
                enabled = EXCLUDED.enabled`;
    return t;
  }
  async remove(id: string) {
    const r = await sql`DELETE FROM tenants WHERE id = ${id}`;
    return r.count > 0;
  }
}
```

---

## 시나리오 3 — CMS 다중 사이트

조직 내부 다중 사이트 관리.

```ts
import Fastify from 'fastify';
import { browserPool } from '@heejun/spa-seo-gateway-core';
import { registerCms, FileSiteStore } from '@heejun/spa-seo-gateway-cms';
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui';

const app = Fastify();
const store = new FileSiteStore('./data/sites.json');

// 부팅 시 사이트 자동 등록 (없으면)
await store.upsert({
  id: 'marketing',
  name: 'Marketing',
  origin: 'https://www.example.com',
  routes: [],
  enabled: true,
});

await registerCms(app, { store, adminToken: process.env.ADMIN_TOKEN });
await registerAdminUI(app, { prefix: '/admin/ui' });
await browserPool.start();
await app.listen({ port: 3000 });
```

들어오는 요청의 `Host` 헤더가 등록된 사이트의 `origin` host 와 매칭되면 그 사이트의 routes/캐시 네임스페이스가 적용.

---

## 시나리오 4 — 기존 Fastify 앱에 임베드

이미 Fastify 백엔드가 있고, 봇 트래픽만 SEO 렌더로 분기하고 싶을 때.

```ts
import { browserPool, cacheKey, cacheSwr, detectBot, render } from '@heejun/spa-seo-gateway-core';

await browserPool.start();

// 모든 라우트보다 먼저 실행
app.addHook('preHandler', async (req, reply) => {
  // /api, /admin 등 백엔드 자체 라우트는 패스
  if (req.url.startsWith('/api') || req.url.startsWith('/admin')) return;

  const detection = detectBot(req.headers['user-agent'], req.headers, req.query);
  if (!detection.isBot) return; // 사람은 다음 핸들러로

  const target = new URL(req.url, 'https://your-spa.example.com').toString();
  const key = cacheKey(target);
  const result = await cacheSwr(key, () => render({ url: target, headers: req.headers }));

  reply.code(result.entry.status);
  for (const [k, v] of Object.entries(result.entry.headers)) reply.header(k, v);
  return reply.send(result.entry.body); // 핸들러 진행 중단
});
```

---

## 시나리오 5 — 단발 렌더 CLI / SSG

빌드 단계에서 정적 HTML 생성, cron 워밍 등.

```ts
import { browserPool, render, warmFromSitemap } from '@heejun/spa-seo-gateway-core';
import { writeFileSync } from 'node:fs';

await browserPool.start();
try {
  // 단일 URL 렌더
  const entry = await render({
    url: 'https://www.example.com/posts/hello',
    headers: { 'user-agent': 'Googlebot/2.1' },
  });
  writeFileSync('out/posts/hello.html', entry.body, 'utf8');

  // sitemap 일괄 워밍
  const report = await warmFromSitemap('https://www.example.com/sitemap.xml', {
    max: 1000,
    concurrency: 4,
  });
  console.log(`warmed: ${report.warmed} / errors: ${report.errors}`);
} finally {
  await browserPool.stop();
}
```

---

## 시나리오 6 — Express / Hono / Koa 와 함께

`core` 는 HTTP 프레임워크 비의존이라 어떤 프레임워크와도 결합 가능.

### Express

```ts
import express from 'express';
import { browserPool, cacheKey, cacheSwr, detectBot, render } from '@heejun/spa-seo-gateway-core';

await browserPool.start();
const app = express();

app.use(async (req, res, next) => {
  const detection = detectBot(req.headers['user-agent'], req.headers, req.query);
  if (!detection.isBot) return next();

  const target = new URL(req.url, 'https://your-spa.example.com').toString();
  const key = cacheKey(target);
  const result = await cacheSwr(key, () =>
    render({ url: target, headers: req.headers as Record<string, string> }),
  );

  res.status(result.entry.status);
  for (const [k, v] of Object.entries(result.entry.headers)) res.setHeader(k, v);
  res.send(result.entry.body);
});

app.listen(3000);
```

### Hono (edge-aware Node)

```ts
import { Hono } from 'hono';
import { browserPool, cacheKey, cacheSwr, detectBot, render } from '@heejun/spa-seo-gateway-core';

await browserPool.start();
const app = new Hono();

app.use(async (c, next) => {
  const detection = detectBot(c.req.header('user-agent'), c.req.header(), c.req.query());
  if (!detection.isBot) return next();

  const target = new URL(c.req.path, 'https://your-spa.example.com').toString();
  const key = cacheKey(target);
  const result = await cacheSwr(key, () =>
    render({ url: target, headers: Object.fromEntries(Object.entries(c.req.header())) }),
  );
  return c.html(result.entry.body, result.entry.status);
});
```

> ⚠️ Hono on Cloudflare Workers / Vercel Edge 는 Puppeteer 미지원. Node.js 런타임만 사용.

---

## API 레퍼런스 (간단판)

### `@heejun/spa-seo-gateway-core`

```ts
// 렌더링
function render(input: { url: string; headers: Record<string, string | string[] | undefined>; route?: RouteOverride | null; }): Promise<CacheEntry>;

// 캐시
function cacheGet(key: string): Promise<CacheEntry | undefined>;
function cacheSet(key: string, entry: CacheEntry): Promise<void>;
function cacheDel(key: string): Promise<void>;
function cacheClear(): Promise<number>;
function cacheSwr(key: string, fetcher: () => Promise<CacheEntry>, customTtlMs?: number): Promise<SwrResult>;

// 키 / URL
function cacheKey(url: string, locale?: string, namespace?: string): string;
function normalize(url: string): string;
function isHostAllowed(targetUrl: string): boolean;
function isSafeTarget(url: string): Promise<{ ok: boolean; reason?: string }>;
function buildTargetUrl(req: { url: string; headers: ... }): string;

// 봇
function detectBot(ua: string | undefined, headers: ..., query: ...): DetectionResult;

// 라우트 (런타임)
function getRoutes(): RouteOverride[];
function setRoutes(next: RouteOverride[]): void;
function matchRoute(targetUrl: string): RouteOverride | null;
function persistRoutesToFile(filePath?: string): Promise<{ ok, path, error? }>;

// 풀
const browserPool: { start(); stop(); withPage<T>(fn): Promise<T>; stats(); };

// 워밍
function warmFromSitemap(sitemapUrl: string, opts?: { max?, concurrency? }): Promise<WarmReport>;

// HTML 후처리
function optimizeHtml(html: string, opts: { url, ensureBase?, ensureCanonical?, stripScripts? }): string;
function applyRequestInterception(page: Page, options?: { blockResourceTypes?, blockUrlPatterns? }): Promise<void>;

// 품질 / 안정성
function assessQuality(html: string, opts?: { minTextLength? }): QualityVerdict;
function shortTtlForStatus(status: number): number | null;
function withBreaker<TArgs, TResult>(host: string, fn: (...args: TArgs) => Promise<TResult>): typeof fn;
function isCircuitOpen(host: string): boolean;
function breakerStats(): Record<string, { opened: boolean; stats: any }>;

// 메트릭 / 로거
const registry: prom-client Registry;
const logger: pino Logger;

// 설정
const config: Config;     // env + JSON 파일에서 자동 로드
const ConfigSchema: z.ZodType;  // 외부에서 검증할 때
```

### `@heejun/spa-seo-gateway-multi-tenant`

```ts
function registerMultiTenant(app, opts: { store, adminToken?, resolve? }): Promise<void>;
class FileTenantStore implements TenantStore {}
class InMemoryTenantStore implements TenantStore {}
type Tenant, TenantStore;
```

### `@heejun/spa-seo-gateway-cms`

```ts
function registerCms(app, opts: { store, adminToken? }): Promise<void>;
class FileSiteStore implements SiteStore {}
class InMemorySiteStore implements SiteStore {}
type Site, SiteStore;
```

### `@heejun/spa-seo-gateway-admin-ui`

```ts
function registerAdminUI(app, opts?: { prefix?, tokenHeader? }): Promise<void>;
```

---

## 환경변수 (라이브러리 모드도 동일)

`config` 모듈이 모듈 로드 시점에 `process.env` 와 `seo-gateway.config.json` 을 자동으로 읽습니다. 라이브러리로 쓰는 외부 프로젝트도 같은 환경변수가 동작합니다. 전체 목록은 [CONFIGURATION.md](CONFIGURATION.md).

핵심:

```ini
ORIGIN_URL=https://your-spa.example.com
POOL_MIN=2 POOL_MAX=8
WAIT_UNTIL=networkidle2
BLOCK_RESOURCE_TYPES=image,media,font
MEMORY_CACHE_TTL_MS=86400000   # 24h
SWR_WINDOW_MS=3600000          # 1h
ADMIN_TOKEN=secret
REDIS_CACHE_ENABLED=true
REDIS_URL=redis://...
```

---

## Graceful Shutdown 권장 패턴

```ts
import { browserPool, logger, shutdownCache } from '@heejun/spa-seo-gateway-core';

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'graceful shutdown initiated');
  try {
    await app.close();          // 신규 요청 차단 + in-flight 마무리
    await browserPool.stop();   // 풀 + 활성 페이지 정리
    await shutdownCache();      // Redis 연결 종료
  } finally {
    process.exit(0);
  }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

K8s rolling update 와 잘 맞습니다 (`terminationGracePeriodSeconds: 60` 설정).

---

## 라이브러리 모드 트러블슈팅

| 증상 | 원인 / 해결 |
|--|--|
| `cannot find module '@heejun/spa-seo-gateway-core'` | npm install 후 build 필요. 워크스페이스 사용이면 `pnpm install` |
| 첫 렌더가 매우 느리다 (5초+) | chromium cold start. `browserPool.start()` 를 앱 부팅 시 호출해 사전 워밍 |
| `Method 'OPTIONS' already declared for route '/*'` | `app.all('/*')` 와 `@fastify/cors` 충돌. `app.route({ method: ['GET','POST',...], ... })` 로 명시 |
| 메모리 무한 증가 | 풀 자동 재시작 (`MAX_REQUESTS_PER_BROWSER`) 동작 확인. 라이브러리 사용 시에도 동일하게 동작 |
| Redis 에러 로그 + 동작은 함 | 정상. 메모리 캐시로 자동 강등. Redis 정상화되면 자동 재연결 |
| TypeScript `Cannot find name 'process'` | `tsconfig.json` 에 `"types": ["node"]` 추가 |

문의 / 이슈: [github.com/blue45f/spa-seo-gateway/issues](https://github.com/blue45f/spa-seo-gateway/issues)
