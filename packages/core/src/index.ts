export { type AuditEvent, getRecentAudit, recordAudit } from './audit.js';
export { type DetectionResult, detectBot } from './bot.js';
export {
  type CacheEntry,
  cacheClear,
  cacheDel,
  cacheGet,
  cacheSet,
  cacheStats,
  cacheSwr,
  type SwrResult,
  shutdownCache,
} from './cache.js';
export { breakerStats, isCircuitOpen, withBreaker } from './circuit-breaker.js';
export {
  type Config,
  ConfigSchema,
  config,
  type RouteOverride,
} from './config.js';
export { startHotReload, stopHotReload } from './hot-reload.js';
export {
  clearLighthouseCache,
  type LighthouseScores,
  runLighthouse,
} from './lighthouse.js';
export { type Logger, logger } from './logger.js';
export {
  browserPool as poolMetric,
  cacheEvents,
  httpRequests,
  inflight,
  registry,
  renderDuration,
  renderErrors,
} from './metrics.js';
export {
  applyRequestInterception,
  type InterceptionOptions,
  type OptimizeOptions,
  optimizeHtml,
} from './optimize.js';
export { browserPool } from './pool.js';
export { type WarmReport, warmFromSitemap } from './prerender-warmer.js';
export { assessQuality, type QualityVerdict, shortTtlForStatus } from './quality.js';
export { type RenderInput, render } from './renderer.js';
export {
  getRoutes,
  getSiteSummary,
  matchRoute,
  persistRoutesToFile,
  type SiteSummary,
  setRoutes,
} from './runtime-config.js';
export { getTracer, tracingEnabled, withSpan } from './telemetry.js';
export {
  buildTargetUrl,
  cacheKey,
  isHostAllowed,
  isSafeTarget,
  isStaticAssetUrl,
  normalize,
} from './url.js';
export { startWarmCron, stopWarmCron } from './warm-cron.js';
