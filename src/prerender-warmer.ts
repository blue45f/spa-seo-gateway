import { XMLParser } from 'fast-xml-parser';
import { cacheSwr } from './cache.js';
import { matchRoute } from './config.js';
import { logger } from './logger.js';
import { render } from './renderer.js';
import { cacheKey, isHostAllowed } from './url.js';

type SitemapNode = { loc?: string; lastmod?: string };
type Urlset = { urlset?: { url?: SitemapNode | SitemapNode[] } };
type SitemapIndex = { sitemapindex?: { sitemap?: SitemapNode | SitemapNode[] } };

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: true });

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'spa-seo-gateway-warmer/1.0', accept: 'application/xml,text/xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

async function collectUrls(sitemapUrl: string, depth = 0, max = 5_000): Promise<string[]> {
  if (depth > 3) return [];
  const xml = await fetchXml(sitemapUrl);
  const tree = parser.parse(xml) as Urlset & SitemapIndex;
  const urls: string[] = [];

  const indexEntries = tree.sitemapindex?.sitemap;
  if (indexEntries) {
    const list = Array.isArray(indexEntries) ? indexEntries : [indexEntries];
    for (const s of list) {
      if (!s.loc) continue;
      const sub = await collectUrls(s.loc, depth + 1, max - urls.length).catch((e) => {
        logger.warn({ err: (e as Error).message, sitemap: s.loc }, 'sub-sitemap failed');
        return [] as string[];
      });
      urls.push(...sub);
      if (urls.length >= max) break;
    }
  }

  const urlEntries = tree.urlset?.url;
  if (urlEntries) {
    const list = Array.isArray(urlEntries) ? urlEntries : [urlEntries];
    for (const u of list) {
      if (u.loc) urls.push(u.loc);
      if (urls.length >= max) break;
    }
  }
  return urls.slice(0, max);
}

export type WarmReport = {
  sitemap: string;
  found: number;
  warmed: number;
  skipped: number;
  errors: number;
  durationMs: number;
};

export async function warmFromSitemap(
  sitemapUrl: string,
  opts: { concurrency?: number; max?: number } = {},
): Promise<WarmReport> {
  const t0 = Date.now();
  const max = opts.max ?? 1_000;
  const concurrency = opts.concurrency ?? 4;

  let urls: string[];
  try {
    urls = await collectUrls(sitemapUrl, 0, max);
  } catch (e) {
    logger.error({ err: (e as Error).message, sitemap: sitemapUrl }, 'sitemap parse failed');
    return {
      sitemap: sitemapUrl,
      found: 0,
      warmed: 0,
      skipped: 0,
      errors: 1,
      durationMs: Date.now() - t0,
    };
  }

  let warmed = 0;
  let skipped = 0;
  let errors = 0;
  let i = 0;

  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx];
      if (!url) continue;
      try {
        if (!isHostAllowed(url)) {
          skipped++;
          continue;
        }
        const route = matchRoute(url);
        if (route?.ignore) {
          skipped++;
          continue;
        }
        const key = cacheKey(url);
        await cacheSwr(
          key,
          () => render({ url, headers: { 'user-agent': 'Googlebot/2.1' }, route }),
          route?.ttlMs,
        );
        warmed++;
      } catch (e) {
        errors++;
        logger.warn({ err: (e as Error).message, url }, 'warm failed');
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  const report: WarmReport = {
    sitemap: sitemapUrl,
    found: urls.length,
    warmed,
    skipped,
    errors,
    durationMs: Date.now() - t0,
  };
  logger.info(report, 'sitemap warm complete');
  return report;
}
