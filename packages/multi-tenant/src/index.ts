/**
 * @spa-seo-gateway/multi-tenant — option B (SaaS layer)
 *
 * 한 인스턴스가 여러 테넌트(고객 사이트)를 동시에 서비스. 각 테넌트는
 * 자기 origin / routes / API key 를 가진다. 디스크 영구 저장 (JSON file).
 *
 * 운영 흐름:
 *   1. 마스터 admin token 으로 /admin/api/tenants CRUD
 *   2. 각 테넌트는 자기 apiKey 또는 host 로 인입
 *   3. 게이트웨이가 테넌트 컨텍스트 (origin, routes, cache namespace) 로 렌더
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  type CacheEntry,
  cacheClear,
  cacheDel,
  cacheKey,
  cacheStats,
  cacheSwr,
  config,
  detectBot,
  httpRequests,
  isHostAllowed,
  isSafeTarget,
  logger,
  type RouteOverride,
  render,
} from '@spa-seo-gateway/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export const TenantSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, 'lowercase alphanumeric/-/_'),
  name: z.string().min(1),
  origin: z.string().url(),
  apiKey: z.string().min(20),
  routes: z
    .array(
      z.object({
        pattern: z.string(),
        ttlMs: z.coerce.number().int().positive().optional(),
        waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional(),
        waitSelector: z.string().optional(),
        waitMs: z.coerce.number().int().nonnegative().optional(),
        ignore: z.coerce.boolean().optional(),
      }),
    )
    .default([]),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  enabled: z.coerce.boolean().default(true),
  createdAt: z.coerce.number().int().optional(),
});

export type Tenant = z.infer<typeof TenantSchema>;

export type TenantStore = {
  list(): Promise<Tenant[]>;
  byId(id: string): Promise<Tenant | null>;
  byApiKey(key: string): Promise<Tenant | null>;
  byHost(host: string): Promise<Tenant | null>;
  upsert(t: Tenant): Promise<Tenant>;
  remove(id: string): Promise<boolean>;
};

export class InMemoryTenantStore implements TenantStore {
  private items = new Map<string, Tenant>();

  async list() {
    return Array.from(this.items.values());
  }
  async byId(id: string) {
    return this.items.get(id) ?? null;
  }
  async byApiKey(key: string) {
    for (const t of this.items.values()) if (t.apiKey === key) return t;
    return null;
  }
  async byHost(host: string) {
    for (const t of this.items.values()) {
      try {
        if (new URL(t.origin).host === host) return t;
      } catch {
        /* skip */
      }
    }
    return null;
  }
  async upsert(t: Tenant) {
    this.items.set(t.id, t);
    return t;
  }
  async remove(id: string) {
    return this.items.delete(id);
  }
}

export class FileTenantStore implements TenantStore {
  constructor(private path: string) {}

  private async readAll(): Promise<Tenant[]> {
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p): p is Tenant => TenantSchema.safeParse(p).success);
    } catch {
      return [];
    }
  }

  private async writeAll(items: Tenant[]) {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
    await rename(tmp, this.path);
  }

  async list() {
    return this.readAll();
  }
  async byId(id: string) {
    return (await this.readAll()).find((t) => t.id === id) ?? null;
  }
  async byApiKey(key: string) {
    return (await this.readAll()).find((t) => t.apiKey === key) ?? null;
  }
  async byHost(host: string) {
    return (
      (await this.readAll()).find((t) => {
        try {
          return new URL(t.origin).host === host;
        } catch {
          return false;
        }
      }) ?? null
    );
  }
  async upsert(t: Tenant) {
    const all = await this.readAll();
    const idx = all.findIndex((x) => x.id === t.id);
    if (idx >= 0) all[idx] = t;
    else all.push({ ...t, createdAt: t.createdAt ?? Date.now() });
    await this.writeAll(all);
    return t;
  }
  async remove(id: string) {
    const all = await this.readAll();
    const next = all.filter((t) => t.id !== id);
    if (next.length === all.length) return false;
    await this.writeAll(next);
    return true;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: Tenant;
  }
}

function compiledRoutes(t: Tenant): Array<RouteOverride & { regex: RegExp }> {
  return t.routes.map((r) => ({ ...r, regex: new RegExp(r.pattern) }));
}

function matchTenantRoute(t: Tenant, targetUrl: string): RouteOverride | null {
  let path: string;
  try {
    const u = new URL(targetUrl);
    path = u.pathname + u.search;
  } catch {
    return null;
  }
  for (const r of compiledRoutes(t)) {
    if (r.regex.test(path)) {
      const { regex: _r, ...rest } = r;
      return rest;
    }
  }
  return null;
}

export type RegisterOptions = {
  store: TenantStore;
  /**
   * 게이트웨이 마스터 admin 토큰 (테넌트 CRUD 보호). 미설정 시 admin API disabled.
   */
  adminToken?: string;
  /**
   * 인입 요청에서 테넌트 식별 전략 (복수 시도 가능). 기본 ['host', 'apiKey'].
   */
  resolve?: Array<'host' | 'apiKey' | 'subdomain' | 'pathPrefix'>;
};

