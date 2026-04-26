import { SiteSchema } from '@spa-seo-gateway/cms';
import { ConfigSchema } from '@spa-seo-gateway/core';
import { TenantSchema } from '@spa-seo-gateway/multi-tenant';
import { describe, expect, it } from 'vitest';

describe('TenantSchema', () => {
  const valid = {
    id: 'acme',
    name: 'ACME',
    origin: 'https://www.acme.com',
    apiKey: 'tk_live_abcdef0123456789abcd',
    routes: [],
    plan: 'pro' as const,
    enabled: true,
  };

  it('accepts a valid tenant', () => {
    expect(TenantSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects id with uppercase or special chars', () => {
    expect(TenantSchema.safeParse({ ...valid, id: 'AcMe' }).success).toBe(false);
    expect(TenantSchema.safeParse({ ...valid, id: 'acme!' }).success).toBe(false);
  });

  it('rejects short apiKey', () => {
    expect(TenantSchema.safeParse({ ...valid, apiKey: 'short' }).success).toBe(false);
  });

  it('rejects non-URL origin', () => {
    expect(TenantSchema.safeParse({ ...valid, origin: 'not a url' }).success).toBe(false);
  });

  it('coerces enabled from string', () => {
    const r = TenantSchema.safeParse({ ...valid, enabled: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enabled).toBe(true);
  });

  it('defaults plan to free when missing', () => {
    const { plan: _omit, ...rest } = valid;
    const r = TenantSchema.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.plan).toBe('free');
  });

  it('validates nested route override', () => {
    const r = TenantSchema.safeParse({
      ...valid,
      routes: [{ pattern: '^/p/', ttlMs: 60_000, waitUntil: 'networkidle2' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects route with bad waitUntil enum', () => {
    const r = TenantSchema.safeParse({
      ...valid,
      routes: [{ pattern: '^/x/', waitUntil: 'eventually' }],
    });
    expect(r.success).toBe(false);
  });
});

describe('SiteSchema', () => {
  const valid = {
    id: 'marketing',
    name: 'Marketing',
    origin: 'https://www.example.com',
    routes: [],
    enabled: true,
  };

  it('accepts a valid site', () => {
    expect(SiteSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects id with spaces', () => {
    expect(SiteSchema.safeParse({ ...valid, id: 'my site' }).success).toBe(false);
  });

  it('accepts optional webhooks block', () => {
    const r = SiteSchema.safeParse({
      ...valid,
      webhooks: { onRender: 'https://hook.example.com/render' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid webhook URL', () => {
    const r = SiteSchema.safeParse({
      ...valid,
      webhooks: { onRender: 'not a url' },
    });
    expect(r.success).toBe(false);
  });
});

describe('ConfigSchema', () => {
  it('applies defaults when nested objects are passed empty', () => {
    const r = ConfigSchema.safeParse({
      server: {},
      bot: {},
      renderer: { viewport: {}, mobileViewport: {} },
      cache: { memory: {}, redis: {} },
      rateLimit: {},
      log: {},
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mode).toBe('render-only');
      expect(r.data.renderer.poolMin).toBe(2);
      expect(r.data.renderer.poolMax).toBe(8);
      expect(r.data.cache.swrWindowMs).toBeGreaterThan(0);
    }
  });

  it('rejects invalid mode value', () => {
    const r = ConfigSchema.safeParse({ mode: 'banana' });
    expect(r.success).toBe(false);
  });

  it('accepts all valid mode values', () => {
    for (const m of ['render-only', 'proxy', 'cms', 'saas']) {
      const r = ConfigSchema.safeParse({
        mode: m,
        server: {},
        bot: {},
        renderer: { viewport: {}, mobileViewport: {} },
        cache: { memory: {}, redis: {} },
        rateLimit: {},
        log: {},
      });
      expect(r.success, `mode=${m} should parse`).toBe(true);
    }
  });
});
