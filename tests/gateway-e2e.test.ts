/**
 * End-to-end integration tests that boot the full Fastify app from
 * `apps/gateway/src/main.ts` (via the exported `buildApp()` factory) and
 * exercise every route over real HTTP — not `app.inject`.
 *
 * What this exercises:
 *   - compress + cors + (when enabled) rate-limit registration
 *   - mode-specific route registration (default `render-only`)
 *   - admin-ui SPA hosting + admin API auth (header + login cookie)
 *   - catch-all `/*` bot detection + render bypass path
 *
 * What this does NOT exercise:
 *   - browser pool / puppeteer (intentionally not started; render paths fail
 *     with 502 which we then assert on)
 *   - hot reload, warm cron — those live in `main()`, never invoked by tests
 *
 * The test mutates `config.adminToken` to enable the admin auth flow then
 * restores it in afterAll. Each test boots the app on a random port and
 * tears it down via `app.close()` to release the listener.
 */
import { config, setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../apps/gateway/src/main.js'

import type { FastifyInstance } from 'fastify'

const ADMIN_TOKEN = 'test-token'
const TIMEOUT_MS = 5_000

let app: FastifyInstance
let baseUrl: string
let originalAdminToken: string | undefined

beforeAll(() => {
  originalAdminToken = (config as { adminToken?: string }).adminToken
  ;(config as { adminToken?: string }).adminToken = ADMIN_TOKEN
})

afterAll(() => {
  ;(config as { adminToken?: string }).adminToken = originalAdminToken
  setAiSchemaAdapter(null)
})

beforeEach(async () => {
  app = await buildApp({ useLoggerInstance: false })
  await app.ready()
  // port: 0 → OS picks a free port; host 127.0.0.1 keeps it loopback-only.
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address()
  if (!addr || typeof addr === 'string') throw new Error('no listening address')
  baseUrl = `http://127.0.0.1:${addr.port}`
})

afterEach(async () => {
  await app.close()
})

function f(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

describe('gateway e2e — health + metrics', () => {
  it('GET /health returns 200 with ok + pool/cache/breakers fields', async () => {
    const res = await f('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.pool).toBeDefined()
    expect(body.cache).toBeDefined()
    expect(body.breakers).toBeDefined()
    expect(typeof body.uptime).toBe('number')
  })

  it('GET /metrics returns Prometheus text/plain', async () => {
    const res = await f('/metrics')
    expect(res.status).toBe(200)
    const ct = res.headers.get('content-type') ?? ''
    // Prometheus client uses `text/plain; version=0.0.4; charset=utf-8`.
    expect(ct).toMatch(/text\/plain/)
    const body = await res.text()
    // Exposition format always contains at least a `# HELP` or `# TYPE` line.
    expect(body).toMatch(/^#/m)
  })
})

describe('gateway e2e — admin-ui public + whoami', () => {
  it('GET /admin/api/public/info returns 200 without auth', async () => {
    const res = await f('/admin/api/public/info')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(typeof body.mode).toBe('string')
    expect(typeof body.uptimeSec).toBe('number')
  })

  it('GET /admin/api/whoami returns 200 + authenticated:false without creds', async () => {
    const res = await f('/admin/api/whoami')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.authenticated).toBe(false)
    expect(body.adminEnabled).toBe(true)
  })
})

describe('gateway e2e — admin-ui auth (login + cookie + header)', () => {
  it('GET /admin/api/site returns 401 without admin token', async () => {
    const res = await f('/admin/api/site')
    expect(res.status).toBe(401)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.error).toMatch(/unauthorized/i)
  })

  it('POST /admin/api/login with wrong token → 401', async () => {
    const res = await f('/admin/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'wrong-token' }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(false)
  })

  it('POST /admin/api/login with right token → 200 + Set-Cookie', async () => {
    const res = await f('/admin/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: ADMIN_TOKEN }),
    })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie ?? '').toMatch(/seo-admin=/)
    expect(setCookie ?? '').toMatch(/HttpOnly/)
  })

  it('GET /admin/api/site with valid X-Admin-Token → 200', async () => {
    const res = await f('/admin/api/site', {
      headers: { 'x-admin-token': ADMIN_TOKEN },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.cache).toBeDefined()
    expect(body.breakers).toBeDefined()
  })
})

describe('gateway e2e — admin cache invalidation', () => {
  it('POST /admin/cache/invalidate without token → 401', async () => {
    const res = await f('/admin/cache/invalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/page' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /admin/cache/invalidate with token + url → 200', async () => {
    const res = await f('/admin/cache/invalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': ADMIN_TOKEN,
      },
      body: JSON.stringify({ url: 'https://example.com/page' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.url).toBe('https://example.com/page')
    expect(typeof body.key).toBe('string')
  })
})

describe('gateway e2e — admin-ui SPA hosting', () => {
  it('GET /admin/ui (no trailing slash) → 302 redirect to /admin/ui/', async () => {
    const res = await f('/admin/ui', { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/admin/ui/')
  })

  it('GET /admin/ui/ → 200 html containing <div id="root"></div>', async () => {
    const res = await f('/admin/ui/')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/)
    const body = await res.text()
    expect(body).toContain('<div id="root"></div>')
  })

  it('GET /admin/ui/dashboard → 200 (SPA fallback to index.html)', async () => {
    // accept-encoding: identity → disables Brotli/gzip compression so we can
    // assert on the raw HTML body. Without this, Node's `fetch` would still
    // decode standard encodings, but the @fastify/compress + readFile path
    // can return an empty body when the client accepts compression and the
    // plugin's content-length probe diverges from the string output.
    const res = await f('/admin/ui/dashboard', {
      headers: { 'accept-encoding': 'identity' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/)
    const body = await res.text()
    expect(body).toContain('<div id="root"></div>')
  })
})

describe('gateway e2e — catch-all render bypass + bot path', () => {
  it('GET /some-page with human UA → 204 (bot detection bypass)', async () => {
    const res = await f('/some-page', {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('x-bypass-reason')).toBeTruthy()
  })

  it('GET /some-page with Googlebot UA → 502 (render fails since pool not running)', async () => {
    const res = await f('/some-page', {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        // Provide explicit host so buildTargetUrl can construct the absolute target.
        host: '127.0.0.1',
      },
    })
    // The render pipeline reaches `render()` which throws because the browser
    // pool was never started → route returns 502 with `{ error: 'render failed', ... }`.
    expect(res.status).toBe(502)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
  })
})

describe('gateway e2e — canonical error envelope', () => {
  it('thrown/parse error returns canonical envelope preserving statusCode + message', async () => {
    // Sending a malformed JSON body with application/json makes Fastify's body
    // parser throw, which is routed through our global setErrorHandler.
    const res = await f('/admin/cache/invalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': ADMIN_TOKEN,
      },
      body: '{ this is : not valid json',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as Record<string, unknown>
    // Backward-compatible fields preserved verbatim.
    expect(typeof body.statusCode).toBe('number')
    expect(body.statusCode).toBe(400)
    expect(typeof body.message).toBe('string')
    expect((body.message as string).length).toBeGreaterThan(0)
    // Additive canonical fields.
    expect(body.path).toBe('/admin/cache/invalidate')
    expect(typeof body.timestamp).toBe('string')
    expect(() => new Date(body.timestamp as string).toISOString()).not.toThrow()
  })
})

describe('gateway e2e — CORS preflight', () => {
  it('OPTIONS /health with Origin → allowed by @fastify/cors', async () => {
    const res = await f('/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://example.org',
        'access-control-request-method': 'GET',
      },
    })
    // @fastify/cors with `origin: true` reflects request origin and returns 204
    // (preflight short-circuit) — accept 200/204 for portability.
    expect([200, 204]).toContain(res.status)
    const allow = res.headers.get('access-control-allow-origin')
    expect(allow).toBeTruthy()
    // Reflected origin or "*", either is acceptable for a permissive default.
    expect(allow).toMatch(/example\.org|\*/)
  })
})

/*
 * Cases intentionally skipped (documented per task brief):
 *
 *   - Rate-limit trip: would require >120 requests within the 1-minute window
 *     against a single endpoint that is NOT in the allowList (`/health`,
 *     `/metrics`, `/admin/*` are skipped). Sending that many requests serially
 *     is slow and the rate-limit window can't easily be shortened from inside
 *     a test without re-parsing config. Skipped per task brief.
 */
