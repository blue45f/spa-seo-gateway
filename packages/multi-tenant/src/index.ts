/**
 * @heejun/spa-seo-gateway-multi-tenant — option B (SaaS layer)
 *
 * 한 인스턴스가 여러 테넌트(고객 사이트)를 동시에 서비스. 각 테넌트는
 * 자기 origin / routes / API key 를 가진다. 디스크 영구 저장 (JSON file).
 *
 * 운영 흐름:
 *   1. 마스터 admin token 으로 /admin/api/tenants CRUD
 *   2. 각 테넌트는 자기 apiKey 또는 host 로 인입
 *   3. 게이트웨이가 테넌트 컨텍스트 (origin, routes, cache namespace) 로 렌더
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  type CacheEntry,
  cacheClear,
  cacheDel,
  cacheKey,
  cacheStats,
  cacheSwr,
  config,
  detectBot,
  httpRequests,
  isHostAllowed,
  isSafeTarget,
  isStaticAssetUrl,
  logger,
  type RouteOverride,
  render,
} from '@heejun/spa-seo-gateway-core'
import { z } from 'zod'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional()
)

export const TenantMemberEmailSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.email()
)

export const TenantMemberSchema = z.object({
  email: TenantMemberEmailSchema,
  role: z.enum(['owner', 'admin', 'editor', 'viewer']),
  status: z.enum(['active', 'invited', 'suspended']).default('active'),
  name: optionalTrimmedString,
  createdAt: z.coerce.number().int().optional(),
  updatedAt: z.coerce.number().int().optional(),
})

export type TenantMember = z.infer<typeof TenantMemberSchema>

export const TenantSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9_-]+$/, 'lowercase alphanumeric/-/_'),
    name: z.string().min(1),
    origin: z.string().url(),
    apiKey: z.string().min(20),
    routes: z
      .array(
        z.object({
          pattern: z.string(),
          ttlMs: z.coerce.number().int().positive().optional(),
          waitUntil: z
            .enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
            .optional(),
          waitSelector: z.string().optional(),
          waitMs: z.coerce.number().int().nonnegative().optional(),
          ignore: z.coerce.boolean().optional(),
        })
      )
      .default([]),
    members: z.array(TenantMemberSchema).default([]),
    plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
    enabled: z.coerce.boolean().default(true),
    createdAt: z.coerce.number().int().optional(),
  })
  .superRefine((tenant, ctx) => {
    const seen = new Set<string>()
    tenant.members.forEach((member, index) => {
      if (seen.has(member.email)) {
        ctx.addIssue({
          code: 'custom',
          message: 'duplicate member email',
          path: ['members', index, 'email'],
        })
        return
      }
      seen.add(member.email)
    })
  })

type ParsedTenant = z.infer<typeof TenantSchema>
export type Tenant = Omit<ParsedTenant, 'members'> & { members?: TenantMember[] }

export type TenantStore = {
  list(): Promise<Tenant[]>
  byId(id: string): Promise<Tenant | null>
  byApiKey(key: string): Promise<Tenant | null>
  byHost(host: string): Promise<Tenant | null>
  upsert(t: Tenant): Promise<Tenant>
  remove(id: string): Promise<boolean>
}

export class InMemoryTenantStore implements TenantStore {
  private items = new Map<string, Tenant>()

  async list() {
    return Array.from(this.items.values())
  }
  async byId(id: string) {
    return this.items.get(id) ?? null
  }
  async byApiKey(key: string) {
    for (const t of this.items.values()) if (t.apiKey === key) return t
    return null
  }
  async byHost(host: string) {
    for (const t of this.items.values()) {
      try {
        if (new URL(t.origin).host === host) return t
      } catch {
        /* skip */
      }
    }
    return null
  }
  async upsert(t: Tenant) {
    this.items.set(t.id, t)
    return t
  }
  async remove(id: string) {
    return this.items.delete(id)
  }
}

export class FileTenantStore implements TenantStore {
  constructor(private path: string) {}

