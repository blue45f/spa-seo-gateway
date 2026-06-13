/**
 * admin-ui Fastify 플러그인의 인증 보호 엔드포인트 동작 검증.
 *
 * admin-ui-spa.test.ts 는 정적 SPA 호스팅 + public info 만 커버 →
 * 본 파일은 login/logout/whoami + guard 보호 API (site/routes/audit/cache/warm/
 * render-test/visual-diff/ai-schema/lighthouse) 의 happy path + 실패 경로를 채운다.
 *
 * guard 는 `config.adminToken` (모듈 싱글톤) 을 매 요청마다 조회 →
 * 테스트에서는 beforeAll/afterAll 로 토큰을 주입/복원해 보호 경로를 통과시킨다.
 *
 * 외부 의존성(puppeteer, lighthouse, network)은 시작되지 않은 상태이므로
 * 렌더 계열은 502/503 으로 떨어지는 것을 그대로 검증한다.
 */

import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui'
import { config, setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const ADMIN_TOKEN = 'test-admin-token'

let app: FastifyInstance
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
  app = Fastify({ logger: false })
  await registerAdminUI(app)
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

function authHeader(): { 'x-admin-token': string } {
  return { 'x-admin-token': ADMIN_TOKEN }
}

describe('admin-ui auth — whoami / login / logout', () => {
  it('whoami: adminEnabled true + unauthenticated when no creds', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/whoami' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.adminEnabled).toBe(true)
    expect(body.authenticated).toBe(false)
  })

  it('whoami: authenticated true with valid X-Admin-Token header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/whoami',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().authenticated).toBe(true)
  })

  it('login: rejects invalid token with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/login',
      headers: { 'content-type': 'application/json' },
      payload: { token: 'wrong-token' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ ok: false, error: 'invalid token' })
  })

  it('login: success returns ok=true + sets seo-admin cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/login',
      headers: { 'content-type': 'application/json' },
      payload: { token: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    const setCookie = res.headers['set-cookie']
    expect(setCookie).toBeDefined()
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie as string)
    expect(cookieStr).toMatch(/seo-admin=test-admin-token/)
    expect(cookieStr).toMatch(/HttpOnly/)
    expect(cookieStr).toMatch(/SameSite=Strict/)
  })

  it('login: cookie from login authorizes subsequent protected requests', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/admin/api/login',
      headers: { 'content-type': 'application/json' },
      payload: { token: ADMIN_TOKEN },
    })
    const setCookie = login.headers['set-cookie']
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string)
    const seoCookie = cookieStr.split(';')[0] // "seo-admin=test-admin-token"

    const who = await app.inject({
      method: 'GET',
      url: '/admin/api/whoami',
      headers: { cookie: seoCookie },
    })
    expect(who.statusCode).toBe(200)
    expect(who.json().authenticated).toBe(true)
  })

  it('logout: clears the cookie with Max-Age=0', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/api/logout' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    const setCookie = res.headers['set-cookie']
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie as string)
    expect(cookieStr).toMatch(/seo-admin=;/)
    expect(cookieStr).toMatch(/Max-Age=0/)
  })
})

describe('admin-ui guard — protected endpoints reject unauth', () => {
  it('GET /admin/api/site requires auth (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/site' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toMatch(/unauthorized/i)
  })

  it('GET /admin/api/routes requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/routes' })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /admin/api/routes requires auth', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/api/routes',
      headers: { 'content-type': 'application/json' },
      payload: { routes: [] },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('admin-ui — site / routes / audit', () => {
  it('GET /admin/api/site returns site summary + breakers + cache', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/site',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.site).toBeDefined()
    expect(body.breakers).toBeDefined()
    expect(body.cache).toBeDefined()
  })

  it('GET /admin/api/routes returns array (initially possibly empty)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/routes',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.routes)).toBe(true)
  })

  it('PUT /admin/api/routes updates routes + records audit', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/api/routes',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: { routes: [{ pattern: '^/admin-ui-api-test/', ttlMs: 60_000 }] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.routes.some((r: { pattern: string }) => r.pattern === '^/admin-ui-api-test/')).toBe(
      true
    )
    expect(body.persisted).toBeNull()

    // 감사 로그에 routes.update 가 기록되었는지 확인
    const audit = await app.inject({
      method: 'GET',
      url: '/admin/api/audit',
      headers: authHeader(),
    })
    expect(audit.statusCode).toBe(200)
    const events = audit.json().events as Array<{ action: string; outcome: string }>
    expect(events.some((e) => e.action === 'routes.update' && e.outcome === 'ok')).toBe(true)
  })

  it('GET /admin/api/audit returns recent events array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/audit',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().events)).toBe(true)
  })

  it('GET /admin/api/audit/verify returns verified status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/audit/verify',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.verified).toBe('boolean')
  })
})

