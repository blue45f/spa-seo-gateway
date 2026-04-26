import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import 'dotenv/config';
import { z } from 'zod';

const csv = (s?: string) =>
  (s ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const ResourceType = z.enum([
  'image',
  'media',
  'font',
  'stylesheet',
  'script',
  'xhr',
  'fetch',
  'websocket',
  'other',
]);

const WaitUntil = z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']);

const RouteOverride = z.object({
  pattern: z.string().describe('URL pathname regex (e.g. "^/products/")'),
  ignore: z.coerce.boolean().optional(),
  ttlMs: z.coerce.number().int().positive().optional(),
  waitUntil: WaitUntil.optional(),
  waitSelector: z.string().optional(),
  waitMs: z.coerce.number().int().nonnegative().optional(),
  blockResourceTypes: z.array(ResourceType).optional(),
  viewport: z
    .object({
      width: z.coerce.number().int().positive(),
      height: z.coerce.number().int().positive(),
    })
    .optional(),
});

export type RouteOverride = z.infer<typeof RouteOverride>;

const Schema = z.object({
  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.coerce.number().int().positive().default(3000),
  }),
  mode: z.enum(['render-only', 'proxy', 'cms', 'saas']).default('render-only'),
  tenantStoreFile: z.string().default('.data/tenants.json'),
  siteStoreFile: z.string().default('.data/sites.json'),
  originUrl: z.string().url().optional(),
  bot: z.object({
    forceRenderHeader: z.string().default('x-force-render'),
    bypassQueryParam: z.string().default('_no_render'),
    detectMobile: z.coerce.boolean().default(true),
  }),
  renderer: z.object({
    poolMin: z.coerce.number().int().min(0).default(2),
    poolMax: z.coerce.number().int().min(1).default(8),
    pageTimeoutMs: z.coerce.number().int().positive().default(25_000),
    waitUntil: WaitUntil.default('networkidle2'),
    waitSelector: z.string().optional(),
    waitPrerenderReady: z.coerce.boolean().default(false),
    waitPrerenderReadyTimeoutMs: z.coerce.number().int().nonnegative().default(2_000),
    maxRequestsPerBrowser: z.coerce.number().int().positive().default(1_000),
    blockResourceTypes: z.array(ResourceType).default(['image', 'media', 'font']),
    blockUrlPatterns: z
      .array(z.string())
      .default([
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.com/tr',
        'doubleclick.net',
        'segment.io',
        'hotjar.com',
        'mixpanel.com',
        'fullstory.com',
        'amplitude.com',
        'connect.facebook.net',
      ]),
    qualityCheck: z.coerce.boolean().default(true),
    minTextLength: z.coerce.number().int().nonnegative().default(50),
    userAgentSuffix: z.string().default('spa-seo-gateway/1.0'),
    viewport: z.object({
      width: z.coerce.number().int().positive().default(1280),
      height: z.coerce.number().int().positive().default(800),
    }),
    mobileViewport: z.object({
      width: z.coerce.number().int().positive().default(390),
      height: z.coerce.number().int().positive().default(844),
    }),
    executablePath: z.string().optional(),
  }),
  cache: z.object({
    enabled: z.coerce.boolean().default(true),
    memory: z.object({
      enabled: z.coerce.boolean().default(true),
      maxItems: z.coerce.number().int().positive().default(500),
      maxBytes: z.coerce
        .number()
        .int()
        .positive()
        .default(100 * 1024 * 1024),
      ttlMs: z.coerce
        .number()
        .int()
        .positive()
        .default(24 * 60 * 60 * 1000),
    }),
    redis: z.object({
      enabled: z.coerce.boolean().default(false),
      url: z.string().optional(),
      ttlSec: z.coerce
        .number()
        .int()
        .positive()
        .default(7 * 24 * 60 * 60),
      keyPrefix: z.string().default('spa-seo:'),
    }),
    swrWindowMs: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(60 * 60 * 1000),
  }),
  rateLimit: z.object({
    enabled: z.coerce.boolean().default(true),
    max: z.coerce.number().int().positive().default(120),
    timeWindow: z.string().default('1 minute'),
  }),
  log: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    pretty: z.coerce.boolean().default(false),
  }),
  allowedHosts: z.array(z.string()).default([]),
  adminToken: z.string().optional(),
  routes: z.array(RouteOverride).default([]),
});

