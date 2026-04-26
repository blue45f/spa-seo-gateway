import { recordAudit } from './audit.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { warmFromSitemap } from './prerender-warmer.js';

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  if (!config.warmCron.sitemap) return;
  running = true;
  const t0 = Date.now();
  try {
    const report = await warmFromSitemap(config.warmCron.sitemap, {
      max: config.warmCron.max,
      concurrency: config.warmCron.concurrency,
    });
    logger.info({ report, elapsedMs: Date.now() - t0 }, 'warm-cron tick complete');
    recordAudit({
      actor: 'warm-cron',
      action: 'sitemap.warm',
      target: config.warmCron.sitemap,
      outcome: 'ok',
      meta: { found: report.found, warmed: report.warmed, errors: report.errors },
    });
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'warm-cron failed');
    recordAudit({
      actor: 'warm-cron',
      action: 'sitemap.warm',
      target: config.warmCron.sitemap,
      outcome: 'error',
      meta: { error: (e as Error).message },
    });
  } finally {
    running = false;
  }
}

export function startWarmCron(): void {
  if (!config.warmCron.enabled || !config.warmCron.sitemap) {
    logger.info('warm-cron disabled (WARM_CRON_ENABLED + WARM_CRON_SITEMAP 필요)');
    return;
  }
  logger.info(
    { sitemap: config.warmCron.sitemap, intervalMs: config.warmCron.intervalMs },
    'warm-cron started',
  );
  // 즉시 한 번
  setTimeout(tick, 5_000).unref();
  timer = setInterval(tick, config.warmCron.intervalMs);
  timer.unref();
}

export function stopWarmCron(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
