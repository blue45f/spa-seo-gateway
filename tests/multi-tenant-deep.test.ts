/**
 * Deep coverage for @heejun/spa-seo-gateway-multi-tenant.
 *
 * Targets:
 *   - InMemoryTenantStore: list / byId / byApiKey / byHost / upsert / remove
 *   - FileTenantStore: byHost / byApiKey happy paths
 *   - preHandler resolver: host, apiKey, subdomain, pathPrefix, chained host->apiKey
 *   - render handler branches: unknown tenant (404), human UA (204 bypass),
 *     static asset (204 x-prerender-skip), ignored route (204 x-prerender-route),
 *     bot UA -> would render (502 because puppeteer pool is not running here)
 *   - POST /api/cache/invalidate: ok / missing url / invalid key
 *   - POST /admin/api/multi-tenant/cache/clear: admin token required
 *
 * Intentionally NOT covered:
 *   - Rate-limit tripping (would require 100+ requests on free plan; PLAN_LIMITS
 *     is not exported so we can't lower it cheaply).
 *   - "host outside tenant origin" 403: dead branch in practice because
 *     `new URL(req.url, tenant.origin)` always yields target.host === tenant.host
 *     when req.url is a Fastify path. Documented here for completeness.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  FileTenantStore,
  InMemoryTenantStore,
  registerMultiTenant,
  type Tenant,
} from '@heejun/spa-seo-gateway-multi-tenant'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const ADMIN_TOKEN = 'deep-admin-token'
const BOT_UA = 'Googlebot/2.1'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'spa-mt-deep-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'acme',
    name: 'ACME',
    origin: 'https://www.acme.com',
    apiKey: 'tk_acme_aaaaaaaaaaaaaaaaaaaa',
    routes: [],
    plan: 'free',
    enabled: true,
    ...overrides,
  }
}

async function buildAppWith(
  store: InMemoryTenantStore | FileTenantStore,
  resolve?: Array<'host' | 'apiKey' | 'subdomain' | 'pathPrefix'>
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await registerMultiTenant(app, { store, adminToken: ADMIN_TOKEN, resolve })
  await app.ready()
  return app
}

// ─── InMemoryTenantStore ────────────────────────────────────────────────

describe('InMemoryTenantStore', () => {
  it('upsert + list + byId + remove + byApiKey + byHost', async () => {
    const store = new InMemoryTenantStore()
    expect(await store.list()).toEqual([])
    expect(await store.byId('missing')).toBeNull()
    expect(await store.byApiKey('missing')).toBeNull()
    expect(await store.byHost('missing.example.com')).toBeNull()

    const t = makeTenant()
    await store.upsert(t)
    const list = await store.list()
    expect(list.length).toBe(1)
    expect(list[0]?.id).toBe('acme')

    expect((await store.byId('acme'))?.id).toBe('acme')
    expect((await store.byApiKey(t.apiKey))?.id).toBe('acme')
    expect((await store.byHost('www.acme.com'))?.id).toBe('acme')
    expect(await store.byHost('not.acme.com')).toBeNull()

    // upsert again (overwrite)
    await store.upsert(makeTenant({ name: 'ACME-2' }))
    expect((await store.byId('acme'))?.name).toBe('ACME-2')

    // remove
    expect(await store.remove('acme')).toBe(true)
    expect(await store.remove('acme')).toBe(false)
    expect(await store.list()).toEqual([])
  })

  it('byHost gracefully ignores tenants with malformed origins', async () => {
    const store = new InMemoryTenantStore()
    // bypass schema by casting — covers the try/catch URL branch
    await store.upsert({
      ...makeTenant({ id: 'broken' }),
      origin: 'not a url' as unknown as string,
    } as Tenant)
    expect(await store.byHost('anything')).toBeNull()
  })
})

// ─── FileTenantStore byHost / byApiKey ──────────────────────────────────

describe('FileTenantStore lookups', () => {
  it('byHost matches tenant by origin host', async () => {
    const store = new FileTenantStore(join(tmp, 'fhost.json'))
    await store.upsert(makeTenant({ id: 'fh', origin: 'https://fh.example.com' }))
    expect((await store.byHost('fh.example.com'))?.id).toBe('fh')
    expect(await store.byHost('nope.example.com')).toBeNull()
  })

  it('byApiKey matches tenant by api key', async () => {
    const store = new FileTenantStore(join(tmp, 'fkey.json'))
    const t = makeTenant({ id: 'fk', apiKey: 'tk_fk_bbbbbbbbbbbbbbbbbbbb' })
    await store.upsert(t)
    expect((await store.byApiKey(t.apiKey))?.id).toBe('fk')
    expect(await store.byApiKey('nope')).toBeNull()
  })
})

// ─── preHandler resolver strategies ─────────────────────────────────────

describe('preHandler resolver strategies', () => {
  it('host strategy: matched host attaches tenant; unmatched yields unknown', async () => {
    const store = new InMemoryTenantStore()
    await store.upsert(makeTenant())
    const app = await buildAppWith(store, ['host'])

    // Matched host + bot UA → not a real puppeteer pool, expect 502 render failure.
    // The point is: tenant DID resolve, otherwise we'd get 404.
    const matched = await app.inject({
      method: 'GET',
      url: '/page',
      headers: { 'user-agent': BOT_UA, host: 'www.acme.com' },
    })
    expect(matched.statusCode).toBe(502)

    // Unmatched host → unknown tenant
    const unmatched = await app.inject({
      method: 'GET',
      url: '/page',
      headers: { 'user-agent': BOT_UA, host: 'unknown.example.com' },
    })
    expect(unmatched.statusCode).toBe(404)
    expect(unmatched.json().error).toMatch(/unknown tenant/)
    await app.close()
  })

  it('apiKey strategy: x-api-key header attaches tenant', async () => {
    const store = new InMemoryTenantStore()
    const t = makeTenant({ id: 'kk', apiKey: 'tk_kk_cccccccccccccccccccc' })
    await store.upsert(t)
    const app = await buildAppWith(store, ['apiKey'])
    const res = await app.inject({
      method: 'GET',
      url: '/page',
      headers: { 'user-agent': BOT_UA, 'x-api-key': t.apiKey, host: 'whatever.example.com' },
    })
    // tenant resolved → render attempted → 502 (no browser pool)
    expect(res.statusCode).toBe(502)
    await app.close()
  })

  it('subdomain strategy: derives tenant id from host first label', async () => {
    const store = new InMemoryTenantStore()
    await store.upsert(makeTenant({ id: 'sub', origin: 'https://www.acme.com' }))
    const app = await buildAppWith(store, ['subdomain'])
    const res = await app.inject({
      method: 'GET',
      url: '/page',
      headers: { 'user-agent': BOT_UA, host: 'sub.example.com' },
    })
    // 'sub' resolves via store.byId('sub') → renders → 502
    expect(res.statusCode).toBe(502)
    await app.close()
  })

  it('pathPrefix strategy: /t/<id>/... extracts tenant id', async () => {
    const store = new InMemoryTenantStore()
    await store.upsert(makeTenant({ id: 'mytenant' }))
    const app = await buildAppWith(store, ['pathPrefix'])
    const res = await app.inject({
      method: 'GET',
      url: '/t/mytenant/foo',
      headers: { 'user-agent': BOT_UA, host: 'gateway.example.com' },
    })
    expect(res.statusCode).toBe(502)
    await app.close()
  })

  it('chained strategy: host miss falls back to apiKey', async () => {
    const store = new InMemoryTenantStore()
    const t = makeTenant({ id: 'chain', apiKey: 'tk_chain_dddddddddddddddddddd' })
    await store.upsert(t)
    const app = await buildAppWith(store, ['host', 'apiKey'])
    const res = await app.inject({
      method: 'GET',
      url: '/page',
      headers: {
        'user-agent': BOT_UA,
        host: 'mismatched.example.com',
        'x-api-key': t.apiKey,
      },
    })
    expect(res.statusCode).toBe(502)
    await app.close()
  })

  it('disabled tenant is NOT attached → unknown tenant', async () => {
    const store = new InMemoryTenantStore()
    await store.upsert(makeTenant({ enabled: false }))
    const app = await buildAppWith(store, ['host'])
    const res = await app.inject({
      method: 'GET',
      url: '/page',
      headers: { 'user-agent': BOT_UA, host: 'www.acme.com' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toMatch(/unknown tenant/)
    await app.close()
  })
})

// ─── render handler branches ────────────────────────────────────────────

describe('render handler branches', () => {
  it('human UA → 204 with x-bypass-reason', async () => {
    const store = new InMemoryTenantStore()
    await store.upsert(makeTenant())
    const app = await buildAppWith(store)
    const res = await app.inject({
      method: 'GET',
      url: '/page',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0',
        host: 'www.acme.com',
      },
    })
    expect(res.statusCode).toBe(204)
    expect(res.headers['x-bypass-reason']).toBeDefined()
    await app.close()
  })

  it('static asset URL → 204 with x-prerender-skip: static-asset', async () => {
    const store = new InMemoryTenantStore()
    await store.upsert(makeTenant())
    const app = await buildAppWith(store)
    const res = await app.inject({
      method: 'GET',
      url: '/assets/app.js',
      headers: { 'user-agent': BOT_UA, host: 'www.acme.com' },
    })
    expect(res.statusCode).toBe(204)
    expect(res.headers['x-prerender-skip']).toBe('static-asset')
    await app.close()
  })

  it('ignored route → 204 with x-prerender-route', async () => {
    const store = new InMemoryTenantStore()
    await store.upsert(
      makeTenant({
        routes: [{ pattern: '^/api/', ignore: true }],
      })
    )
    const app = await buildAppWith(store)
    const res = await app.inject({
      method: 'GET',
      url: '/api/x',
      headers: { 'user-agent': BOT_UA, host: 'www.acme.com' },
    })
    expect(res.statusCode).toBe(204)
    expect(res.headers['x-prerender-route']).toBe('^/api/')
    await app.close()
  })
})

// ─── /api/cache/invalidate ──────────────────────────────────────────────

describe('POST /api/cache/invalidate', () => {
  it('200 on valid apiKey + url', async () => {
    const store = new InMemoryTenantStore()
    const t = makeTenant({ apiKey: 'tk_inv_eeeeeeeeeeeeeeeeeeee' })
    await store.upsert(t)
    const app = await buildAppWith(store)
    const res = await app.inject({
      method: 'POST',
      url: '/api/cache/invalidate',
      headers: { 'x-api-key': t.apiKey, 'content-type': 'application/json' },
      payload: { url: 'https://www.acme.com/foo' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(typeof res.json().key).toBe('string')
    await app.close()
  })

  it('400 when url is missing', async () => {
    const store = new InMemoryTenantStore()
    const t = makeTenant({ apiKey: 'tk_inv_ffffffffffffffffffff' })
    await store.upsert(t)
    const app = await buildAppWith(store)
    const res = await app.inject({
      method: 'POST',
      url: '/api/cache/invalidate',
      headers: { 'x-api-key': t.apiKey, 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/url/)
    await app.close()
  })

  it('401 with invalid api key', async () => {
    const store = new InMemoryTenantStore()
    await store.upsert(makeTenant())
    const app = await buildAppWith(store)
    const res = await app.inject({
      method: 'POST',
      url: '/api/cache/invalidate',
      headers: { 'x-api-key': 'wrong', 'content-type': 'application/json' },
      payload: { url: 'https://www.acme.com/foo' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('401 when tenant is disabled even if api key matches', async () => {
    const store = new InMemoryTenantStore()
    const t = makeTenant({ apiKey: 'tk_inv_gggggggggggggggggggg', enabled: false })
    await store.upsert(t)
    const app = await buildAppWith(store)
    const res = await app.inject({
      method: 'POST',
      url: '/api/cache/invalidate',
      headers: { 'x-api-key': t.apiKey, 'content-type': 'application/json' },
      payload: { url: 'https://www.acme.com/foo' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

// ─── /admin/api/multi-tenant/cache/clear ────────────────────────────────

describe('POST /admin/api/multi-tenant/cache/clear', () => {
  it('requires admin token (401 without, 200 with)', async () => {
    const store = new InMemoryTenantStore()
    const app = await buildAppWith(store)
    const noAuth = await app.inject({
      method: 'POST',
      url: '/admin/api/multi-tenant/cache/clear',
    })
    expect(noAuth.statusCode).toBe(401)

    const ok = await app.inject({
      method: 'POST',
      url: '/admin/api/multi-tenant/cache/clear',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().ok).toBe(true)
    expect(typeof ok.json().cleared).toBe('number')
    await app.close()
  })
})
