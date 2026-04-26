import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import staticPlugin from '@fastify/static';
import {
  breakerStats,
  cacheClear,
  cacheDel,
  cacheKey,
  cacheStats,
  config,
  getRoutes,
  getSiteSummary,
  persistRoutesToFile,
  type RouteOverride,
  render,
  setRoutes,
  warmFromSitemap,
} from '@heejun/spa-seo-gateway-core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type AdminUIOptions = {
  prefix?: string;
  tokenHeader?: string;
};

export async function registerAdminUI(
  app: FastifyInstance,
  opts: AdminUIOptions = {},
): Promise<void> {
  const prefix = opts.prefix ?? '/admin/ui';
  const tokenHeader = (opts.tokenHeader ?? 'x-admin-token').toLowerCase();

  const guard = (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (!config.adminToken) {
      reply.code(404).send({ error: 'admin disabled (set ADMIN_TOKEN to enable)' });
      return false;
    }
    if (req.headers[tokenHeader] !== config.adminToken) {
      reply.code(401).send({ error: 'unauthorized — provide X-Admin-Token header' });
      return false;
    }
    return true;
  };

  const publicRoot = resolve(__dirname, '../public');
  await app.register(staticPlugin, {
    root: publicRoot,
    prefix: `${prefix}/`,
    decorateReply: false,
    cacheControl: false,
  });

  app.get(`${prefix}`, (_req, reply) => reply.redirect(`${prefix}/`));

  // Public info — Welcome 페이지에서 인증 없이 사용. 민감 정보 제외.
  app.get('/admin/api/public/info', () => ({
    ok: true,
    mode: config.mode,
    origin: config.originUrl ?? null,
    multiContext: config.mode === 'saas' || config.mode === 'cms',
    cache: cacheStats(),
    site: getSiteSummary(),
    nodeVersion: process.version,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  }));

  app.get('/admin/api/site', (req, reply) => {
    if (!guard(req, reply)) return;
    return {
      ok: true,
      site: getSiteSummary(),
      mode: config.mode,
      origin: config.originUrl,
      breakers: breakerStats(),
      cache: cacheStats(),
      multiContext: config.mode === 'saas' || config.mode === 'cms',
    };
  });

  app.get('/admin/api/routes', (req, reply) => {
    if (!guard(req, reply)) return;
    return { ok: true, routes: getRoutes() };
  });

  app.put<{ Body: { routes?: RouteOverride[]; persist?: boolean } }>(
    '/admin/api/routes',
    async (req, reply) => {
      if (!guard(req, reply)) return;
      const body = req.body ?? {};
      const next = Array.isArray(body.routes) ? body.routes : [];
      try {
        setRoutes(next);
      } catch (e) {
        reply.code(400).send({ ok: false, error: (e as Error).message });
        return;
      }
      let persisted: { ok: boolean; path: string; error?: string } | null = null;
      if (body.persist) persisted = await persistRoutesToFile();
      return { ok: true, routes: getRoutes(), persisted };
    },
  );

  app.post<{ Body: { url?: string } }>('/admin/api/cache/invalidate', async (req, reply) => {
    if (!guard(req, reply)) return;
    const url = req.body?.url;
    if (!url) {
      reply.code(400).send({ ok: false, error: 'url required' });
      return;
    }
    const k = cacheKey(url);
    await cacheDel(k);
    return { ok: true, key: k };
  });

  app.post('/admin/api/cache/clear', async (req, reply) => {
    if (!guard(req, reply)) return;
    return { ok: true, cleared: await cacheClear() };
  });

  app.post<{ Body: { sitemap?: string; max?: number; concurrency?: number } }>(
    '/admin/api/warm',
    async (req, reply) => {
      if (!guard(req, reply)) return;
      const body = req.body ?? {};
      if (!body.sitemap) {
        reply.code(400).send({ ok: false, error: 'sitemap URL required' });
        return;
      }
      const report = await warmFromSitemap(body.sitemap, {
        max: body.max,
        concurrency: body.concurrency,
      });
      return { ok: true, report };
    },
  );

  app.post<{ Body: { url?: string; ua?: string } }>(
    '/admin/api/render-test',
    async (req, reply) => {
      if (!guard(req, reply)) return null;
      const body = req.body ?? {};
      if (!body.url) {
        reply.code(400).send({ ok: false, error: 'url required' });
        return null;
      }
      try {
        const t0 = Date.now();
        const entry = await render({
          url: body.url,
          headers: { 'user-agent': body.ua ?? 'Googlebot/2.1' },
        });
        return {
          ok: true,
          status: entry.status,
          durationMs: Date.now() - t0,
          bytes: Buffer.byteLength(entry.body, 'utf8'),
          headers: entry.headers,
          bodyPreview: entry.body.slice(0, 4_000),
        };
      } catch (e) {
        reply.code(502).send({ ok: false, error: (e as Error).message });
        return null;
      }
    },
  );
}