  private async readAll(): Promise<Tenant[]> {
    try {
      const raw = await readFile(this.path, 'utf8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const tenants: Tenant[] = []
      for (const item of parsed) {
        const result = TenantSchema.safeParse(item)
        if (result.success) tenants.push(result.data)
      }
      return tenants
    } catch {
      return []
    }
  }

  private async writeAll(items: Tenant[]) {
    await mkdir(dirname(this.path), { recursive: true })
    const tmp = `${this.path}.tmp`
    await writeFile(tmp, `${JSON.stringify(items, null, 2)}\n`, 'utf8')
    await rename(tmp, this.path)
  }

  async list() {
    return this.readAll()
  }
  async byId(id: string) {
    return (await this.readAll()).find((t) => t.id === id) ?? null
  }
  async byApiKey(key: string) {
    return (await this.readAll()).find((t) => t.apiKey === key) ?? null
  }
  async byHost(host: string) {
    return (
      (await this.readAll()).find((t) => {
        try {
          return new URL(t.origin).host === host
        } catch {
          return false
        }
      }) ?? null
    )
  }
  async upsert(t: Tenant) {
    const parsed = TenantSchema.parse(t)
    const all = await this.readAll()
    const idx = all.findIndex((x) => x.id === parsed.id)
    const next =
      idx >= 0
        ? { ...parsed, createdAt: parsed.createdAt ?? all[idx]?.createdAt }
        : { ...parsed, createdAt: parsed.createdAt ?? Date.now() }
    if (idx >= 0) all[idx] = next
    else all.push(next)
    await this.writeAll(all)
    return next
  }
  async remove(id: string) {
    const all = await this.readAll()
    const next = all.filter((t) => t.id !== id)
    if (next.length === all.length) return false
    await this.writeAll(next)
    return true
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: Tenant
  }
}

// Per-tenant rate limit (분당) — plan 별 한도
const PLAN_LIMITS: Record<Tenant['plan'], number> = {
  free: 100,
  pro: 1000,
  enterprise: Number.POSITIVE_INFINITY,
}
const _rateCounters = new Map<string, { count: number; resetAt: number }>()
const _rateWindowMs = 60_000

function _checkTenantRateLimit(tenant: Tenant): { ok: boolean; retryAfter: number; limit: number } {
  const limit = PLAN_LIMITS[tenant.plan]
  if (!Number.isFinite(limit)) return { ok: true, retryAfter: 0, limit }
  const now = Date.now()
  let entry = _rateCounters.get(tenant.id)
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + _rateWindowMs }
    _rateCounters.set(tenant.id, entry)
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000), limit }
  }
  entry.count++
  return { ok: true, retryAfter: 0, limit }
}

function compiledRoutes(t: Tenant): Array<RouteOverride & { regex: RegExp }> {
  return t.routes.map((r) => ({ ...r, regex: new RegExp(r.pattern) }))
}

function matchTenantRoute(t: Tenant, targetUrl: string): RouteOverride | null {
  let path: string
  try {
    const u = new URL(targetUrl)
    path = u.pathname + u.search
  } catch {
    return null
  }
  for (const r of compiledRoutes(t)) {
    if (r.regex.test(path)) {
      const { regex: _r, ...rest } = r
      return rest
    }
  }
  return null
}

function objectBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {}
}

function normalizeTenantMembers(members: Tenant['members']): TenantMember[] {
  const parsed = z.array(TenantMemberSchema).safeParse(members ?? [])
  return parsed.success ? parsed.data : []
}

