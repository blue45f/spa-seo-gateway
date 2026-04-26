import compress from '@fastify/compress';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui';
import { FileSiteStore, registerCms } from '@heejun/spa-seo-gateway-cms';
import {
  browserPool,
  config,
  logger,
  shutdownCache,
  startHotReload,
  startWarmCron,
  stopHotReload,
  stopWarmCron,
} from '@heejun/spa-seo-gateway-core';
import { FileTenantStore, registerMultiTenant } from '@heejun/spa-seo-gateway-multi-tenant';
import Fastify from 'fastify';
import { registerRoutes } from './routes.js';

async function main() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
    trustProxy: true,
    bodyLimit: 4 * 1024 * 1024,
    keepAliveTimeout: 65_000,
    connectionTimeout: 0,
  });

  await app.register(compress, {
    global: true,
    encodings: ['br', 'gzip'],
    threshold: 1024,
  });

  await app.register(cors, {
    origin: true,
    credentials: false,
  });

  if (config.rateLimit.enabled) {
    await app.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindow,
      allowList: (req) =>
        req.url.startsWith('/health') ||
        req.url.startsWith('/metrics') ||
        req.url.startsWith('/admin'),
    });
  }

  if (config.mode === 'saas') {
    const store = new FileTenantStore(config.tenantStoreFile);
    await registerMultiTenant(app as unknown as Parameters<typeof registerMultiTenant>[0], {
      store,
    });
  } else if (config.mode === 'cms') {
    const store = new FileSiteStore(config.siteStoreFile);
    await registerCms(app as unknown as Parameters<typeof registerCms>[0], { store });
  } else {
    await registerRoutes(app as unknown as Parameters<typeof registerRoutes>[0]);
  }
  await registerAdminUI(app as unknown as Parameters<typeof registerAdminUI>[0], {
    prefix: '/admin/ui',
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'graceful shutdown initiated');
    const drainStart = Date.now();
    const drainTimeoutMs = 30_000;

    app.addHook('onRequest', (_req, reply, done) => {
      if (shuttingDown) {
        reply.header('connection', 'close').code(503).send({ error: 'shutting down' });
        return;
      }
      done();
    });

    try {
      await Promise.race([app.close(), new Promise((res) => setTimeout(res, drainTimeoutMs))]);
      logger.info({ ms: Date.now() - drainStart }, 'fastify drained');
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'fastify close error');
    }
    stopHotReload();
    stopWarmCron();
    try {
      await browserPool.stop();
      logger.info('browser pool stopped');
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'pool stop error');
    }
    try {
      await shutdownCache();
      logger.info('cache disconnected');
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'cache disconnect error');
    }
    logger.info({ totalMs: Date.now() - drainStart }, 'shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) =>
    logger.error({ err: err.message, stack: err.stack }, 'uncaught exception'),
  );
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));

  await browserPool.start();
  startHotReload();
  startWarmCron();

  await app.listen({ host: config.server.host, port: config.server.port });
  logger.info(
    {
      mode: config.mode,
      origin: config.originUrl,
      port: config.server.port,
      pool: { min: config.renderer.poolMin, max: config.renderer.poolMax },
    },
    'spa-seo-gateway ready',
  );
}

main().catch((err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'fatal startup error');
  process.exit(1);
});
