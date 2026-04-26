/**
 * @spa-seo-gateway/cms — option C (multi-site CMS)
 *
 * 한 조직 내에서 여러 사이트를 GUI 로 관리. host 헤더로 사이트를 식별해
 * 각 사이트의 origin / routes / 캐시 네임스페이스를 적용한다. JSON 파일에
 * 영구 저장.
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
  isSafeTarget,
  logger,
  type RouteOverride,
  render,
  warmFromSitemap,
} from '@spa-seo-gateway/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export const SiteSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, 'lowercase alphanumeric/-/_'),
  name: z.string().min(1),
  origin: z.string().url(),
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
  enabled: z.coerce.boolean().default(true),
  webhooks: z
    .object({
      onRender: z.string().url().optional(),
      onError: z.string().url().optional(),
    })
    .optional(),
  createdAt: z.coerce.number().int().optional(),
});

export type Site = z.infer<typeof SiteSchema>;

export type SiteStore = {
  list(): Promise<Site[]>;
  byId(id: string): Promise<Site | null>;
  byHost(host: string): Promise<Site | null>;
  upsert(s: Site): Promise<Site>;
  remove(id: string): Promise<boolean>;
};

export class InMemorySiteStore implements SiteStore {
  private items = new Map<string, Site>();

  async list() {
    return Array.from(this.items.values());
  }
  async byId(id: string) {
    return this.items.get(id) ?? null;
  }
  async byHost(host: string) {
    for (const s of this.items.values()) {
      try {
        if (new URL(s.origin).host === host) return s;
      } catch {
        /* skip */
      }
    }
    return null;
  }
  async upsert(s: Site) {
    this.items.set(s.id, s);
    return s;
  }
  async remove(id: string) {
    return this.items.delete(id);
  }
}

export class FileSiteStore implements SiteStore {
  constructor(private path: string) {}

  private async readAll(): Promise<Site[]> {
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p): p is Site => SiteSchema.safeParse(p).success);
    } catch {
      return [];
    }
  }

  private async writeAll(items: Site[]) {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
    await rename(tmp, this.path);
  }

  async list() {
    return this.readAll();
  }
  async byId(id: string) {
    return (await this.readAll()).find((s) => s.id === id) ?? null;
  }
  async byHost(host: string) {
    return (
      (await this.readAll()).find((s) => {
        try {
          return new URL(s.origin).host === host;
        } catch {
          return false;
        }
      }) ?? null
    );
  }
  async upsert(s: Site) {
    const all = await this.readAll();
    const idx = all.findIndex((x) => x.id === s.id);
    if (idx >= 0) all[idx] = s;
    else all.push({ ...s, createdAt: s.createdAt ?? Date.now() });
    await this.writeAll(all);
    return s;
  }
  async remove(id: string) {
    const all = await this.readAll();
    const next = all.filter((s) => s.id !== id);
    if (next.length === all.length) return false;
    await this.writeAll(next);
    return true;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    site?: Site;
  }
}

function compiledRoutes(s: Site): Array<RouteOverride & { regex: RegExp }> {
  return s.routes.map((r) => ({ ...r, regex: new RegExp(r.pattern) }));
}

function matchSiteRoute(s: Site, targetUrl: string): RouteOverride | null {
  let path: string;
  try {
    const u = new URL(targetUrl);
    path = u.pathname + u.search;
  } catch {
    return null;
  }
  for (const r of compiledRoutes(s)) {
    if (r.regex.test(path)) {
      const { regex: _r, ...rest } = r;
      return rest;
    }
  }
  return null;
}

export type RegisterOptions = {
  store: SiteStore;
  /** 마스터 admin 토큰 (사이트 CRUD 보호). 미설정 시 admin API disabled. */
  adminToken?: string;
};

