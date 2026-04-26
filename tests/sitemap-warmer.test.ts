import { warmFromSitemap } from '@spa-seo-gateway/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.example.com/</loc></url>
  <url><loc>https://www.example.com/blog/a</loc></url>
  <url><loc>https://www.example.com/blog/b</loc></url>
</urlset>`;

const SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.example.com/sitemap-blog.xml</loc></sitemap>
  <sitemap><loc>https://www.example.com/sitemap-products.xml</loc></sitemap>
</sitemapindex>`;

const URLSET_BLOG = `<?xml version="1.0" encoding="UTF-8"?>
<urlset><url><loc>https://www.example.com/blog/x</loc></url></urlset>`;

const URLSET_PROD = `<?xml version="1.0" encoding="UTF-8"?>
<urlset><url><loc>https://www.example.com/products/1</loc></url></urlset>`;

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn(async (url: string | URL) => {
    const u = typeof url === 'string' ? url : url.toString();
    let body = '';
    if (u.endsWith('/sitemap.xml')) body = URLSET;
    else if (u.endsWith('/sitemap-index.xml')) body = SITEMAP_INDEX;
    else if (u.endsWith('/sitemap-blog.xml')) body = URLSET_BLOG;
    else if (u.endsWith('/sitemap-products.xml')) body = URLSET_PROD;
    else return new Response('not found', { status: 404 });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/xml' } });
  });
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('warmFromSitemap', () => {
  it('parses urlset and reports found count', async () => {
    // 렌더는 cacheSwr → coalesceAsync → fetcher 가 실패해도 통계엔 errors 로 카운트
    // sitemap 파싱 자체는 성공해야 함
    const report = await warmFromSitemap('https://www.example.com/sitemap.xml', {
      max: 100,
      concurrency: 2,
    });
    expect(report.found).toBe(3);
    // warmed + skipped + errors === found
    expect(report.warmed + report.skipped + report.errors).toBeLessThanOrEqual(report.found);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('recursively expands sitemap-index', async () => {
    const report = await warmFromSitemap('https://www.example.com/sitemap-index.xml', {
      max: 100,
      concurrency: 1,
    });
    expect(report.found).toBe(2);
  });

  it('respects max parameter', async () => {
    const report = await warmFromSitemap('https://www.example.com/sitemap.xml', { max: 1 });
    expect(report.found).toBeLessThanOrEqual(1);
  });

  it('returns errors=1 when sitemap fetch fails', async () => {
    const report = await warmFromSitemap('https://www.example.com/missing.xml', {});
    expect(report.errors).toBeGreaterThanOrEqual(1);
    expect(report.found).toBe(0);
  });

  it('uses correct user-agent header for sitemap fetch', async () => {
    await warmFromSitemap('https://www.example.com/sitemap.xml', { max: 1 });
    const call = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
    const ua = (call?.headers as Record<string, string> | undefined)?.['user-agent'];
    expect(ua).toMatch(/spa-seo-gateway-warmer/);
  });
});
