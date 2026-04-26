import compress from '@fastify/compress';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { shutdownCache } from './cache.js';
import { config } from './config.js';
import { registerRoutes } from './handlers.js';
import { logger } from './logger.js';
import { browserPool } from './pool.js';

async function main() {
  const app = Fastify({
    logger,
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

  await registerRoutes(app);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    try {
      await app.close();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'fastify close error');
    }
    try {
      await browserPool.stop();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'pool stop error');
    }
    await shutdownCache();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) =>
    logger.error({ err: err.message, stack: err.stack }, 'uncaught exception'),
  );
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));

  await browserPool.start();

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
