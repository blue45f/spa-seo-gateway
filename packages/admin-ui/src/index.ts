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
  getAiSchemaAdapter,
  getRecentAudit,
  getRoutes,
  getSiteSummary,
  persistRoutesToFile,
  type RouteOverride,
  recordAudit,
  render,
  runLighthouse,
  runVisualDiff,
  setRoutes,
  type VisualDiffOptions,
  verifyAuditChain,
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
  const COOKIE_NAME = 'seo-admin';

  function getCookie(req: FastifyRequest, name: string): string | undefined {
    const c = req.headers.cookie;
    if (!c) return undefined;
    for (const part of c.split(';')) {
      const idx = part.indexOf('=');
      if (idx < 0) continue;
      const k = part.slice(0, idx).trim();
      if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
    }
    return undefined;
  }

  function isAuthed(req: FastifyRequest): boolean {
    if (!config.adminToken) return false;
    const fromHeader = req.headers[tokenHeader];
    if (typeof fromHeader === 'string' && fromHeader === config.adminToken) return true;
    return getCookie(req, COOKIE_NAME) === config.adminToken;
  }

  const guard = (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (!config.adminToken) {
      reply.code(404).send({ error: 'admin disabled (set ADMIN_TOKEN to enable)' });
      return false;
    }
    if (!isAuthed(req)) {
      reply.code(401).send({ error: 'unauthorized — POST /admin/api/login or send X-Admin-Token' });
      return false;
    }
    return true;
  };

  app.get('/admin/api/whoami', (req) => ({
    ok: true,
    authenticated: isAuthed(req),
    adminEnabled: !!config.adminToken,
  }));

  app.post<{ Body: { token?: string } }>('/admin/api/login', (req, reply) => {
    if (!config.adminToken) {
      reply.code(404).send({ ok: false, error: 'admin disabled' });
      return;
    }
    const token = (req.body?.token ?? '').trim();
    if (token !== config.adminToken) {
      reply.code(401).send({ ok: false, error: 'invalid token' });
      return;
    }
    const isHttps = (req.headers['x-forwarded-proto'] ?? '').includes('https');
    const cookieAttrs = [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      'Max-Age=86400',
    ];
    if (isHttps) cookieAttrs.push('Secure');
    reply.header('set-cookie', cookieAttrs.join('; ')).send({ ok: true });
  });

  app.post('/admin/api/logout', (_req, reply) => {
    reply
      .header('set-cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`)
      .send({ ok: true });
  });

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
        recordAudit({
          actor: 'admin',
          action: 'routes.update',
          outcome: 'error',
          meta: { error: (e as Error).message },
        });
        reply.code(400).send({ ok: false, error: (e as Error).message });
        return;
      }
      let persisted: { ok: boolean; path: string; error?: string } | null = null;
      if (body.persist) persisted = await persistRoutesToFile();
      recordAudit({
        actor: 'admin',
        action: 'routes.update',
        outcome: 'ok',
        meta: { count: next.length, persisted: !!body.persist },
      });
      return { ok: true, routes: getRoutes(), persisted };
    },
  );

  app.get('/admin/api/audit', (req, reply) => {
    if (!guard(req, reply)) return;
    return { ok: true, events: getRecentAudit(200) };
  });

  app.post<{ Body: { url?: string } }>('/admin/api/cache/invalidate', async (req, reply) => {
    if (!guard(req, reply)) return;
    const url = req.body?.url;
    if (!url) {
      reply.code(400).send({ ok: false, error: 'url required' });
      return;
    }
    const k = cacheKey(url);
    await cacheDel(k);
    recordAudit({
      actor: 'admin',
      action: 'cache.invalidate',
      target: url,
      outcome: 'ok',
      meta: { key: k },
    });
    return { ok: true, key: k };
  });

  app.post('/admin/api/cache/clear', async (req, reply) => {
    if (!guard(req, reply)) return;
    const cleared = await cacheClear();
    recordAudit({ actor: 'admin', action: 'cache.clear', outcome: 'ok', meta: { cleared } });
    return { ok: true, cleared };
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

  app.get('/admin/api/audit/verify', (req, reply) => {
    if (!guard(req, reply)) return null;
    const verification = verifyAuditChain();
    return { ok: true, verified: verification.ok, brokenAt: verification.brokenAt };
  });

  app.post<{
    Body: {
      url?: string;
      mode?: VisualDiffOptions['mode'];
      threshold?: number;
      fullPage?: boolean;
      width?: number;
      height?: number;
    };
  }>('/admin/api/visual-diff', async (req, reply) => {
    if (!guard(req, reply)) return null;
    const body = req.body ?? {};
    if (!body.url) {
      reply.code(400).send({ ok: false, error: 'url required' });
      return null;
    }
    try {
      const result = await runVisualDiff(body.url, {
        mode: body.mode,
        threshold: body.threshold,
        fullPage: body.fullPage,
        viewport:
          body.width && body.height ? { width: body.width, height: body.height } : undefined,
      });
      recordAudit({
        actor: 'admin',
        action: 'visual.diff',
        target: body.url,
        outcome: 'ok',
        meta: { diffPercent: result.diffPercent, baselineCreated: result.baselineCreated },
      });
      return { ok: true, result };
    } catch (e) {
      recordAudit({
        actor: 'admin',
        action: 'visual.diff',
        target: body.url,
        outcome: 'error',
        meta: { error: (e as Error).message },
      });
      reply.code(503).send({ ok: false, error: (e as Error).message });
      return null;
    }
  });

  app.post<{ Body: { url?: string; html?: string } }>(
    '/admin/api/ai/schema',
    async (req, reply) => {
      if (!guard(req, reply)) return null;
      const adapter = getAiSchemaAdapter();
      if (!adapter) {
        reply.code(501).send({
          ok: false,
          error: 'AI schema adapter not configured (call setAiSchemaAdapter at startup)',
        });
        return null;
      }
      const body = req.body ?? {};
      if (!body.url) {
        reply.code(400).send({ ok: false, error: 'url required' });
        return null;
      }
      try {
        let html = body.html;
        if (!html) {
          const entry = await render({
            url: body.url,
            headers: { 'user-agent': 'Googlebot/2.1' },
          });
          html = entry.body;
        }
        const suggestions = await adapter.suggestSchema(html, body.url);
        recordAudit({
          actor: 'admin',
          action: 'ai.schema',
          target: body.url,
          outcome: 'ok',
          meta: { count: suggestions.length },
        });
        return { ok: true, suggestions };
      } catch (e) {
        recordAudit({
          actor: 'admin',
          action: 'ai.schema',
          target: body.url,
          outcome: 'error',
          meta: { error: (e as Error).message },
        });
        reply.code(503).send({ ok: false, error: (e as Error).message });
        return null;
      }
    },
  );

  app.post<{ Body: { url?: string; useCache?: boolean } }>(
    '/admin/api/lighthouse',
    async (req, reply) => {
      if (!guard(req, reply)) return null;
      const url = req.body?.url;
      if (!url) {
        reply.code(400).send({ ok: false, error: 'url required' });
        return null;
      }
      try {
        const result = await runLighthouse(url, { useCache: req.body?.useCache !== false });
        recordAudit({ actor: 'admin', action: 'lighthouse.run', target: url, outcome: 'ok' });
        return { ok: true, ...result };
      } catch (e) {
        recordAudit({
          actor: 'admin',
          action: 'lighthouse.run',
          target: url,
          outcome: 'error',
          meta: { error: (e as Error).message },
        });
        reply.code(503).send({ ok: false, error: (e as Error).message });
        return null;
      }
    },
  );
}