describe('admin-ui — cache invalidation', () => {
  it('POST /admin/api/cache/invalidate requires url (400 when missing)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/cache/invalidate',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/url required/)
  })

  it('POST /admin/api/cache/invalidate accepts a url and returns key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/cache/invalidate',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/blog/x' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.key).toBe('string')
  })

  it('POST /admin/api/cache/clear returns cleared count', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/cache/clear',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.cleared).toBe('number')
  })
})

describe('admin-ui — warm', () => {
  it('POST /admin/api/warm requires sitemap (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/warm',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/sitemap/)
  })

  it('POST /admin/api/warm with unreachable sitemap returns ok=true + errors>0', async () => {
    // warmFromSitemap 는 sitemap fetch 실패를 잡아 errors=1 으로 반환 → 200 + report.
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/warm',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: { sitemap: 'http://127.0.0.1:1/does-not-exist.xml', max: 1, concurrency: 1 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.report).toBeDefined()
    expect(body.report.errors).toBeGreaterThanOrEqual(1)
  })
})

describe('admin-ui — render / visual / ai / lighthouse', () => {
  it('POST /admin/api/render-test 400 when url missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/render-test',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/url required/)
  })

  it('POST /admin/api/render-test 502 when render fails (pool not running)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/render-test',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/' },
    })
    expect(res.statusCode).toBe(502)
    const body = res.json()
    expect(body.ok).toBe(false)
    expect(typeof body.error).toBe('string')
  })

  it('POST /admin/api/visual-diff 400 when url missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/visual-diff',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /admin/api/visual-diff 503 when browser pool not started', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/visual-diff',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/' },
    })
    expect(res.statusCode).toBe(503)
    expect(res.json().ok).toBe(false)
  })

  it('POST /admin/api/ai/schema 501 when no adapter set', async () => {
    setAiSchemaAdapter(null)
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/ai/schema',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/' },
    })
    expect(res.statusCode).toBe(501)
    expect(res.json().error).toMatch(/adapter not configured/)
  })

  it('POST /admin/api/ai/schema 400 when adapter set but url missing', async () => {
    // 어댑터 등록 후 url 누락 → 400 경로 검증.
    setAiSchemaAdapter({
      suggestSchema: async () => [{ type: 'Article', jsonLd: {}, confidence: 0.5 }],
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/api/ai/schema',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/url required/)
    } finally {
      setAiSchemaAdapter(null)
    }
  })

  it('POST /admin/api/ai/schema invokes adapter when html is provided (no render needed)', async () => {
    setAiSchemaAdapter({
      suggestSchema: async (_html, _url) => [
        { type: 'Article', jsonLd: { '@type': 'Article' }, confidence: 0.8 },
      ],
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/api/ai/schema',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { url: 'https://www.example.com/x', html: '<html></html>' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.ok).toBe(true)
      expect(body.suggestions.length).toBe(1)
      expect(body.suggestions[0].type).toBe('Article')
    } finally {
      setAiSchemaAdapter(null)
    }
  })

  it('POST /admin/api/lighthouse 400 when url missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/lighthouse',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /admin/api/lighthouse 503 when lighthouse/chrome not available', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/lighthouse',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: { url: 'https://www.example.com/' },
    })
    // lighthouse 미설치 또는 chrome 미사용 환경 → 503.
    expect(res.statusCode).toBe(503)
    expect(res.json().ok).toBe(false)
  })
})
