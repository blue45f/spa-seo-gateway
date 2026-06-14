import { fileURLToPath } from 'node:url'

import compress from '@fastify/compress'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui'
import { FileSiteStore, registerCms } from '@heejun/spa-seo-gateway-cms'
import {
  browserPool,
  config,
  logger,
  shutdownCache,
  startHotReload,
  startWarmCron,
  stopHotReload,
  stopWarmCron,
} from '@heejun/spa-seo-gateway-core'
import { FileTenantStore, registerMultiTenant } from '@heejun/spa-seo-gateway-multi-tenant'
import Fastify, { type FastifyInstance } from 'fastify'

import { registerErrorHandler } from './error-handler.js'
import { registerRoutes } from './routes.js'
import { registerSecurityHeaders } from './security-headers.js'

/**
 * Build the Fastify app with all middleware and routes wired up — but do NOT
 * start the browser pool, hot reload, warm cron, or call `app.listen()`.
 *
 * Use this in tests (or other embedded scenarios) when you want to exercise the
 * full route/middleware composition without side-effects on global subsystems.
 */
export async function buildApp(
  opts: { useLoggerInstance?: boolean } = {}
): Promise<FastifyInstance> {
  const useLoggerInstance = opts.useLoggerInstance ?? true
  const app = Fastify({
    ...(useLoggerInstance ? { loggerInstance: logger } : { logger: false }),
    disableRequestLogging: false,
    trustProxy: true,
    bodyLimit: 4 * 1024 * 1024,
    keepAliveTimeout: 65_000,
    connectionTimeout: 0,
  })

  // Canonical error envelope for any *thrown* / unhandled request error. Set
  // before plugins/routes so it applies across every mode (proxy/saas/cms/
  // render). Additive: explicit `reply.code().send()` paths are unaffected.
  registerErrorHandler(app as unknown as Parameters<typeof registerErrorHandler>[0])

  await app.register(compress, {
    global: true,
    encodings: ['br', 'gzip'],
    threshold: 1024,
  })

  await app.register(cors, {
    origin: true,
    credentials: false,
  })

  // Baseline security response headers (nosniff, referrer-policy, frame guard
  // for /admin). Registered before routes so it covers every reply. Cast mirrors
  // the other register* calls (Pino logger generic vs plain FastifyInstance).
  registerSecurityHeaders(app as unknown as Parameters<typeof registerSecurityHeaders>[0])

  if (config.rateLimit.enabled) {
    await app.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindow,
      allowList: (req) =>
        req.url.startsWith('/health') ||
        req.url.startsWith('/metrics') ||
        req.url.startsWith('/admin'),
    })
  }

  if (config.mode === 'saas') {
    const store = new FileTenantStore(config.tenantStoreFile)
    await registerMultiTenant(app as unknown as Parameters<typeof registerMultiTenant>[0], {
      store,
    })
  } else if (config.mode === 'cms') {
    const store = new FileSiteStore(config.siteStoreFile)
    await registerCms(app as unknown as Parameters<typeof registerCms>[0], { store })
  } else {
    await registerRoutes(app as unknown as Parameters<typeof registerRoutes>[0])
  }
  await registerAdminUI(app as unknown as Parameters<typeof registerAdminUI>[0], {
    prefix: '/admin/ui',
  })

  // Cast away the Pino-specific logger generic so callers (tests + main) can
  // treat the result as a plain FastifyInstance.
  return app as unknown as FastifyInstance
}

async function main() {
  const app = await buildApp()

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'graceful shutdown initiated')
    const drainStart = Date.now()
    const drainTimeoutMs = 30_000

    app.addHook('onRequest', (_req, reply, done) => {
      if (shuttingDown) {
        reply.header('connection', 'close').code(503).send({ error: 'shutting down' })
        return
      }
      done()
    })

    try {
      await Promise.race([app.close(), new Promise((res) => setTimeout(res, drainTimeoutMs))])
      logger.info({ ms: Date.now() - drainStart }, 'fastify drained')
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'fastify close error')
    }
    stopHotReload()
    stopWarmCron()
    try {
      await browserPool.stop()
      logger.info('browser pool stopped')
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'pool stop error')
    }
    try {
      await shutdownCache()
      logger.info('cache disconnected')
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'cache disconnect error')
    }
    logger.info({ totalMs: Date.now() - drainStart }, 'shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('uncaughtException', (err) =>
    logger.error({ err: err.message, stack: err.stack }, 'uncaught exception')
  )
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'))

  await browserPool.start()
  startHotReload()
  startWarmCron()

  await app.listen({ host: config.server.host, port: config.server.port })
  logger.info(
    {
      mode: config.mode,
      origin: config.originUrl,
      port: config.server.port,
      pool: { min: config.renderer.poolMin, max: config.renderer.poolMax },
    },
    'spa-seo-gateway ready'
  )
}

// Only auto-invoke main() when this file is the entrypoint (e.g. `node dist/main.js` or
// `tsx src/main.ts`). When imported by tests we want `buildApp()` to be available
// without triggering listen / pool / hot-reload side effects.
const isEntrypoint = (() => {
  if (!process.argv[1]) return false
  try {
    return fileURLToPath(import.meta.url) === process.argv[1]
  } catch {
    return false
  }
})()

if (isEntrypoint) {
  main().catch((err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'fatal startup error')
    process.exit(1)
  })
}
