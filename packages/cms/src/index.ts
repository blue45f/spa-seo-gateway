/**
 * @spa-seo-gateway/cms — option C scaffold
 *
 * 다중 테넌트(B) 까지는 가지 않지만, 한 조직 내에서 여러 사이트를 관리하기 위한
 * "CMS 형 운영툴" 의 골격. Site 모델을 정의하고, admin-ui 위에 사이트 CRUD UI 와
 * 사이트별 라우트 편집기를 얹을 예정.
 */
import type { RouteOverride } from '@spa-seo-gateway/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export const SiteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  origin: z.string().url(),
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
  webhooks: z
    .object({
      onRender: z.string().url().optional(),
      onError: z.string().url().optional(),
    })
    .optional(),
  enabled: z.coerce.boolean().default(true),
});

export type Site = z.infer<typeof SiteSchema>;

export type SiteStore = {
  list(): Promise<Site[]>;
  byId(id: string): Promise<Site | null>;
  byHost(host: string): Promise<Site | null>;
  upsert(s: Site): Promise<Site>;
  remove(id: string): Promise<boolean>;
};

export class InMemorySiteStore implements SiteStore {
  private sites = new Map<string, Site>();

  async list(): Promise<Site[]> {
    return Array.from(this.sites.values());
  }
  async byId(id: string): Promise<Site | null> {
    return this.sites.get(id) ?? null;
  }
  async byHost(host: string): Promise<Site | null> {
    for (const s of this.sites.values()) {
      try {
        if (new URL(s.origin).host === host) return s;
      } catch {
        /* skip */
      }
    }
    return null;
  }
  async upsert(s: Site): Promise<Site> {
    this.sites.set(s.id, s);
    return s;
  }
  async remove(id: string): Promise<boolean> {
    return this.sites.delete(id);
  }
}

export type CmsOptions = {
  store: SiteStore;
  prefix?: string;
};

/**
 * 골격만 제공. CRUD API + 사이트별 라우트/캐시 무효화 UI 통합 예정.
 * 본격 구현 시: 각 사이트의 origin/route 가 core 의 runtime-config 와 조합되어야 함.
 */
export async function registerCms(app: FastifyInstance, opts: CmsOptions): Promise<void> {
  const prefix = opts.prefix ?? '/cms/api';
  const store = opts.store;

  app.get(`${prefix}/sites`, async () => ({ ok: true, sites: await store.list() }));
  app.post<{ Body: Site }>(`${prefix}/sites`, async (req, reply) => {
    const parsed = SiteSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: parsed.error.format() });
      return;
    }
    return { ok: true, site: await store.upsert(parsed.data) };
  });
  app.delete<{ Params: { id: string } }>(`${prefix}/sites/:id`, async (req, reply) => {
    const ok = await store.remove(req.params.id);
    if (!ok) reply.code(404).send({ ok: false });
    return { ok: true };
  });
}

export type SiteWithRoutes = Site & { routes: RouteOverride[] };