export async function registerMultiTenant(
  app: FastifyInstance,
  opts: RegisterOptions,
): Promise<void> {
  const { store } = opts;
  const adminToken = opts.adminToken ?? config.adminToken;
  const strategies = opts.resolve ?? ['host', 'apiKey'];

  const guardAdmin = (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (!adminToken) {
      reply.code(404).send({ error: 'admin disabled' });
      return false;
    }
    if (req.headers['x-admin-token'] !== adminToken) {
      reply.code(401).send({ error: 'unauthorized' });
      return false;
    }
    return true;
  };

  // ── tenant CRUD ─────────────────────────────────────────────────────
  app.get('/admin/api/tenants', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    return { ok: true, tenants: await store.list() };
  });

  app.post<{ Body: Tenant }>('/admin/api/tenants', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    const parsed = TenantSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: parsed.error.format() });
      return;
    }
    return { ok: true, tenant: await store.upsert(parsed.data) };
  });

  app.delete<{ Params: { id: string } }>('/admin/api/tenants/:id', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    const ok = await store.remove(req.params.id);
    if (!ok) reply.code(404);
    return { ok };
  });

  // ── tenant resolver hook ────────────────────────────────────────────
  app.addHook('preHandler', async (req: FastifyRequest, _reply) => {
    if (
      req.url.startsWith('/admin') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/metrics')
    ) {
      return;
    }
    let tenant: Tenant | null = null;
    for (const s of strategies) {
      if (tenant) break;
      if (s === 'host') {
        const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined;
        if (host) tenant = await store.byHost(host);
      } else if (s === 'apiKey') {
        const key = req.headers['x-api-key'];
        if (typeof key === 'string') tenant = await store.byApiKey(key);
      } else if (s === 'subdomain') {
        const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined;
        const sub = host?.split('.')[0];
        if (sub) tenant = await store.byId(sub);
      } else if (s === 'pathPrefix') {
        const m = req.url.match(/^\/t\/([^/]+)/);
        if (m?.[1]) tenant = await store.byId(m[1]);
      }
    }
    if (tenant?.enabled) req.tenant = tenant;
  });

  // ── render route (per-tenant) ───────────────────────────────────────
  app.route({
    method: ['GET', 'HEAD'],
    url: '/*',
    handler: async (req, reply) => {
      if (
        req.url.startsWith('/admin') ||
        req.url.startsWith('/health') ||
        req.url.startsWith('/metrics')
      ) {
        return reply.callNotFound();
      }
      const tenant = req.tenant;
      if (!tenant) {
        reply.code(404).send({ error: 'unknown tenant — set Host/X-API-Key' });
        return reply;
      }

      const detection = detectBot(
        req.headers['user-agent'],
        req.headers as Record<string, string | string[] | undefined>,
        req.query as Record<string, unknown>,
      );
      if (!detection.isBot) {
        httpRequests.inc({ route: 'tenant-pass', status: 'pass', kind: 'human' });
        reply.code(204).header('x-bypass-reason', detection.reason).send();
        return reply;
      }

      const target = new URL(req.url, tenant.origin).toString();
      if (!isHostAllowed(target)) {
        const tenantHost = (() => {
          try {
            return new URL(tenant.origin).host;
          } catch {
            return '';
          }
        })();
        if (tenantHost && new URL(target).host !== tenantHost) {
          reply.code(403).send({ error: 'host outside tenant origin' });
          return reply;
        }
      }
      const safe = await isSafeTarget(target);
      if (!safe.ok) {
        reply.code(403).send({ error: 'unsafe target', reason: safe.reason });
        return reply;
      }

      const route = matchTenantRoute(tenant, target);
      if (route?.ignore) {
        reply.code(204).header('x-prerender-route', route.pattern).send();
        return reply;
      }

      const lang = (req.headers['accept-language'] as string | undefined) ?? 'default';
      const key = cacheKey(target, lang.split(',')[0] ?? 'default', `tenant:${tenant.id}`);

      try {
        const result = await cacheSwr(
          key,
          () =>
            render({
              url: target,
              headers: req.headers as Record<string, string | string[] | undefined>,
              route,
            }) as Promise<CacheEntry>,
          route?.ttlMs,
        );
        httpRequests.inc({
          route: 'tenant-render',
          status: String(result.entry.status),
          kind: result.fromCache ?? 'origin',
        });
        reply.code(result.entry.status);
        for (const [k, v] of Object.entries(result.entry.headers)) reply.header(k, v);
        reply
          .header('x-tenant-id', tenant.id)
          .header('x-cache', result.fromCache ? 'HIT' : 'MISS')
          .header('x-cache-stale', result.stale ? '1' : '0')
          .send(result.entry.body);
      } catch (err) {
        httpRequests.inc({ route: 'tenant-render', status: '500', kind: 'error' });
        logger.error(
          { err: (err as Error).message, target, tenant: tenant.id },
          'tenant render failed',
        );
        reply.code(502).send({ error: 'render failed', message: (err as Error).message });
      }
      return reply;
    },
  });

  // ── per-tenant cache invalidation API (apiKey 인증) ─────────────────
  app.post<{ Body: { url?: string }; Headers: { 'x-api-key'?: string } }>(
    '/api/cache/invalidate',
    async (req, reply) => {
      const key = req.headers['x-api-key'];
      if (typeof key !== 'string') {
        reply.code(401).send({ error: 'x-api-key required' });
        return;
      }
      const tenant = await store.byApiKey(key);
      if (!tenant?.enabled) {
        reply.code(401).send({ error: 'invalid api key' });
        return;
      }
      const url = req.body?.url;
      if (!url) {
        reply.code(400).send({ error: 'url required' });
        return;
      }
      const k = cacheKey(url, 'default', `tenant:${tenant.id}`);
      await cacheDel(k);
      return { ok: true, key: k };
    },
  );

  // ── stats ───────────────────────────────────────────────────────────
  app.get('/admin/api/multi-tenant/stats', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    const tenants = await store.list();
    return {
      ok: true,
      tenantCount: tenants.length,
      enabled: tenants.filter((t) => t.enabled).length,
      cache: cacheStats(),
    };
  });

  app.post('/admin/api/multi-tenant/cache/clear', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    return { ok: true, cleared: await cacheClear() };
  });

  logger.info({ strategies }, 'multi-tenant mode enabled');
}