export const ConfigSchema = Schema;
export type Config = z.infer<typeof Schema>;

const env = process.env;

function fromEnv(): Record<string, unknown> {
  return {
    server: { host: env.HOST, port: env.PORT },
    mode: env.GATEWAY_MODE,
    originUrl: env.ORIGIN_URL,
    tenantStoreFile: env.TENANT_STORE_FILE,
    siteStoreFile: env.SITE_STORE_FILE,
    bot: {
      forceRenderHeader: env.FORCE_RENDER_HEADER,
      bypassQueryParam: env.BYPASS_QUERY_PARAM,
      detectMobile: env.DETECT_MOBILE,
    },
    renderer: {
      poolMin: env.POOL_MIN,
      poolMax: env.POOL_MAX,
      pageTimeoutMs: env.PAGE_TIMEOUT_MS,
      waitUntil: env.WAIT_UNTIL,
      waitSelector: env.WAIT_SELECTOR || undefined,
      waitPrerenderReady: env.WAIT_PRERENDER_READY,
      waitPrerenderReadyTimeoutMs: env.WAIT_PRERENDER_READY_TIMEOUT_MS,
      maxRequestsPerBrowser: env.MAX_REQUESTS_PER_BROWSER,
      blockResourceTypes: env.BLOCK_RESOURCE_TYPES ? csv(env.BLOCK_RESOURCE_TYPES) : undefined,
      blockUrlPatterns: env.BLOCK_URL_PATTERNS ? csv(env.BLOCK_URL_PATTERNS) : undefined,
      qualityCheck: env.QUALITY_CHECK,
      minTextLength: env.MIN_TEXT_LENGTH,
      userAgentSuffix: env.USER_AGENT_SUFFIX,
      viewport: { width: env.VIEWPORT_WIDTH, height: env.VIEWPORT_HEIGHT },
      mobileViewport: { width: env.MOBILE_VIEWPORT_WIDTH, height: env.MOBILE_VIEWPORT_HEIGHT },
      executablePath: env.PUPPETEER_EXECUTABLE_PATH,
    },
    cache: {
      enabled: env.CACHE_ENABLED,
      memory: {
        enabled: env.MEMORY_CACHE_ENABLED,
        maxItems: env.MEMORY_CACHE_MAX_ITEMS,
        maxBytes: env.MEMORY_CACHE_MAX_BYTES,
        ttlMs: env.MEMORY_CACHE_TTL_MS,
      },
      redis: {
        enabled: env.REDIS_CACHE_ENABLED,
        url: env.REDIS_URL,
        ttlSec: env.REDIS_CACHE_TTL_SEC,
        keyPrefix: env.REDIS_KEY_PREFIX,
      },
      swrWindowMs: env.SWR_WINDOW_MS,
    },
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED,
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
    },
    log: { level: env.LOG_LEVEL, pretty: env.LOG_PRETTY },
    allowedHosts: csv(env.ALLOWED_HOSTS),
    adminToken: env.ADMIN_TOKEN,
  };
}

function fromFile(): Record<string, unknown> {
  const explicit = env.GATEWAY_CONFIG_FILE;
  const candidates = explicit ? [explicit] : ['seo-gateway.config.json', '.seo-gateway.json'];
  for (const c of candidates) {
    const p = resolve(process.cwd(), c);
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      console.info(`config file loaded: ${p}`);
      return parsed;
    } catch (e) {
      console.error(`failed to read ${p}:`, (e as Error).message);
      process.exit(1);
    }
  }
  return {};
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue;
    const b = out[k];
    if (isPlainObject(v) && isPlainObject(b)) {
      out[k] = deepMerge(b, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const merged = deepMerge(fromFile(), fromEnv());
const parsed = Schema.safeParse(merged);

if (!parsed.success) {
  console.error('Invalid configuration:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const config: Config = parsed.data;

if (config.mode === 'proxy' && !config.originUrl) {
  console.error('GATEWAY_MODE=proxy requires ORIGIN_URL');
  process.exit(1);
}
