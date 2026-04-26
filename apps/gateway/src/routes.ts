import httpProxy from '@fastify/http-proxy';
import {
  breakerStats,
  browserPool,
  buildTargetUrl,
  cacheClear,
  cacheDel,
  cacheKey,
  cacheStats,
  cacheSwr,
  config,
  detectBot,
  httpRequests,
  isHostAllowed,
  isStaticAssetUrl,
  logger,
  matchRoute,
  registry,
  render,
  warmFromSitemap,
} from '@heejun/spa-seo-gateway-core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const RESERVED_PREFIXES = ['/health', '/metrics', '/admin'] as const;
const isReserved = (url: string) => RESERVED_PREFIXES.some((p) => url.startsWith(p));

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    ok: true,
    uptime: process.uptime(),
    pool: browserPool.stats(),
    cache: cacheStats(),
    breakers: breakerStats(),
  }));

  app.get('/health/deep', async (_req, reply) => {
    const probe = config.originUrl ?? 'https://example.com/';
    try {
      const t0 = Date.now();
      const entry = await render({ url: probe, headers: { 'user-agent': 'Googlebot/2.1' } });
      reply.send({
        ok: true,
        probe,
        status: entry.status,
        durationMs: Date.now() - t0,
        bytes: Buffer.byteLength(entry.body, 'utf8'),
      });
    } catch (e) {
      reply.code(503).send({ ok: false, probe, error: (e as Error).message });
    }
  });

  app.get('/metrics', async (_req, reply) => {
    reply.header('content-type', registry.contentType);
    return registry.metrics();
  });

  app.post('/admin/cache/invalidate', async (req, reply) => {
    if (!checkAdmin(req, reply)) return;
    const body = (req.body ?? {}) as { url?: string; key?: string };
    if (body.key) {
      await cacheDel(body.key);
      return { ok: true, deleted: 1, key: body.key };
    }
    if (body.url) {
      const k = cacheKey(body.url);
      await cacheDel(k);
      return { ok: true, deleted: 1, url: body.url, key: k };
    }
    reply.code(400);
    return { ok: false, error: 'url or key is required' };
  });

  app.post('/admin/cache/clear', async (req, reply) => {
    if (!checkAdmin(req, reply)) return;
    return { ok: true, cleared: await cacheClear() };
  });

  app.get('/admin/status', async (req, reply) => {
    if (!checkAdmin(req, reply)) return;
    return {
      mode: config.mode,
      origin: config.originUrl,
      pool: browserPool.stats(),
      cache: cacheStats(),
      breakers: breakerStats(),
      routes: config.routes.length,
    };
  });

  app.post('/admin/warm', async (req, reply) => {
    if (!checkAdmin(req, reply)) return;
    const body = (req.body ?? {}) as { sitemap?: string; max?: number; concurrency?: number };
    if (!body.sitemap) {
      reply.code(400);
      return { ok: false, error: 'sitemap URL is required' };
    }
    const report = await warmFromSitemap(body.sitemap, {
      max: body.max,
      concurrency: body.concurrency,
    });
    return { ok: true, report };
  });

  if (config.mode === 'proxy' && config.originUrl) {
    await app.register(httpProxy, {
      upstream: config.originUrl,
      preHandler: async (req, reply) => {
        if (isReserved(req.url)) return;
        const detection = detectBot(
          req.headers['user-agent'],
          req.headers as Record<string, string | string[] | undefined>,
          req.query as Record<string, unknown>,
        );
        if (!detection.isBot) return;
        await renderToReply(req, reply);
      },
    });
  } else {
    app.route({
      method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      url: '/*',
      handler: async (req, reply) => {
        if (isReserved(req.url)) return null;
        const detection = detectBot(
          req.headers['user-agent'],
          req.headers as Record<string, string | string[] | undefined>,
          req.query as Record<string, unknown>,
        );
        if (!detection.isBot) {
          httpRequests.inc({ route: 'root', status: 'pass', kind: 'human' });
          reply.code(204).header('x-bypass-reason', detection.reason);
          return null;
        }
        await renderToReply(req, reply);
        return reply;
      },
    });
  }
}

function checkAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!config.adminToken) {
    reply.code(404).send({ error: 'admin disabled' });
    return false;
  }
  if (req.headers['x-admin-token'] !== config.adminToken) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

async function renderToReply(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  let target: string;
  try {
    target = buildTargetUrl({
      url: req.url,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });
  } catch (e) {
    reply.code(400).send({ error: (e as Error).message });
    return;
  }

  if (!isHostAllowed(target)) {
    reply.code(403).send({ error: 'host not allowed', target });
    return;
  }

  if (config.renderer.skipStaticAssetUrls && isStaticAssetUrl(target)) {
    httpRequests.inc({ route: 'static-skip', status: '204', kind: 'bot' });
    reply.code(204).header('x-prerender-skip', 'static-asset').send();
    return;
  }

  const route = matchRoute(target);
  if (route?.ignore) {
    httpRequests.inc({ route: 'ignore', status: '204', kind: 'bot' });
    reply.code(204).header('x-prerender-route', route.pattern).send();
    return;
  }

  const lang = (req.headers['accept-language'] as string | undefined) ?? 'default';
  const key = cacheKey(target, lang.split(',')[0] ?? 'default');

  try {
    const result = await cacheSwr(
      key,
      () =>
        render({
          url: target,
          headers: req.headers as Record<string, string | string[] | undefined>,
          route,
        }),
      route?.ttlMs,
    );
    httpRequests.inc({
      route: 'render',
      status: String(result.entry.status),
      kind: result.fromCache ?? 'origin',
    });
    reply.code(result.entry.status);
    for (const [k, v] of Object.entries(result.entry.headers)) reply.header(k, v);
    reply
      .header(
        'cache-control',
        `public, max-age=60, stale-while-revalidate=${Math.floor(config.cache.swrWindowMs / 1000)}`,
      )
      .header('x-cache', result.fromCache ? 'HIT' : 'MISS')
      .header('x-cache-stale', result.stale ? '1' : '0')
      .header('x-prerender-key', key)
      .send(result.entry.body);
  } catch (err) {
    httpRequests.inc({ route: 'render', status: '500', kind: 'error' });
    logger.error({ err: (err as Error).message, target }, 'render handler failed');
    reply.code(502).send({ error: 'render failed', message: (err as Error).message });
  }
}