function withNormalizedMembers(tenant: Tenant): Tenant {
  return { ...tenant, members: normalizeTenantMembers(tenant.members) }
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseMemberEmail(value: unknown): string | null {
  const parsed = TenantMemberEmailSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function memberOwnerError(before: TenantMember[], after: TenantMember[]): string | null {
  if (before.length === 0 && after.length > 0 && !after.some((member) => member.role === 'owner')) {
    return 'first member must be an owner'
  }

  const beforeOwners = before.filter((member) => member.role === 'owner').length
  const afterOwners = after.filter((member) => member.role === 'owner').length
  if (beforeOwners > 0 && afterOwners === 0) {
    return 'at least one owner is required'
  }

  const beforeActiveOwners = before.filter(
    (member) => member.role === 'owner' && member.status === 'active'
  ).length
  const afterActiveOwners = after.filter(
    (member) => member.role === 'owner' && member.status === 'active'
  ).length
  if (beforeActiveOwners > 0 && afterActiveOwners === 0) {
    return 'at least one active owner is required'
  }

  return null
}

function seedOwnerMember(tenant: Tenant, ownerEmail: string): Tenant {
  if ((tenant.members?.length ?? 0) > 0) return tenant
  const now = Date.now()
  return {
    ...tenant,
    members: [
      {
        email: ownerEmail,
        role: 'owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

export type RegisterOptions = {
  store: TenantStore
  /**
   * 게이트웨이 마스터 admin 토큰 (테넌트 CRUD 보호). 미설정 시 admin API disabled.
   */
  adminToken?: string
  /**
   * 인입 요청에서 테넌트 식별 전략 (복수 시도 가능). 기본 ['host', 'apiKey'].
   */
  resolve?: Array<'host' | 'apiKey' | 'subdomain' | 'pathPrefix'>
}

export async function registerMultiTenant(
  app: FastifyInstance,
  opts: RegisterOptions
): Promise<void> {
  const { store } = opts
  const adminToken = opts.adminToken ?? config.adminToken
  const strategies = opts.resolve ?? ['host', 'apiKey']

  const guardAdmin = (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (!adminToken) {
      reply.code(404).send({ error: 'admin disabled' })
      return false
    }
    // 헤더 토큰 (legacy) 또는 admin-ui 가 발급한 `seo-admin` httpOnly 쿠키 둘 다 허용.
    const headerToken = req.headers['x-admin-token']
    if (headerToken === adminToken) return true
    const cookieToken = readCookie(req, 'seo-admin')
    if (cookieToken === adminToken) return true
    reply.code(401).send({ error: 'unauthorized' })
    return false
  }

  function readCookie(req: FastifyRequest, name: string): string | undefined {
    const c = req.headers.cookie
    if (!c) return undefined
    for (const part of c.split(';')) {
      const idx = part.indexOf('=')
      if (idx < 0) continue
      if (part.slice(0, idx).trim() === name) {
        return decodeURIComponent(part.slice(idx + 1).trim())
      }
    }
    return undefined
  }

  // ── tenant CRUD ─────────────────────────────────────────────────────
  app.get('/admin/api/tenants', async (req, reply) => {
    if (!guardAdmin(req, reply)) return
    const tenants = (await store.list()).map(withNormalizedMembers)
    return { ok: true, tenants }
  })

  app.post<{ Body: unknown }>('/admin/api/tenants', async (req, reply) => {
    if (!guardAdmin(req, reply)) return
    const body = objectBody(req.body)
    const hasMembers = Object.hasOwn(body, 'members')
    const ownerEmail = body.ownerEmail === undefined ? undefined : parseMemberEmail(body.ownerEmail)
    if (body.ownerEmail !== undefined && !ownerEmail) {
      reply.code(400).send({ ok: false, error: 'ownerEmail must be a valid email' })
      return
    }

    const parsed = TenantSchema.safeParse(req.body)
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: z.treeifyError(parsed.error) })
      return
    }
    const existing = await store.byId(parsed.data.id)
    const beforeMembers = normalizeTenantMembers(existing?.members)
    let nextTenant: Tenant = parsed.data

    if (!hasMembers && existing) {
      nextTenant = { ...nextTenant, members: beforeMembers }
    }
    if (ownerEmail) {
      nextTenant = seedOwnerMember(nextTenant, ownerEmail)
    }

    const afterMembers = normalizeTenantMembers(nextTenant.members)
    const ownerError = memberOwnerError(beforeMembers, afterMembers)
    if (ownerError) {
      reply.code(409).send({ ok: false, error: ownerError })
      return
    }

    return { ok: true, tenant: await store.upsert({ ...nextTenant, members: afterMembers }) }
  })

  app.delete<{ Params: { id: string } }>('/admin/api/tenants/:id', async (req, reply) => {
    if (!guardAdmin(req, reply)) return
    const ok = await store.remove(req.params.id)
    if (!ok) reply.code(404)
    return { ok }
  })

  // ── tenant members ─────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/admin/api/tenants/:id/members', async (req, reply) => {
    if (!guardAdmin(req, reply)) return
    const tenant = await store.byId(req.params.id)
    if (!tenant) {
      reply.code(404).send({ ok: false, error: 'tenant not found' })
      return
    }
    return { ok: true, members: normalizeTenantMembers(tenant.members) }
  })

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/admin/api/tenants/:id/members',
    async (req, reply) => {
      if (!guardAdmin(req, reply)) return
      const parsed = TenantMemberSchema.safeParse(req.body)
      if (!parsed.success) {
        reply.code(400).send({ ok: false, error: z.treeifyError(parsed.error) })
        return
      }

      const tenant = await store.byId(req.params.id)
      if (!tenant) {
        reply.code(404).send({ ok: false, error: 'tenant not found' })
        return
      }

      const beforeMembers = normalizeTenantMembers(tenant.members)
      const idx = beforeMembers.findIndex((member) => member.email === parsed.data.email)
      const now = Date.now()
      const nextMember: TenantMember =
        idx >= 0
          ? {
              ...beforeMembers[idx],
              ...parsed.data,
              createdAt: beforeMembers[idx]?.createdAt ?? parsed.data.createdAt ?? now,
              updatedAt: now,
            }
          : {
              ...parsed.data,
              createdAt: parsed.data.createdAt ?? now,
              updatedAt: parsed.data.updatedAt ?? now,
            }
      const afterMembers =
        idx >= 0
          ? beforeMembers.map((member, index) => (index === idx ? nextMember : member))
          : [...beforeMembers, nextMember]
      const ownerError = memberOwnerError(beforeMembers, afterMembers)
      if (ownerError) {
        reply.code(409).send({ ok: false, error: ownerError })
        return
      }

      const saved = await store.upsert({ ...tenant, members: afterMembers })
      return { ok: true, member: nextMember, tenant: withNormalizedMembers(saved) }
    }
  )

  app.delete<{ Params: { id: string; email: string } }>(
    '/admin/api/tenants/:id/members/:email',
    async (req, reply) => {
      if (!guardAdmin(req, reply)) return
      const email = parseMemberEmail(decodeParam(req.params.email))
      if (!email) {
        reply.code(400).send({ ok: false, error: 'email must be valid' })
        return
      }

      const tenant = await store.byId(req.params.id)
      if (!tenant) {
        reply.code(404).send({ ok: false, error: 'tenant not found' })
        return
      }

      const beforeMembers = normalizeTenantMembers(tenant.members)
      const afterMembers = beforeMembers.filter((member) => member.email !== email)
      if (afterMembers.length === beforeMembers.length) {
        reply.code(404).send({ ok: false, error: 'member not found' })
        return
      }

      const ownerError = memberOwnerError(beforeMembers, afterMembers)
      if (ownerError) {
        reply.code(409).send({ ok: false, error: ownerError })
        return
      }

      const saved = await store.upsert({ ...tenant, members: afterMembers })
      return { ok: true, tenant: withNormalizedMembers(saved) }
    }
  )

  // ── tenant resolver hook ────────────────────────────────────────────
  app.addHook('preHandler', async (req: FastifyRequest, _reply) => {
    if (
      req.url.startsWith('/admin') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/metrics')
    ) {
      return
    }
    let tenant: Tenant | null = null
    for (const s of strategies) {
      if (tenant) break
      if (s === 'host') {
        const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined
        if (host) tenant = await store.byHost(host)
      } else if (s === 'apiKey') {
        const key = req.headers['x-api-key']
        if (typeof key === 'string') tenant = await store.byApiKey(key)
      } else if (s === 'subdomain') {
        const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined
        const sub = host?.split('.')[0]
        if (sub) tenant = await store.byId(sub)
      } else if (s === 'pathPrefix') {
        const m = req.url.match(/^\/t\/([^/]+)/)
        if (m?.[1]) tenant = await store.byId(m[1])
      }
    }
    if (tenant?.enabled) req.tenant = tenant
  })

  // ── render route (per-tenant) ───────────────────────────────────────
  app.route({
    method: ['GET', 'HEAD'],
    url: '/*',
    handler: async (req, reply) => {
      if (
        req.url.startsWith('/admin') ||
        req.url.startsWith('/health') ||
        req.url.startsWith('/metrics')
      ) {
        return reply.callNotFound()
      }
      const tenant = req.tenant
      if (!tenant) {
        reply.code(404).send({ error: 'unknown tenant — set Host/X-API-Key' })
        return reply
      }
      const rl = _checkTenantRateLimit(tenant)
      if (!rl.ok) {
        reply
          .code(429)
          .header('retry-after', String(rl.retryAfter))
          .header('x-ratelimit-limit', String(rl.limit))
          .send({ error: 'rate limit exceeded', retryAfter: rl.retryAfter, plan: tenant.plan })
        return reply
      }

      const detection = detectBot(
        req.headers['user-agent'],
        req.headers as Record<string, string | string[] | undefined>,
        req.query as Record<string, unknown>
      )
      if (!detection.isBot) {
        httpRequests.inc({ route: 'tenant-pass', status: 'pass', kind: 'human' })
        reply.code(204).header('x-bypass-reason', detection.reason).send()
        return reply
      }

      const target = new URL(req.url, tenant.origin).toString()
      if (!isHostAllowed(target)) {
        const tenantHost = (() => {
          try {
            return new URL(tenant.origin).host
          } catch {
            return ''
          }
        })()
        if (tenantHost && new URL(target).host !== tenantHost) {
          reply.code(403).send({ error: 'host outside tenant origin' })
          return reply
        }
      }
      if (config.renderer.skipStaticAssetUrls && isStaticAssetUrl(target)) {
        reply.code(204).header('x-prerender-skip', 'static-asset').send()
        return reply
      }
      const safe = await isSafeTarget(target)
      if (!safe.ok) {
        reply.code(403).send({ error: 'unsafe target', reason: safe.reason })
        return reply
      }

      const route = matchTenantRoute(tenant, target)
      if (route?.ignore) {
        reply.code(204).header('x-prerender-route', route.pattern).send()
        return reply
      }

      const lang = (req.headers['accept-language'] as string | undefined) ?? 'default'
      const key = cacheKey(target, lang.split(',')[0] ?? 'default', `tenant:${tenant.id}`)

      try {
        const result = await cacheSwr(
          key,
          () =>
            render({
              url: target,
              headers: req.headers as Record<string, string | string[] | undefined>,
              route,
            }) as Promise<CacheEntry>,
          route?.ttlMs
        )
        httpRequests.inc({
          route: 'tenant-render',
          status: String(result.entry.status),
          kind: result.fromCache ?? 'origin',
        })
        reply.code(result.entry.status)
        for (const [k, v] of Object.entries(result.entry.headers)) reply.header(k, v)
        reply
          .header('x-tenant-id', tenant.id)
          .header('x-cache', result.fromCache ? 'HIT' : 'MISS')
          .header('x-cache-stale', result.stale ? '1' : '0')
          .send(result.entry.body)
      } catch (err) {
        httpRequests.inc({ route: 'tenant-render', status: '500', kind: 'error' })
        logger.error(
          { err: (err as Error).message, target, tenant: tenant.id },
          'tenant render failed'
        )
        reply.code(502).send({ error: 'render failed', message: (err as Error).message })
      }
      return reply
    },
  })

  // ── per-tenant cache invalidation API (apiKey 인증) ─────────────────
  app.post<{ Body: { url?: string }; Headers: { 'x-api-key'?: string } }>(
    '/api/cache/invalidate',
    async (req, reply) => {
      const key = req.headers['x-api-key']
      if (typeof key !== 'string') {
        reply.code(401).send({ error: 'x-api-key required' })
        return
      }
      const tenant = await store.byApiKey(key)
      if (!tenant?.enabled) {
        reply.code(401).send({ error: 'invalid api key' })
        return
      }
      const url = req.body?.url
      if (!url) {
        reply.code(400).send({ error: 'url required' })
        return
      }
      const k = cacheKey(url, 'default', `tenant:${tenant.id}`)
      await cacheDel(k)
      return { ok: true, key: k }
    }
  )

  // ── stats ───────────────────────────────────────────────────────────
  app.get('/admin/api/multi-tenant/stats', async (req, reply) => {
    if (!guardAdmin(req, reply)) return
    const tenants = await store.list()
    return {
      ok: true,
      tenantCount: tenants.length,
      enabled: tenants.filter((t) => t.enabled).length,
      cache: cacheStats(),
    }
  })

  app.post('/admin/api/multi-tenant/cache/clear', async (req, reply) => {
    if (!guardAdmin(req, reply)) return
    return { ok: true, cleared: await cacheClear() }
  })

  logger.info({ strategies }, 'multi-tenant mode enabled')
}
