import type { HTTPRequest, Page } from 'puppeteer';
import { config } from './config.js';

const blockedTypes = new Set(config.renderer.blockResourceTypes);
const blockedPatterns = config.renderer.blockUrlPatterns;

export async function applyRequestInterception(page: Page): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (req: HTTPRequest) => {
    if (req.isInterceptResolutionHandled()) return;
    const type = req.resourceType();
    if (blockedTypes.has(type as never)) {
      req.abort('blockedbyclient').catch(() => {});
      return;
    }
    if (blockedPatterns.length > 0) {
      const url = req.url();
      for (const p of blockedPatterns) {
        if (url.includes(p)) {
          req.abort('blockedbyclient').catch(() => {});
          return;
        }
      }
    }
    req.continue().catch(() => {});
  });
}

const HEAD_RE = /<head([^>]*)>/i;
const BASE_RE = /<base[^>]*href=/i;
const SCRIPT_RE =
  /<script\b(?![^>]*\btype=["']application\/(?:ld\+json|json)["'])[^>]*>[\s\S]*?<\/script>/gi;

export type OptimizeOptions = {
  url: string;
  stripScripts?: boolean;
  ensureBase?: boolean;
};

export function optimizeHtml(html: string, opts: OptimizeOptions): string {
  let out = html;

  const meta = [
    `<meta name="x-prerendered" content="${new Date().toISOString()}">`,
    `<meta name="x-prerender-source" content="spa-seo-gateway">`,
  ];

  if (opts.ensureBase && !BASE_RE.test(out)) {
    const origin = new URL(opts.url).origin;
    meta.push(`<base href="${origin}/">`);
  }

  out = out.replace(HEAD_RE, (_m, attrs) => `<head${attrs}>\n${meta.join('\n')}`);

  if (opts.stripScripts) {
    out = out.replace(SCRIPT_RE, '');
  }
  return out;
}
