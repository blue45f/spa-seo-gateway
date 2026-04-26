import type { CacheEntry } from './cache.js';
import { withBreaker } from './circuit-breaker.js';
import { config, type RouteOverride } from './config.js';
import { logger } from './logger.js';
import { inflight, renderDuration, renderErrors } from './metrics.js';
import { applyRequestInterception, optimizeHtml } from './optimize.js';
import { browserPool } from './pool.js';
import { assessQuality, shortTtlForStatus } from './quality.js';
import { withSpan } from './telemetry.js';
import { isSafeTarget } from './url.js';

const FORWARD_HEADERS = new Set(['accept-language', 'cookie', 'authorization']);
const TRANSIENT_REASONS = new Set(['crashed', 'pool-exhausted', 'network']);
const MAX_ATTEMPTS = 2;
const MOBILE_UA_RE = /Mobile|iPhone|iPad|Android.*Mobile|Googlebot.*Mobile|bingbot.*Mobile/i;

export type RenderInput = {
  url: string;
  headers: Record<string, string | string[] | undefined>;
  route?: RouteOverride | null;
};

export async function render(input: RenderInput): Promise<CacheEntry> {
  return withSpan('render', (_span) => renderInner(input), {
    'http.url': input.url,
    'gateway.route': input.route?.pattern ?? '',
  });
}

async function renderInner(input: RenderInput): Promise<CacheEntry> {
  inflight.inc();
  const started = Date.now();
  let lastError: unknown;
  try {
    const safe = await isSafeTarget(input.url);
    if (!safe.ok) {
      renderErrors.inc({ reason: 'ssrf' });
      throw new Error(`SSRF blocked: ${safe.reason}`);
    }
    const host = new URL(input.url).host;
    const guarded = withBreaker(host, async (i: RenderInput) => renderOnce(i, 1, started));

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return attempt === 1 ? await guarded(input) : await renderOnce(input, attempt, started);
      } catch (err) {
        lastError = err;
        const reason = classifyError(err);
        renderErrors.inc({ reason });
        if (attempt < MAX_ATTEMPTS && TRANSIENT_REASONS.has(reason)) {
          logger.warn(
            { err: (err as Error).message, attempt, reason, url: input.url },
            'render attempt failed, retrying',
          );
          continue;
        }
        renderDuration.observe({ outcome: 'error', host: hostOf(input.url) }, Date.now() - started);
        logger.error(
          { err: (err as Error).message, url: input.url, reason, attempts: attempt },
          'render failed',
        );
        throw err;
      }
    }
    throw lastError ?? new Error('render failed without error');
  } finally {
    inflight.dec();
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

async function renderOnce(
  input: RenderInput,
  attempt: number,
  started: number,
): Promise<CacheEntry> {
  const route = input.route ?? null;
  const ua = input.headers['user-agent'] as string | undefined;
  const isMobile = config.bot.detectMobile && typeof ua === 'string' && MOBILE_UA_RE.test(ua);

  const viewport =
    route?.viewport ?? (isMobile ? config.renderer.mobileViewport : config.renderer.viewport);
  const waitUntil = route?.waitUntil ?? config.renderer.waitUntil;
  const waitSelector = route?.waitSelector ?? config.renderer.waitSelector;
  const blockResourceTypes = route?.blockResourceTypes ?? config.renderer.blockResourceTypes;

  const entry = await browserPool.withPage(async (page) => {
    const fwd: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.headers)) {
      if (!v) continue;
      if (FORWARD_HEADERS.has(k.toLowerCase())) {
        fwd[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
      }
    }
    if (Object.keys(fwd).length > 0) await page.setExtraHTTPHeaders(fwd);

    const baseUa = await page.browser().userAgent();
    await page.setUserAgent(`${baseUa} ${config.renderer.userAgentSuffix}`);
    await page.setViewport(viewport);
    await page.setBypassCSP(true);

    await applyRequestInterception(page, { blockResourceTypes });

    const res = await page.goto(input.url, {
      timeout: config.renderer.pageTimeoutMs,
      waitUntil,
    });
    const status = res?.status() ?? 200;
    const respHeaders = res?.headers() ?? {};

    if (config.renderer.waitPrerenderReady) {
      await page
        .waitForFunction('window.prerenderReady === true', {
          timeout: config.renderer.waitPrerenderReadyTimeoutMs,
        })
        .catch(() => {
          /* not all SPAs use this; fall back to waitUntil */
        });
    }
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 5_000 }).catch(() => {
        /* selector may not appear; do not fail render */
      });
    }
    if (route?.waitMs && route.waitMs > 0) {
      await new Promise((r) => setTimeout(r, route.waitMs));
    }

    const html = await page.content();

    let effectiveStatus = status;
    let qualityReason: string | undefined;
    if (config.renderer.qualityCheck && status < 400) {
      const verdict = assessQuality(html, { minTextLength: config.renderer.minTextLength });
      if (!verdict.ok) {
        qualityReason = verdict.reason;
        if (verdict.reason === 'soft-404') effectiveStatus = 404;
        else if (verdict.reason === 'error-page') effectiveStatus = 503;
        logger.warn(
          { url: input.url, reason: verdict.reason, textLength: verdict.textLength },
          'render quality below threshold',
        );
      }
    }

    const optimized = optimizeHtml(html, {
      url: input.url,
      ensureBase: true,
      ensureCanonical: true,
      stripImages: config.renderer.stripImagesFromOutput,
      injectBreadcrumb: config.renderer.injectBreadcrumb,
      schemaTemplate: route?.schemaTemplate,
    });

    const headers: Record<string, string> = {
      'content-type': 'text/html; charset=utf-8',
      'x-prerendered': 'true',
      'x-prerender-status': String(effectiveStatus),
      'x-prerender-viewport': isMobile ? 'mobile' : 'desktop',
    };
    if (qualityReason) headers['x-prerender-quality'] = qualityReason;
    if (route) headers['x-prerender-route'] = route.pattern;
    const shortTtl = shortTtlForStatus(effectiveStatus);
    if (shortTtl != null) headers['x-prerender-short-ttl-ms'] = String(shortTtl);
    const canonical = respHeaders.link;
    if (canonical) headers.link = canonical;

    return { body: optimized, status: effectiveStatus, headers, createdAt: Date.now() };
  });
  renderDuration.observe({ outcome: 'ok', host: hostOf(input.url) }, Date.now() - started);
  if (attempt > 1) {
    logger.info({ attempt, url: input.url }, 'render succeeded after retry');
  }
  return entry;
}

function classifyError(err: unknown): string {
  const msg = (err as Error)?.message ?? '';
  if (msg.includes('SSRF')) return 'ssrf';
  if (msg.includes('Breaker is open')) return 'circuit-open';
  if (msg.includes('Navigation timeout')) return 'timeout';
  if (msg.includes('net::ERR_')) return 'network';
  if (msg.includes('Target closed')) return 'crashed';
  if (msg.includes('no browser')) return 'pool-exhausted';
  return 'other';
}
