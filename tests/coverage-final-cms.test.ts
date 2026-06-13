/**
 * Final coverage push for packages/cms/src/index.ts.
 *
 * Targets the lines NOT reached by cms-deep.test.ts:
 *   - guardAdmin 404 when no admin token configured (lines 191-192)
 *   - readCookie loop completes without finding name (line 213)
 *   - POST /admin/api/sites bad schema → 400 (lines 226-227)
 *   - render handler's /admin/... bail to callNotFound (line 303)
 *   - render success path (lines 353-364) via cacheSwr hit (pre-populated)
 *
 * Documented unreachable:
 *   - FileSiteStore.byHost catch (line 130) — readAll filters via SiteSchema,
 *     which enforces z.string().url(); a stored origin can never reach the
 *     URL constructor in a malformed state.
 *   - matchSiteRoute URL parse catch (line 168) — target is built from
 *     new URL(req.url, site.origin) and is always valid.
 */
import { InMemorySiteStore, registerCms, type Site } from '@heejun/spa-seo-gateway-cms'
import { cacheKey, cacheSet } from '@heejun/spa-seo-gateway-core'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

const ADMIN_TOKEN = 'cms-cov-token'

function sampleSite(overrides: Partial<Site> = {}): Site {
  return {
    id: 'docs',
    name: 'Docs',
    origin: 'https://www.example.com',
    routes: [],
    enabled: true,
    ...overrides,
  }
}

async function buildApp(register: (a: FastifyInstance) => Promise<void>): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await register(app)
  await app.ready()
  return app
}

let app: FastifyInstance | undefined

afterEach(async () => {
  if (app) {
    await app.close()
    app = undefined
  }
})

describe('CMS guardAdmin — admin disabled (lines 191-192)', () => {
  it('GET /admin/api/sites returns 404 when no adminToken is configured', async () => {
    const store = new InMemorySiteStore()
    app = await buildApp(async (a) => {
      // Force adminToken to be falsy. Override core.config.adminToken too in case it leaked from another test.
      const core = await import('@heejun/spa-seo-gateway-core')
      ;(core.config as { adminToken?: string }).adminToken = undefined
      await registerCms(a, { store, adminToken: undefined })
    })
    const res = await app.inject({ method: 'GET', url: '/admin/api/sites' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toMatch(/admin disabled/)
  })
})

describe('CMS readCookie — completes without seo-admin (line 213)', () => {
  it('cookie present but does not contain seo-admin → 401, not 200', async () => {
    const store = new InMemorySiteStore()
    app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN })
    })
    // Send a cookie header without 'seo-admin' so readCookie iterates and returns undefined.
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/sites',
      headers: { cookie: 'other=foo; another=bar' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toMatch(/unauthorized/)
  })

  it('cookie header with no equals at all is tolerated', async () => {
    const store = new InMemorySiteStore()
    app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN })
    })
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/sites',
      headers: { cookie: 'malformed-no-equals' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('CMS POST /admin/api/sites — schema fail (lines 226-227)', () => {
  it('400 when body fails SiteSchema validation', async () => {
    const store = new InMemorySiteStore()
    app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN })
    })
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/sites',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: { id: 'BAD ID WITH SPACES', name: 'x', origin: 'not-a-url' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().ok).toBe(false)
    expect(res.json().error).toBeDefined()
  })

  it('POST /admin/api/sites happy path returns ok+site (covers happy schema branch)', async () => {
    const store = new InMemorySiteStore()
    app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN })
    })
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/sites',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: {
        id: 'happy-id',
        name: 'Happy',
        origin: 'https://happy.example.com',
        routes: [],
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(res.json().site.id).toBe('happy-id')
  })
})

describe('CMS render route — /admin/... callNotFound (line 303)', () => {
  it('GET /admin/something-unhandled inside render scope returns 404 (callNotFound)', async () => {
    const store = new InMemorySiteStore()
    await store.upsert(sampleSite({ id: 'a', origin: 'https://a.example.com' }))
    app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN })
    })
    // /admin/api/UNDEFINED-PATH is not a registered admin route → preHandler bails,
    // wildcard handler runs and matches the prefix → calls callNotFound.
    const res = await app.inject({
      method: 'GET',
      url: `/admin/totally-unmapped-route-${Math.random().toString(36).slice(2)}`,
      headers: { 'user-agent': 'Googlebot/2.1', host: 'a.example.com' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /health falls through the wildcard render (covers /health prefix bail)', async () => {
    const store = new InMemorySiteStore()
    await store.upsert(sampleSite({ id: 'a', origin: 'https://a.example.com' }))
    app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN })
    })
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'user-agent': 'Googlebot/2.1', host: 'a.example.com' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /metrics likewise bails to callNotFound', async () => {
    const store = new InMemorySiteStore()
    await store.upsert(sampleSite({ id: 'a', origin: 'https://a.example.com' }))
    app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN })
    })
    const res = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { 'user-agent': 'Googlebot/2.1', host: 'a.example.com' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('CMS render route — cache HIT success path (lines 353-364)', () => {
  it('bot UA + pre-populated cache → 200 with x-cache: HIT and x-site-id', async () => {
    const store = new InMemorySiteStore()
    await store.upsert(sampleSite({ id: 'cached', origin: 'https://www.example.com', routes: [] }))
    app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN })
    })

    // Pre-populate the cache so cacheSwr returns from cache (fromCache: 'cache')
    // and we don't need to call render() (no pool).
    const target = 'https://www.example.com/cached-page'
    const key = cacheKey(target, 'default', 'site:cached')
    await cacheSet(key, {
      body: '<html><body>cached body</body></html>',
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      createdAt: Date.now(),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/cached-page',
      headers: { 'user-agent': 'Googlebot/2.1', host: 'www.example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-site-id']).toBe('cached')
    expect(res.headers['x-cache']).toBe('HIT')
    expect(res.headers['x-cache-stale']).toBe('0')
    expect(res.body).toContain('cached body')
  })
})
