import type { HTTPRequest, Page } from 'puppeteer';
import { config } from './config.js';

export type InterceptionOptions = {
  blockResourceTypes?: ReadonlyArray<string>;
  blockUrlPatterns?: ReadonlyArray<string>;
};

export async function applyRequestInterception(
  page: Page,
  options: InterceptionOptions = {},
): Promise<void> {
  const blockedTypes = new Set(options.blockResourceTypes ?? config.renderer.blockResourceTypes);
  const blockedPatterns = options.blockUrlPatterns ?? config.renderer.blockUrlPatterns;

  await page.setRequestInterception(true);
  page.on('request', (req: HTTPRequest) => {
    if (req.isInterceptResolutionHandled()) return;
    if (blockedTypes.has(req.resourceType())) {
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
const CANONICAL_RE = /<link[^>]+rel=["']canonical["']/i;
const OG_URL_RE = /<meta[^>]+property=["']og:url["']/i;
const SCRIPT_RE =
  /<script\b(?![^>]*\btype=["']application\/(?:ld\+json|json)["'])[^>]*>[\s\S]*?<\/script>/gi;
const IMG_RE = /<img\b[^>]*>/gi;
const PICTURE_RE = /<picture\b[^>]*>[\s\S]*?<\/picture>/gi;
const PRELOAD_RE = /<link\b[^>]*\brel=["']preload["'][^>]*>/gi;
const PREFETCH_RE = /<link\b[^>]*\brel=["']prefetch["'][^>]*>/gi;
const DATA_URI_IMG_RE = /\bsrc=["']data:image\/[^"']+["']/gi;

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function imgAlt(tag: string): string {
  const m = tag.match(/\balt=["']([^"']*)["']/i);
  return m?.[1] ?? '';
}

export type OptimizeOptions = {
  url: string;
  stripScripts?: boolean;
  ensureBase?: boolean;
  ensureCanonical?: boolean;
  /** 봇 응답에서 <img>/<picture> 제거. alt 만 남겨 인덱싱 가능하게. 기본 false. */
  stripImages?: boolean;
};

export function optimizeHtml(html: string, opts: OptimizeOptions): string {
  let out = html;
  const meta = [
    `<meta name="x-prerendered" content="${new Date().toISOString()}">`,
    `<meta name="x-prerender-source" content="spa-seo-gateway">`,
  ];
  if (opts.ensureBase && !BASE_RE.test(out)) {
    meta.push(`<base href="${escapeAttr(new URL(opts.url).origin)}/">`);
  }
  if (opts.ensureCanonical) {
    if (!CANONICAL_RE.test(out)) {
      meta.push(`<link rel="canonical" href="${escapeAttr(opts.url)}">`);
    }
    if (!OG_URL_RE.test(out)) {
      meta.push(`<meta property="og:url" content="${escapeAttr(opts.url)}">`);
    }
  }
  out = out.replace(HEAD_RE, (_m, attrs) => `<head${attrs}>\n${meta.join('\n')}`);
  if (opts.stripScripts) out = out.replace(SCRIPT_RE, '');
  if (opts.stripImages) {
    // <picture> 통째로 제거 → <img> 도 제거 (alt 만 텍스트로 보존하면 검색엔진은 캡션만 본다)
    out = out.replace(PICTURE_RE, '');
    out = out.replace(IMG_RE, (tag) => {
      const alt = imgAlt(tag).trim();
      return alt ? `<span class="x-img-alt">${escapeAttr(alt)}</span>` : '';
    });
    // base64 srcset/data URI 가 남아있으면 통째 제거
    out = out.replace(DATA_URI_IMG_RE, 'src=""');
    // preload/prefetch 도 봇은 안 봄
    out = out.replace(PRELOAD_RE, '');
    out = out.replace(PREFETCH_RE, '');
  }
  return out;
}
