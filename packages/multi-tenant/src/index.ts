/**
 * @spa-seo-gateway/multi-tenant — option B (SaaS layer) scaffold
 *
 * 한 인스턴스가 여러 테넌트를 서비스하기 위한 골격. 현재 단계는 타입과
 * tenant resolver 만 제공하고, 실제 인증·빌링·DB 연동은 후속 마일스톤에서
 * 구현한다. core 의 단일 origin 가정을 깨지 않도록, resolveTenant() 가
 * Fastify request 에서 tenant 를 식별해 request 에 부착하는 방식으로 설계.
 */
import type { RouteOverride } from '@spa-seo-gateway/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

export const TenantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  origin: z.string().url(),
  apiKey: z.string().min(20),
  routes: z
    .array(
      z.object({
        pattern: z.string(),
        ttlMs: z.coerce.number().int().positive().optional(),
        waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional(),
        waitSelector: z.string().optional(),
        waitMs: z.coerce.number().int().nonnegative().optional(),
        ignore: z.coerce.boolean().optional(),
      }),
    )
    .default([]),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  createdAt: z.coerce.date().optional(),
});

export type Tenant = z.infer<typeof TenantSchema>;

export type TenantStore = {
  byId(id: string): Promise<Tenant | null>;
  byApiKey(key: string): Promise<Tenant | null>;
  byHost(host: string): Promise<Tenant | null>;
  list(): Promise<Tenant[]>;
  upsert(t: Tenant): Promise<Tenant>;
  remove(id: string): Promise<boolean>;
};

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: Tenant;
  }
}

export type TenantResolverOptions = {
  store: TenantStore;
  strategy?: 'host' | 'subdomain' | 'apiKey' | 'pathPrefix';
  required?: boolean;
};

export async function registerMultiTenant(
  app: FastifyInstance,
  opts: TenantResolverOptions,
): Promise<void> {
  const strategy = opts.strategy ?? 'host';
  app.addHook('preValidation', async (req: FastifyRequest, reply) => {
    const tenant = await resolveTenant(req, opts.store, strategy);
    if (tenant) {
      req.tenant = tenant;
      return;
    }
    if (opts.required) {
      reply.code(401).send({ error: 'unknown tenant' });
    }
  });
}

async function resolveTenant(
  req: FastifyRequest,
  store: TenantStore,
  strategy: 'host' | 'subdomain' | 'apiKey' | 'pathPrefix',
): Promise<Tenant | null> {
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined;
  switch (strategy) {
    case 'host':
      if (!host) return null;
      return store.byHost(host);
    case 'subdomain': {
      if (!host) return null;
      const sub = host.split('.')[0];
      return sub ? store.byId(sub) : null;
    }
    case 'apiKey': {
      const key = req.headers['x-api-key'];
      if (typeof key !== 'string') return null;
      return store.byApiKey(key);
    }
    case 'pathPrefix': {
      const m = req.url.match(/^\/t\/([^/]+)/);
      return m?.[1] ? store.byId(m[1]) : null;
    }
    default:
      return null;
  }
}

/**
 * 가장 단순한 메모리 기반 TenantStore. 데모/테스트용.
 * 운영 환경은 Postgres/Drizzle 어댑터로 교체 권장.
 */
export class InMemoryTenantStore implements TenantStore {
  private byIdMap = new Map<string, Tenant>();
  private byKeyMap = new Map<string, Tenant>();
  private byHostMap = new Map<string, Tenant>();

  async list(): Promise<Tenant[]> {
    return Array.from(this.byIdMap.values());
  }
  async byId(id: string): Promise<Tenant | null> {
    return this.byIdMap.get(id) ?? null;
  }
  async byApiKey(key: string): Promise<Tenant | null> {
    return this.byKeyMap.get(key) ?? null;
  }
  async byHost(host: string): Promise<Tenant | null> {
    return this.byHostMap.get(host) ?? null;
  }
  async upsert(t: Tenant): Promise<Tenant> {
    this.byIdMap.set(t.id, t);
    this.byKeyMap.set(t.apiKey, t);
    try {
      this.byHostMap.set(new URL(t.origin).host, t);
    } catch {
      /* invalid origin URL — skip host index */
    }
    return t;
  }
  async remove(id: string): Promise<boolean> {
    const t = this.byIdMap.get(id);
    if (!t) return false;
    this.byIdMap.delete(id);
    this.byKeyMap.delete(t.apiKey);
    try {
      this.byHostMap.delete(new URL(t.origin).host);
    } catch {
      /* invalid origin URL — nothing to delete */
    }
    return true;
  }
}

export type RouteOverrideForTenant = RouteOverride & { tenantId: string };
