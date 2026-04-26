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

export type SchemaTemplate = 'Article' | 'Product' | 'FAQ' | 'HowTo' | 'WebSite';

export type OptimizeOptions = {
  url: string;
  stripScripts?: boolean;
  ensureBase?: boolean;
  ensureCanonical?: boolean;
  /** 봇 응답에서 <img>/<picture> 제거. alt 만 남겨 인덱싱 가능하게. 기본 false. */
  stripImages?: boolean;
  /** 페이지 경로에서 BreadcrumbList JSON-LD 자동 생성/주입. */
  injectBreadcrumb?: boolean;
  /** 라우트 오버라이드로 지정한 schema.org 템플릿 (Article/Product/FAQ/HowTo/WebSite). */
  schemaTemplate?: SchemaTemplate;
};

const META_RE = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const DESC_RE =
  /<meta[^>]+(?:property|name)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i;

function extractMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null = null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex iterator pattern
  while ((m = META_RE.exec(html)) !== null) {
    if (m[1] && !out[m[1]]) out[m[1]] = m[2] ?? '';
  }
  return out;
}

function buildSchemaJsonLd(template: SchemaTemplate, html: string, url: string): string | null {
  const meta = extractMeta(html);
  const title = meta['og:title'] ?? html.match(TITLE_RE)?.[1]?.trim() ?? '';
  const desc = meta['og:description'] ?? html.match(DESC_RE)?.[1] ?? '';
  const image = meta['og:image'] ?? '';
  const author = meta.author ?? '';
  const publishedTime = meta['article:published_time'] ?? '';
  const modifiedTime = meta['article:modified_time'] ?? publishedTime;
  const u = new URL(url);

  const ld: Record<string, unknown> = { '@context': 'https://schema.org', '@type': template };
  switch (template) {
    case 'Article':
      Object.assign(ld, {
        headline: title,
        description: desc,
        image: image || undefined,
        author: author ? { '@type': 'Person', name: author } : undefined,
        datePublished: publishedTime || undefined,
        dateModified: modifiedTime || undefined,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      });
      break;
    case 'Product':
      Object.assign(ld, {
        name: title,
        description: desc,
        image: image || undefined,
        url,
      });
      break;
    case 'FAQ':
      Object.assign(ld, {
        mainEntity: [],
        _hint: 'FAQPage 은 페이지 본문에 Q/A 마크업이 필요합니다',
      });
      ld['@type'] = 'FAQPage';
      break;
    case 'HowTo':
      Object.assign(ld, {
        name: title,
        description: desc,
        step: [],
        _hint: 'HowTo 는 페이지 본문에 step 추출 로직이 필요합니다',
      });
      break;
    case 'WebSite':
      Object.assign(ld, {
        name: title || u.host,
        url: `${u.origin}/`,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${u.origin}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      });
      break;
  }
  // 빈 값 제거
  for (const k of Object.keys(ld)) {
    if (ld[k] === undefined || ld[k] === '') delete ld[k];
  }
  return JSON.stringify(ld);
}

const HAS_BREADCRUMB_JSONLD =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@type"\s*:\s*"BreadcrumbList"/i;

function buildBreadcrumbJsonLd(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    const items: Array<{ '@type': string; position: number; name: string; item: string }> = [];
    items.push({ '@type': 'ListItem', position: 1, name: 'Home', item: u.origin + '/' });
    let acc = '';
    parts.forEach((seg, i) => {
      acc += `/${seg}`;
      const name = decodeURIComponent(seg)
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      items.push({
        '@type': 'ListItem',
        position: i + 2,
        name,
        item: u.origin + acc,
      });
    });
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items,
    });
  } catch {
    return null;
  }
}

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
  if (opts.injectBreadcrumb && !HAS_BREADCRUMB_JSONLD.test(out)) {
    const ld = buildBreadcrumbJsonLd(opts.url);
    if (ld) meta.push(`<script type="application/ld+json">${ld}</script>`);
  }
  if (opts.schemaTemplate) {
    const ld = buildSchemaJsonLd(opts.schemaTemplate, out, opts.url);
    if (ld) meta.push(`<script type="application/ld+json">${ld}</script>`);
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
