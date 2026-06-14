import { logger } from '@heejun/spa-seo-gateway-core'

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * Canonical error envelope for the gateway.
 *
 * BACKWARD COMPATIBILITY CONTRACT: callers (admin UI, CDNs, monitoring) already
 * read Fastify's default error shape — `{ statusCode, error, message }`. This
 * handler preserves every one of those fields verbatim and only ADDS `path` +
 * `timestamp`. We never rename or drop `statusCode` (number) or `message`
 * (string), so existing consumers keep working unchanged.
 *
 * Fields:
 *   - statusCode: HTTP status (number)              [preserved]
 *   - error:      short status name e.g. "Not Found" [preserved when present]
 *   - message:    human-readable detail (string)    [preserved]
 *   - code:       Fastify/library error code         [preserved when present]
 *   - path:       request URL                        [added]
 *   - timestamp:  ISO-8601 of when the error was sent [added]
 */
interface ErrorEnvelope {
  statusCode: number
  error?: string
  message: string
  code?: string
  path: string
  timestamp: string
  [key: string]: unknown
}

/**
 * Register a global Fastify error handler that normalizes every thrown error
 * into the canonical envelope while preserving the legacy fields consumers
 * already depend on. 5xx responses are logged via the shared Pino logger.
 *
 * This is purely additive: route handlers that build their own reply bodies
 * (e.g. the render pipeline's explicit `reply.code(502).send(...)`) are
 * untouched — `setErrorHandler` only fires for *thrown* / unhandled errors.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Derive a numeric status. FastifyError carries `statusCode`; validation
    // errors default to 400; anything else falls back to 500.
    const statusCode =
      typeof error.statusCode === 'number' ? error.statusCode : error.validation ? 400 : 500

    // Preserve a human-readable message exactly as before. For 5xx we still
    // surface the error's own message (Fastify's default does the same) so we
    // do not change the response contract; sensitive stack traces are never
    // included in the body.
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : 'Internal Server Error'

    const envelope: ErrorEnvelope = {
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    }

    // Carry through Fastify's short status label + error code when present so
    // the shape stays a strict superset of the framework default.
    if (typeof error.name === 'string' && error.name.length > 0 && error.name !== 'Error') {
      envelope.error = error.name
    }
    if (typeof error.code === 'string' && error.code.length > 0) {
      envelope.code = error.code
    }

    // Log server errors (5xx) with the shared Pino logger. 4xx are client
    // errors and intentionally not logged at error level to avoid noise.
    if (statusCode >= 500) {
      logger.error(
        {
          err: error.message,
          stack: error.stack,
          code: error.code,
          method: request.method,
          path: request.url,
          statusCode,
        },
        'request error handler caught 5xx'
      )
    }

    reply.code(statusCode).send(envelope)
  })
}
