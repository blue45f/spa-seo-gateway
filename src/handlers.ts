import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { config } from './config.js';
import { logger } from './logger.js';
import { detectBot } from './bot.js';
import { buildTargetUrl, cacheKey, isHostAllowed } from './url.js';
import { cacheClear, cacheDel, cacheStats, cacheSwr } from './cache.js';
import { render } from './renderer.js';
import { browserPool } from './pool.js';
import { httpRequests, registry } from './metrics.js';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    ok: true,
    uptime: process.uptime(),
    pool: browserPool.stats(),
    cache: cacheStats(),
  }));

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
    const cleared = await cacheClear();
    return { ok: true, cleared };
  });

  app.get('/admin/status', async (req, reply) => {
    if (!checkAdmin(req, reply)) return;
    return {
      mode: config.mode,
      origin: config.originUrl,
      pool: browserPool.stats(),
      cache: cacheStats(),
    };
  });

  app.all('/*', async (req, reply) => {
    if (req.url.startsWith('/health') || req.url.startsWith('/metrics') || req.url.startsWith('/admin')) {
      return;
    }
    return handleRoot(req, reply);
  });
}

function checkAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!config.adminToken) {
    reply.code(404);
    reply.send({ error: 'admin disabled' });
    return false;
  }
  const token = req.headers['x-admin-token'];
  if (token !== config.adminToken) {
    reply.code(401);
    reply.send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

async function handleRoot(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const userAgent = req.headers['user-agent'];
  const detection = detectBot(
    userAgent,
    req.headers as Record<string, string | string[] | undefined>,
    req.query as Record<string, unknown>,
  );

  if (config.mode === 'proxy' && !detection.isBot) {
    return proxyPassthrough(req, reply);
  }

  if (config.mode === 'render-only' && !detection.isBot) {
    httpRequests.inc({ route: 'root', status: 'pass', kind: 'human' });
    reply.code(204);
    reply.header('x-bypass-reason', detection.reason);
    return null;
  }

  return renderHandler(req, reply);
}

async function renderHandler(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
  let target: string;
  try {
    target = buildTargetUrl({
      url: req.url,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });
  } catch (e) {
    reply.code(400);
    return { error: (e as Error).message };
  }

  if (!isHostAllowed(target)) {
    reply.code(403);
    return { error: 'host not allowed', target };
  }

  const lang = (req.headers['accept-language'] as string | undefined) ?? 'default';
  const key = cacheKey(target, lang.split(',')[0] ?? 'default');

  try {
    const result = await cacheSwr(key, () =>
      render({
        url: target,
        headers: req.headers as Record<string, string | string[] | undefined>,
      }),
    );

    httpRequests.inc({
      route: 'render',
      status: String(result.entry.status),
      kind: result.fromCache ?? 'origin',
    });

    reply.code(result.entry.status);
    for (const [k, v] of Object.entries(result.entry.headers)) {
      reply.header(k, v);
    }
    reply.header(
      'cache-control',
      `public, max-age=60, stale-while-revalidate=${Math.floor(
        config.cache.swrWindowMs / 1000,
      )}`,
    );
    reply.header('x-cache', result.fromCache ? 'HIT' : 'MISS');
    reply.header('x-cache-stale', result.stale ? '1' : '0');
    reply.header('x-prerender-key', key);

    return result.entry.body;
  } catch (err) {
    httpRequests.inc({ route: 'render', status: '500', kind: 'error' });
    logger.error(
      { err: (err as Error).message, target },
      'render handler failed',
    );
    reply.code(502);
    return { error: 'render failed', message: (err as Error).message };
  }
}

async function proxyPassthrough(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
  if (!config.originUrl) {
    reply.code(500);
    return { error: 'origin not configured' };
  }
  const target = new URL(req.url, config.originUrl).toString();
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  headers.set('host', new URL(config.originUrl).host);
  headers.set('x-forwarded-by', 'spa-seo-gateway');

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    redirect: 'manual',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Readable.toWeb(req.raw) as ReadableStream<Uint8Array>;
    init.duplex = 'half';
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch (e) {
    httpRequests.inc({ route: 'proxy', status: '502', kind: 'error' });
    reply.code(502);
    return { error: 'origin unreachable', message: (e as Error).message };
  }
  httpRequests.inc({
    route: 'proxy',
    status: String(res.status),
    kind: 'human',
  });

  reply.code(res.status);
  res.headers.forEach((v, k) => {
    if (HOP_BY_HOP.has(k.toLowerCase())) return;
    reply.header(k, v);
  });
  if (!res.body) return null;
  return Readable.fromWeb(res.body as ReadableStream<Uint8Array>);
}
