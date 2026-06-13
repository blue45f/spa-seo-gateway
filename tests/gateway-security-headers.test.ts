/**
 * Verifies the baseline security response headers added by
 * `apps/gateway/src/security-headers.ts` are present on real HTTP responses.
 *
 * Boots the full app via the exported `buildApp()` factory (same seam as
 * gateway-e2e.test.ts) and exercises both a generic route (/health) and the
 * admin surface (/admin/ui/), which gets the extra frame/CORP protections.
 *
 * The browser pool is intentionally not started — we only assert on response
 * headers for routes that don't require rendering.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../apps/gateway/src/main.js'

import type { FastifyInstance } from 'fastify'

const TIMEOUT_MS = 5_000
// Booting + draining the full gateway app per test is heavy; allow extra
// headroom so app.close() does not trip the default hook timeout under
// parallel-suite CPU contention.
const HOOK_TIMEOUT_MS = 60_000

let app: FastifyInstance
let baseUrl: string

beforeEach(async () => {
  app = await buildApp({ useLoggerInstance: false })
  await app.ready()
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address()
  if (!addr || typeof addr === 'string') throw new Error('no listening address')
  baseUrl = `http://127.0.0.1:${addr.port}`
}, HOOK_TIMEOUT_MS)

afterEach(async () => {
  await app.close()
}, HOOK_TIMEOUT_MS)

function f(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

describe('gateway security headers — baseline (every route)', () => {
  it('GET /health carries nosniff + referrer-policy + dns-prefetch-control', async () => {
    const res = await f('/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('x-dns-prefetch-control')).toBe('off')
  })

  it('GET /metrics keeps Prometheus content-type AND gains nosniff', async () => {
    const res = await f('/metrics')
    expect(res.status).toBe(200)
    // Security header is additive — it must not clobber the exposition type.
    expect(res.headers.get('content-type') ?? '').toMatch(/text\/plain/)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('gateway security headers — admin surface (frame + CORP)', () => {
  it('GET /admin/api/public/info adds X-Frame-Options + Cross-Origin-Resource-Policy', async () => {
    // Use the admin JSON endpoint (not the SPA index) so we avoid the
    // @fastify/compress readFile path and assert purely on /admin headers.
    const res = await f('/admin/api/public/info')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    // Baseline headers still present on admin routes too.
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('GET /health (non-admin) does NOT set the admin-only frame guard', async () => {
    const res = await f('/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-frame-options')).toBeNull()
    expect(res.headers.get('cross-origin-resource-policy')).toBeNull()
  })
})
