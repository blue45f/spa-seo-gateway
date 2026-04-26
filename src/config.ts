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

const Schema = z.object({
  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.coerce.number().int().positive().default(3000),
  }),
  mode: z.enum(['render-only', 'proxy']).default('render-only'),
  originUrl: z.string().url().optional(),
  bot: z.object({
    forceRenderHeader: z.string().default('x-force-render'),
    bypassQueryParam: z.string().default('_no_render'),
  }),
  renderer: z.object({
    poolMin: z.coerce.number().int().min(0).default(2),
    poolMax: z.coerce.number().int().min(1).default(8),
    pageTimeoutMs: z.coerce.number().int().positive().default(25_000),
    waitUntil: z
      .enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
      .default('networkidle2'),
    waitSelector: z.string().optional(),
    waitPrerenderReady: z.coerce.boolean().default(false),
    waitPrerenderReadyTimeoutMs: z.coerce.number().int().nonnegative().default(2_000),
    maxRequestsPerBrowser: z.coerce.number().int().positive().default(1_000),
    blockResourceTypes: z.array(ResourceType).default(['image', 'media', 'font']),
    blockUrlPatterns: z.array(z.string()).default([]),
    userAgentSuffix: z.string().default('spa-seo-gateway/1.0'),
    viewport: z.object({
      width: z.coerce.number().int().positive().default(1280),
      height: z.coerce.number().int().positive().default(800),
    }),
    executablePath: z.string().optional(),
  }),
  cache: z.object({
    enabled: z.coerce.boolean().default(true),
    memory: z.object({
      enabled: z.coerce.boolean().default(true),
      maxItems: z.coerce.number().int().positive().default(500),
      maxBytes: z.coerce.number().int().positive().default(100 * 1024 * 1024),
      ttlMs: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
    }),
    redis: z.object({
      enabled: z.coerce.boolean().default(false),
      url: z.string().optional(),
      ttlSec: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),
      keyPrefix: z.string().default('spa-seo:'),
    }),
    swrWindowMs: z.coerce.number().int().nonnegative().default(60 * 60 * 1000),
  }),
  rateLimit: z.object({
    enabled: z.coerce.boolean().default(true),
    max: z.coerce.number().int().positive().default(120),
    timeWindow: z.string().default('1 minute'),
  }),
  log: z.object({
    level: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    pretty: z.coerce.boolean().default(false),
  }),
  allowedHosts: z.array(z.string()).default([]),
  adminToken: z.string().optional(),
});

export type Config = z.infer<typeof Schema>;

const env = process.env;

const parsed = Schema.safeParse({
  server: {
    host: env.HOST,
    port: env.PORT,
  },
  mode: env.GATEWAY_MODE,
  originUrl: env.ORIGIN_URL,
  bot: {
    forceRenderHeader: env.FORCE_RENDER_HEADER,
    bypassQueryParam: env.BYPASS_QUERY_PARAM,
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
    blockResourceTypes: csv(env.BLOCK_RESOURCE_TYPES),
    blockUrlPatterns: csv(env.BLOCK_URL_PATTERNS),
    userAgentSuffix: env.USER_AGENT_SUFFIX,
    viewport: {
      width: env.VIEWPORT_WIDTH,
      height: env.VIEWPORT_HEIGHT,
    },
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
  log: {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
  },
  allowedHosts: csv(env.ALLOWED_HOSTS),
  adminToken: env.ADMIN_TOKEN,
});

if (!parsed.success) {
  console.error('Invalid configuration:', parsed.error.format());
  process.exit(1);
}

export const config: Config = parsed.data;

if (config.mode === 'proxy' && !config.originUrl) {
  console.error('GATEWAY_MODE=proxy requires ORIGIN_URL');
  process.exit(1);
}
