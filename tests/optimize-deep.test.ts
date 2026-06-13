/**
 * optimize.ts 의 stripImages / schemaTemplate / injectBreadcrumb 분기 커버리지 확장.
 * 기본 optimize.test.ts 는 prerender meta + base + script strip 만 다룬다.
 */
import { optimizeHtml } from '@heejun/spa-seo-gateway-core'
import { describe, expect, it } from 'vitest'

const BASE = '<html><head><title>T</title></head><body><p>hello body</p></body></html>'

describe('optimizeHtml: canonical', () => {
  it('injects <link rel=canonical> when missing', () => {
    const out = optimizeHtml(BASE, { url: 'https://e.com/path', ensureCanonical: true })
    expect(out).toMatch(/<link rel="canonical" href="https:\/\/e\.com\/path">/)
    expect(out).toMatch(/<meta property="og:url" content="https:\/\/e\.com\/path">/)
  })

  it('does not duplicate canonical when already present', () => {
    const html = '<html><head><link rel="canonical" href="https://x"></head><body></body></html>'
    const out = optimizeHtml(html, { url: 'https://e.com/', ensureCanonical: true })
    expect((out.match(/rel="canonical"/g) ?? []).length).toBe(1)
  })
})

describe('optimizeHtml: stripImages', () => {
  it('removes <img> tags but keeps alt text', () => {
    const html = `<html><head></head><body><img src="x.jpg" alt="Hello & World"><p>after</p></body></html>`
    const out = optimizeHtml(html, { url: 'https://e.com/', stripImages: true })
    expect(out).not.toMatch(/<img\b/)
    expect(out).toMatch(/<span class="x-img-alt">Hello/)
  })

  it('drops <img> with no alt entirely', () => {
    const html = `<html><head></head><body><img src="x.jpg"><p>after</p></body></html>`
    const out = optimizeHtml(html, { url: 'https://e.com/', stripImages: true })
    expect(out).not.toMatch(/<img\b/)
    expect(out).not.toMatch(/x-img-alt/)
  })

  it('removes <picture> wholesale', () => {
    const html = `<html><head></head><body><picture><source srcset="a"><img src="b"></picture></body></html>`
    const out = optimizeHtml(html, { url: 'https://e.com/', stripImages: true })
    expect(out).not.toMatch(/<picture\b/)
    expect(out).not.toMatch(/<source\b/)
  })

  it('blanks data: URI image src', () => {
    const html = `<html><head></head><body><img src="data:image/png;base64,iVBORw0K"></body></html>`
    const out = optimizeHtml(html, { url: 'https://e.com/', stripImages: true })
    expect(out).not.toMatch(/data:image/)
  })

  it('removes preload + prefetch links', () => {
    const html = `<html><head><link rel="preload" href="x.js"><link rel="prefetch" href="y.js"></head><body></body></html>`
    const out = optimizeHtml(html, { url: 'https://e.com/', stripImages: true })
    expect(out).not.toMatch(/rel="preload"/)
    expect(out).not.toMatch(/rel="prefetch"/)
  })
})

describe('optimizeHtml: breadcrumb', () => {
  it('injects BreadcrumbList JSON-LD on multi-segment paths', () => {
    const out = optimizeHtml(BASE, {
      url: 'https://e.com/blog/2024/intro',
      injectBreadcrumb: true,
    })
    expect(out).toMatch(/"@type":\s*"BreadcrumbList"/)
    expect(out).toMatch(/"name":\s*"Home"/)
    expect(out).toMatch(/"name":\s*"Intro"/)
  })

  it('does not inject breadcrumb on root path', () => {
    const out = optimizeHtml(BASE, { url: 'https://e.com/', injectBreadcrumb: true })
    expect(out).not.toMatch(/BreadcrumbList/)
  })

  it('does not duplicate breadcrumb when JSON-LD already exists', () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"BreadcrumbList"}</script></head><body></body></html>`
    const out = optimizeHtml(html, { url: 'https://e.com/a/b', injectBreadcrumb: true })
    expect((out.match(/BreadcrumbList/g) ?? []).length).toBe(1)
  })
})

describe('optimizeHtml: schemaTemplate', () => {
  const RICH = `<html><head><title>The Title</title>
    <meta name="description" content="Page summary">
    <meta property="og:image" content="https://e.com/og.png">
    <meta name="author" content="Alice">
    <meta property="article:published_time" content="2024-01-02">
    </head><body>x</body></html>`

  it('injects Article schema with extracted metadata', () => {
    const out = optimizeHtml(RICH, { url: 'https://e.com/p', schemaTemplate: 'Article' })
    expect(out).toMatch(/"@type":\s*"Article"/)
    expect(out).toMatch(/"headline":\s*"The Title"/)
    expect(out).toMatch(/"author"/)
    expect(out).toMatch(/"datePublished":\s*"2024-01-02"/)
  })

  it('injects Product schema', () => {
    const out = optimizeHtml(RICH, { url: 'https://e.com/sku', schemaTemplate: 'Product' })
    expect(out).toMatch(/"@type":\s*"Product"/)
    expect(out).toMatch(/"name":\s*"The Title"/)
  })

  it('injects FAQPage stub', () => {
    const out = optimizeHtml(BASE, { url: 'https://e.com/faq', schemaTemplate: 'FAQ' })
    expect(out).toMatch(/"@type":\s*"FAQPage"/)
  })

  it('injects HowTo stub', () => {
    const out = optimizeHtml(BASE, { url: 'https://e.com/how', schemaTemplate: 'HowTo' })
    expect(out).toMatch(/"@type":\s*"HowTo"/)
  })

  it('injects WebSite schema with search action', () => {
    const out = optimizeHtml(BASE, { url: 'https://e.com/', schemaTemplate: 'WebSite' })
    expect(out).toMatch(/"@type":\s*"WebSite"/)
    expect(out).toMatch(/SearchAction/)
    expect(out).toMatch(/search\?q=\{search_term_string\}/)
  })
})
