import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequests = new Counter({
  name: 'gateway_http_requests_total',
  help: 'Total HTTP requests handled',
  labelNames: ['route', 'status', 'kind'] as const,
  registers: [registry],
});

export const renderDuration = new Histogram({
  name: 'gateway_render_duration_ms',
  help: 'Render duration in milliseconds',
  labelNames: ['outcome'] as const,
  buckets: [50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 20_000, 30_000],
  registers: [registry],
});

export const cacheEvents = new Counter({
  name: 'gateway_cache_events_total',
  help: 'Cache hits/misses/stale events',
  labelNames: ['layer', 'event'] as const,
  registers: [registry],
});

export const browserPool = new Gauge({
  name: 'gateway_browser_pool',
  help: 'Browser pool size by state',
  labelNames: ['state'] as const,
  registers: [registry],
});

export const inflight = new Gauge({
  name: 'gateway_inflight_renders',
  help: 'Renders currently in flight',
  registers: [registry],
});

export const renderErrors = new Counter({
  name: 'gateway_render_errors_total',
  help: 'Render errors by reason',
  labelNames: ['reason'] as const,
  registers: [registry],
});