export async function registerCms(app: FastifyInstance, opts: RegisterOptions): Promise<void> {
  const { store } = opts;
  const adminToken = opts.adminToken ?? config.adminToken;

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

  // ── site CRUD ───────────────────────────────────────────────────────
  app.get('/admin/api/sites', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    return { ok: true, sites: await store.list() };
  });

  app.post<{ Body: Site }>('/admin/api/sites', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    const parsed = SiteSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: parsed.error.format() });
      return;
    }
    return { ok: true, site: await store.upsert(parsed.data) };
  });

  app.delete<{ Params: { id: string } }>('/admin/api/sites/:id', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    const ok = await store.remove(req.params.id);
    if (!ok) reply.code(404);
    return { ok };
  });

  app.post<{ Params: { id: string }; Body: { url?: string } }>(
    '/admin/api/sites/:id/cache/invalidate',
    async (req, reply) => {
      if (!guardAdmin(req, reply)) return;
      const site = await store.byId(req.params.id);
      if (!site) {
        reply.code(404).send({ ok: false, error: 'site not found' });
        return;
      }
      if (!req.body?.url) {
        reply.code(400).send({ ok: false, error: 'url required' });
        return;
      }
      const k = cacheKey(req.body.url, 'default', `site:${site.id}`);
      await cacheDel(k);
      return { ok: true, key: k };
    },
  );

  app.post<{ Params: { id: string }; Body: { sitemap?: string; max?: number } }>(
    '/admin/api/sites/:id/warm',
    async (req, reply) => {
      if (!guardAdmin(req, reply)) return;
      const site = await store.byId(req.params.id);
      if (!site) {
        reply.code(404).send({ ok: false, error: 'site not found' });
        return;
      }
      const sitemap = req.body?.sitemap ?? new URL('/sitemap.xml', site.origin).toString();
      const report = await warmFromSitemap(sitemap, { max: req.body?.max ?? 500 });
      return { ok: true, site: site.id, report };
    },
  );

  app.post('/admin/api/cms/cache/clear', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    return { ok: true, cleared: await cacheClear() };
  });

  // ── site resolver hook ──────────────────────────────────────────────
  app.addHook('preHandler', async (req: FastifyRequest, _reply) => {
    if (
      req.url.startsWith('/admin') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/metrics')
    ) {
      return;
    }
    const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined;
    if (!host) return;
    const site = await store.byHost(host);
    if (site?.enabled) req.site = site;
  });

  // ── render route (per-site) ─────────────────────────────────────────
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
      const site = req.site;
      if (!site) {
        reply.code(404).send({ error: 'unknown site — host not registered' });
        return reply;
      }

      const detection = detectBot(
        req.headers['user-agent'],
        req.headers as Record<string, string | string[] | undefined>,
        req.query as Record<string, unknown>,
      );
      if (!detection.isBot) {
        httpRequests.inc({ route: 'site-pass', status: 'pass', kind: 'human' });
        reply.code(204).header('x-bypass-reason', detection.reason);
        return reply;
      }

      const target = new URL(req.url, site.origin).toString();
      const safe = await isSafeTarget(target);
      if (!safe.ok) {
        reply.code(403).send({ error: 'unsafe target', reason: safe.reason });
        return reply;
      }

      const route = matchSiteRoute(site, target);
      if (route?.ignore) {
        reply.code(204).header('x-prerender-route', route.pattern);
        return reply;
      }

      const lang = (req.headers['accept-language'] as string | undefined) ?? 'default';
      const key = cacheKey(target, lang.split(',')[0] ?? 'default', `site:${site.id}`);

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
          route: 'site-render',
          status: String(result.entry.status),
          kind: result.fromCache ?? 'origin',
        });
        reply.code(result.entry.status);
        for (const [k, v] of Object.entries(result.entry.headers)) reply.header(k, v);
        reply
          .header('x-site-id', site.id)
          .header('x-cache', result.fromCache ? 'HIT' : 'MISS')
          .header('x-cache-stale', result.stale ? '1' : '0')
          .send(result.entry.body);
      } catch (err) {
        httpRequests.inc({ route: 'site-render', status: '500', kind: 'error' });
        logger.error({ err: (err as Error).message, target, site: site.id }, 'site render failed');
        reply.code(502).send({ error: 'render failed', message: (err as Error).message });
      }
      return reply;
    },
  });

  app.get('/admin/api/cms/stats', async (req, reply) => {
    if (!guardAdmin(req, reply)) return;
    const sites = await store.list();
    return {
      ok: true,
      siteCount: sites.length,
      enabled: sites.filter((s) => s.enabled).length,
      cache: cacheStats(),
    };
  });

  logger.info('cms mode enabled');
}
