import { describe, expect, it } from 'vitest';
import { optimizeHtml } from '../src/optimize.js';

describe('optimizeHtml', () => {
  it('inserts prerender meta tags into head', () => {
    const out = optimizeHtml('<html><head><title>X</title></head><body>hi</body></html>', {
      url: 'https://example.com/',
    });
    expect(out).toMatch(/<meta\s+name="x-prerendered"/);
    expect(out).toMatch(/<meta\s+name="x-prerender-source"\s+content="spa-seo-gateway">/);
  });

  it('adds <base href> when ensureBase=true and base missing', () => {
    const out = optimizeHtml('<html><head></head><body></body></html>', {
      url: 'https://example.com/sub/',
      ensureBase: true,
    });
    expect(out).toMatch(/<base href="https:\/\/example\.com\/">/);
  });

  it('does not duplicate base when already present', () => {
    const html = '<html><head><base href="https://other.com/"></head><body></body></html>';
    const out = optimizeHtml(html, { url: 'https://example.com/', ensureBase: true });
    expect((out.match(/<base /g) ?? []).length).toBe(1);
  });

  it('strips scripts when stripScripts=true (preserves JSON-LD)', () => {
    const html =
      '<html><head><script>x()</script><script type="application/ld+json">{}</script></head><body></body></html>';
    const out = optimizeHtml(html, { url: 'https://e.com/', stripScripts: true });
    expect(out).not.toMatch(/<script>x\(\)/);
    expect(out).toMatch(/application\/ld\+json/);
  });
});
