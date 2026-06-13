/**
 * Final coverage push for packages/admin-ui/src/index.ts — targets the remaining
 * uncovered branches that admin-ui-api.test.ts / admin-ui-spa.test.ts don't reach.
 *
 * Specifically:
 *   - SPA fallback 500 when index.html is missing (line 137)
 *   - login 404 when admin disabled (lines 83-84)
 *   - getCookie returns undefined when cookie name not present (line 53)
 *   - PUT /admin/api/routes catches bad regex (lines 181, 187-188)
 *   - render-test success path (line 265) — render() stubbed via doMock
 *   - visual-diff success path (lines 310, 317) — runVisualDiff stubbed
 *   - ai/schema render-then-catch (lines 351, 355, 367, 374-375)
 *   - lighthouse success path (lines 391-392) — runLighthouse stubbed
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FastifyInstance } from 'fastify'

const ADMIN_TOKEN = 'cf-admin-token'

let app: FastifyInstance | undefined

beforeEach(() => {
  vi.resetModules()
})

afterEach(async () => {
  if (app) {
    await app.close()
    app = undefined
  }
  vi.restoreAllMocks()
  vi.doUnmock('@heejun/spa-seo-gateway-core')
  vi.doUnmock('node:fs/promises')
})

async function buildAppWithToken(
  token: string | undefined = ADMIN_TOKEN
): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const core = await import('@heejun/spa-seo-gateway-core')
  ;(core.config as { adminToken?: string }).adminToken = token
  const { registerAdminUI } = await import('@heejun/spa-seo-gateway-admin-ui')
  const a = Fastify({ logger: false })
  await registerAdminUI(a)
  await a.ready()
  return a
}

describe('admin-ui — getCookie undefined branch (line 53)', () => {
  it('whoami with cookie header that does NOT include seo-admin → not authenticated', async () => {
    app = await buildAppWithToken()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/whoami',
      headers: { cookie: 'other=value; another=thing' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().authenticated).toBe(false)
  })

  it('whoami with malformed cookie part (no equals) is tolerated', async () => {
    app = await buildAppWithToken()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/whoami',
      headers: { cookie: 'malformed-no-equals; ok=value' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().authenticated).toBe(false)
  })
})

describe('admin-ui — login 404 when admin disabled (lines 83-84)', () => {
  it('POST /admin/api/login returns 404 when ADMIN_TOKEN is not set', async () => {
    app = await buildAppWithToken(undefined)
    const core = await import('@heejun/spa-seo-gateway-core')
    // double-ensure adminToken is unset after the (cached) module was loaded earlier
    ;(core.config as { adminToken?: string }).adminToken = undefined
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/login',
      headers: { 'content-type': 'application/json' },
      payload: { token: 'anything' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ ok: false, error: 'admin disabled' })
  })
})

describe('admin-ui — additional unauthenticated branches (lines 334, 383)', () => {
  it('POST /admin/api/ai/schema returns 401 without admin token', async () => {
    app = await buildAppWithToken()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/ai/schema',
      headers: { 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /admin/api/lighthouse returns 401 without admin token', async () => {
    app = await buildAppWithToken()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/lighthouse',
      headers: { 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /admin/api/ai/schema with NO body still hits the url-required 400 path (line 343 default)', async () => {
    app = await buildAppWithToken()
    const { setAiSchemaAdapter } = await import('@heejun/spa-seo-gateway-core')
    setAiSchemaAdapter({
      suggestSchema: async () => [],
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/api/ai/schema',
        headers: { 'x-admin-token': ADMIN_TOKEN },
        // No payload → req.body undefined → body ?? {} fallback
      })
      expect(res.statusCode).toBe(400)
    } finally {
      setAiSchemaAdapter(null)
    }
  })

  it('login: when x-forwarded-proto=https, the Secure flag is added to the cookie (line 99 branch)', async () => {
    app = await buildAppWithToken()
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/login',
      headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https,wss' },
      payload: { token: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const setCookie = res.headers['set-cookie']
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie as string)
    expect(cookieStr).toMatch(/Secure/)
  })
})

describe('admin-ui — PUT /admin/api/routes catches bad regex (lines 181, 187-188)', () => {
  it('400 on invalid regex pattern, records audit error', async () => {
    app = await buildAppWithToken()
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/api/routes',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: { routes: [{ pattern: '[unclosed' }] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().ok).toBe(false)
    expect(typeof res.json().error).toBe('string')
  })
})

describe('admin-ui — SPA fallback 500 when index.html missing (line 137)', () => {
  it('returns 500 with helpful error when readFile throws', async () => {
    // Mock fs/promises so the SPA fallback handler hits the catch branch.
    vi.doMock('node:fs/promises', async () => {
      const real = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
      return {
        ...real,
        readFile: vi.fn(async (path: unknown, ...rest: unknown[]) => {
          if (typeof path === 'string' && path.endsWith('index.html')) {
            throw new Error('ENOENT mocked')
          }
          return (real.readFile as any)(path, ...rest)
        }),
      }
    })

    app = await buildAppWithToken()
    const res = await app.inject({ method: 'GET', url: '/admin/ui/some/spa/route' })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toMatch(/admin SPA not built/)
  })
})

describe('admin-ui — ai/schema render then catch (lines 351, 355, 367, 374-375)', () => {
  it('without html in body, render() is called; when render throws, response is 503', async () => {
    app = await buildAppWithToken()
    const { setAiSchemaAdapter } = await import('@heejun/spa-seo-gateway-core')
    setAiSchemaAdapter({
      suggestSchema: async () => [{ type: 'Article', jsonLd: {}, confidence: 0.5 }],
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/api/ai/schema',
        headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
        payload: { url: 'https://www.example.com/' },
      })
      // render() throws (no pool) → 503 catch path
      expect(res.statusCode).toBe(503)
      expect(res.json().ok).toBe(false)
    } finally {
      setAiSchemaAdapter(null)
    }
  })

  it('with html provided, adapter is invoked directly; adapter throwing → 503 catch path', async () => {
    app = await buildAppWithToken()
    const { setAiSchemaAdapter } = await import('@heejun/spa-seo-gateway-core')
    setAiSchemaAdapter({
      suggestSchema: async () => {
        throw new Error('adapter boom')
      },
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/api/ai/schema',
        headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
        payload: { url: 'https://www.example.com/', html: '<html></html>' },
      })
      expect(res.statusCode).toBe(503)
      expect(res.json().error).toMatch(/adapter boom/)
    } finally {
      setAiSchemaAdapter(null)
    }
  })

  it('ai/schema render success → adapter receives entry.body (lines 351 + 355)', async () => {
    // Mock the core module so render() returns successfully.
    vi.doMock('@heejun/spa-seo-gateway-core', async () => {
      const real = await vi.importActual<typeof import('@heejun/spa-seo-gateway-core')>(
        '@heejun/spa-seo-gateway-core'
      )
      return {
        ...real,
        render: vi.fn(async () => ({
          status: 200,
          body: '<html><body>RENDERED</body></html>',
          headers: { 'content-type': 'text/html' },
          createdAt: Date.now(),
        })),
      }
    })

    const Fastify = (await import('fastify')).default
    const core = await import('@heejun/spa-seo-gateway-core')
    ;(core.config as { adminToken?: string }).adminToken = ADMIN_TOKEN

    const { registerAdminUI } = await import('@heejun/spa-seo-gateway-admin-ui')
    app = Fastify({ logger: false })
    await registerAdminUI(app)
    await app.ready()

    const { setAiSchemaAdapter } = core
    let receivedHtml = ''
    setAiSchemaAdapter({
      suggestSchema: async (html) => {
        receivedHtml = html
        return [{ type: 'Article', jsonLd: { ok: true }, confidence: 0.7 }]
      },
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/api/ai/schema',
        headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
        payload: { url: 'https://www.example.com/' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().ok).toBe(true)
      expect(receivedHtml).toContain('RENDERED')
    } finally {
      setAiSchemaAdapter(null)
    }
  })
})

describe('admin-ui — render-test / visual-diff / lighthouse success paths', () => {
  it('render-test success (line 265) returns 200 with bytes / bodyPreview / durationMs', async () => {
    vi.doMock('@heejun/spa-seo-gateway-core', async () => {
      const real = await vi.importActual<typeof import('@heejun/spa-seo-gateway-core')>(
        '@heejun/spa-seo-gateway-core'
      )
      return {
        ...real,
        render: vi.fn(async () => ({
          status: 200,
          body: '<html>STUB</html>',
          headers: { 'content-type': 'text/html' },
          createdAt: Date.now(),
        })),
      }
    })

    const Fastify = (await import('fastify')).default
    const core = await import('@heejun/spa-seo-gateway-core')
    ;(core.config as { adminToken?: string }).adminToken = ADMIN_TOKEN
    const { registerAdminUI } = await import('@heejun/spa-seo-gateway-admin-ui')
    app = Fastify({ logger: false })
    await registerAdminUI(app)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/render-test',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/x' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe(200)
    expect(typeof body.durationMs).toBe('number')
    expect(body.bodyPreview).toContain('STUB')
    expect(typeof body.bytes).toBe('number')
  })

  it('visual-diff success (lines 310, 317) returns 200 + result', async () => {
    vi.doMock('@heejun/spa-seo-gateway-core', async () => {
      const real = await vi.importActual<typeof import('@heejun/spa-seo-gateway-core')>(
        '@heejun/spa-seo-gateway-core'
      )
      return {
        ...real,
        runVisualDiff: vi.fn(async () => ({
          url: 'https://www.example.com/',
          baselinePath: '/tmp/baseline.png',
          diffPath: '/tmp/baseline.diff.png',
          width: 1280,
          height: 800,
          diffPixels: 0,
          diffPercent: 0,
          baselineCreated: false,
          durationMs: 12,
        })),
      }
    })

    const Fastify = (await import('fastify')).default
    const core = await import('@heejun/spa-seo-gateway-core')
    ;(core.config as { adminToken?: string }).adminToken = ADMIN_TOKEN
    const { registerAdminUI } = await import('@heejun/spa-seo-gateway-admin-ui')
    app = Fastify({ logger: false })
    await registerAdminUI(app)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/visual-diff',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: {
        url: 'https://www.example.com/',
        mode: 'compare',
        threshold: 0.1,
        fullPage: true,
        width: 1280,
        height: 800,
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.result.diffPixels).toBe(0)
  })

  it('lighthouse success (lines 391-392) returns 200 + scores', async () => {
    vi.doMock('@heejun/spa-seo-gateway-core', async () => {
      const real = await vi.importActual<typeof import('@heejun/spa-seo-gateway-core')>(
        '@heejun/spa-seo-gateway-core'
      )
      return {
        ...real,
        runLighthouse: vi.fn(async () => ({
          url: 'https://www.example.com/',
          durationMs: 100,
          scores: {
            performance: 92,
            accessibility: 90,
            bestPractices: 88,
            seo: 100,
            pwa: null,
          },
          topAudits: [],
          fetchedAt: new Date().toISOString(),
        })),
      }
    })

    const Fastify = (await import('fastify')).default
    const core = await import('@heejun/spa-seo-gateway-core')
    ;(core.config as { adminToken?: string }).adminToken = ADMIN_TOKEN
    const { registerAdminUI } = await import('@heejun/spa-seo-gateway-admin-ui')
    app = Fastify({ logger: false })
    await registerAdminUI(app)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/lighthouse',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/', useCache: false },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.scores.performance).toBe(92)
  })
})
