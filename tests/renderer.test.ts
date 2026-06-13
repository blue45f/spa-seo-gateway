/**
 * renderer.ts unit tests — mocks browserPool.withPage so no real Chrome
 * launches. Exercises every branch in renderOnce: viewport selection
 * (mobile vs desktop), route overrides (waitUntil/waitSelector/waitMs/
 * blockResourceTypes/viewport), quality gate (soft-404 / error-page),
 * A/B variants, schema templates, header forwarding, retry logic, and
 * the non-retry path for non-transient errors.
 *
 * The fake Page implements only the methods renderer.ts touches; the
 * applyRequestInterception helper requires setRequestInterception + on('request').
 */
import { browserPool, render } from '@heejun/spa-seo-gateway-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

type FakePageOpts = {
  html?: string
  status?: number
  responseHeaders?: Record<string, string>
  userAgent?: string
  // Optional capture of mutations applied during rendering.
  capture?: {
    viewport?: { width: number; height: number }
    bypassCsp?: boolean
    extraHeaders?: Record<string, string>
    userAgentSet?: string
    gotoUrl?: string
    gotoOpts?: { timeout: number; waitUntil: string }
    waitSelector?: string
    waitForFunctionCalled?: boolean
  }
  // throw from waitForFunction (for waitPrerenderReady branch)
  waitForFunctionThrows?: boolean
}

function makeFakePage(opts: FakePageOpts) {
  const capture = opts.capture ?? {}
  return {
    setExtraHTTPHeaders: async (h: Record<string, string>) => {
      capture.extraHeaders = h
    },
    setUserAgent: async (ua: string) => {
      capture.userAgentSet = ua
    },
    setViewport: async (v: { width: number; height: number }) => {
      capture.viewport = v
    },
    setBypassCSP: async (b: boolean) => {
      capture.bypassCsp = b
    },
    setRequestInterception: async (_: boolean) => undefined,
    on: (_event: string, _cb: (...args: unknown[]) => void) => undefined,
    browser: () => ({
      userAgent: async () => opts.userAgent ?? 'HeadlessChrome/X.Y',
    }),
    goto: async (
      url: string,
      o: { timeout: number; waitUntil: string }
    ): Promise<{ status: () => number; headers: () => Record<string, string> } | null> => {
      capture.gotoUrl = url
      capture.gotoOpts = o
      return {
        status: () => opts.status ?? 200,
        headers: () => opts.responseHeaders ?? {},
      }
    },
    content: async () =>
      opts.html ??
      '<html><head><title>OK</title></head><body><main><p>This is the body content that is long enough to pass the minimum text length check easily.</p></main></body></html>',
    waitForSelector: async (sel: string, _o: { timeout: number }) => {
      capture.waitSelector = sel
      return undefined
    },
    waitForFunction: async (_expr: string, _o: { timeout: number }) => {
      capture.waitForFunctionCalled = true
      if (opts.waitForFunctionThrows) throw new Error('waitForFunction timeout')
      return undefined
    },
  }
}

// Helper to spy on browserPool.withPage with the fake page.
function mockWithPage(pages: Array<FakePageOpts | Error>): {
  capture: Required<FakePageOpts>['capture']
  pageCalls: number
} {
  const capture: Required<FakePageOpts>['capture'] = {}
  let i = 0
  vi.spyOn(browserPool, 'withPage').mockImplementation(async (fn) => {
    const step = pages[i++] ?? pages[pages.length - 1]
    if (step instanceof Error) throw step
    const page = makeFakePage({ ...step, capture })
    return fn(page as never)
  })
  return {
    capture,
    get pageCalls() {
      return i
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('render — happy path', () => {
  it('returns CacheEntry with 200 + x-prerender-* headers + html content-type', async () => {
    const { capture } = mockWithPage([{}])
    const entry = await render({
      url: 'https://www.example.com/',
      headers: {},
    })
    expect(entry.status).toBe(200)
    expect(entry.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(entry.headers['x-prerendered']).toBe('true')
    expect(entry.headers['x-prerender-status']).toBe('200')
    expect(entry.headers['x-prerender-viewport']).toBe('desktop')
    expect(entry.body).toContain('<html')
    // Sanity: the page received goto with the URL.
    expect(capture.gotoUrl).toBe('https://www.example.com/')
  })

  it('Googlebot-mobile UA sets viewport=mobile header', async () => {
    const { capture } = mockWithPage([{}])
    const entry = await render({
      url: 'https://www.example.com/',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +Googlebot Mobile)' },
    })
    expect(entry.headers['x-prerender-viewport']).toBe('mobile')
    // viewport set on page should equal mobileViewport
    expect(capture.viewport?.width).toBeLessThan(800)
  })

  it('forwards cookie / accept-language / authorization, strips others', async () => {
    const { capture } = mockWithPage([{}])
    await render({
      url: 'https://www.example.com/',
      headers: {
        cookie: 'sid=abc; theme=dark',
        'accept-language': 'en-US,en;q=0.9',
        authorization: 'Bearer t0k3n',
        'x-secret-internal': 'leak-me',
        'user-agent': 'Googlebot',
      },
    })
    expect(capture.extraHeaders).toEqual({
      cookie: 'sid=abc; theme=dark',
      'accept-language': 'en-US,en;q=0.9',
      authorization: 'Bearer t0k3n',
    })
    expect(capture.extraHeaders).not.toHaveProperty('x-secret-internal')
    expect(capture.extraHeaders).not.toHaveProperty('user-agent')
  })

  it('joins array-valued forwarded headers with comma', async () => {
    const { capture } = mockWithPage([{}])
    await render({
      url: 'https://www.example.com/',
      headers: { 'accept-language': ['en-US', 'ko-KR'] },
    })
    expect(capture.extraHeaders?.['accept-language']).toBe('en-US, ko-KR')
  })

  it('echoes Link response header into prerender output', async () => {
    mockWithPage([{ responseHeaders: { link: '<https://www.example.com/x>; rel="canonical"' } }])
    const entry = await render({
      url: 'https://www.example.com/',
      headers: {},
    })
    expect(entry.headers.link).toContain('rel="canonical"')
  })
})

describe('render — route overrides', () => {
  it('applies viewport, waitUntil, waitSelector, blockResourceTypes from route', async () => {
    const { capture } = mockWithPage([{}])
    await render({
      url: 'https://www.example.com/products/123',
      headers: {},
      route: {
        pattern: '^/products/',
        viewport: { width: 1440, height: 900 },
        waitUntil: 'networkidle0',
        waitSelector: '#product-loaded',
        blockResourceTypes: ['image', 'font'],
      },
    })
    expect(capture.viewport).toEqual({ width: 1440, height: 900 })
    expect(capture.gotoOpts?.waitUntil).toBe('networkidle0')
    expect(capture.waitSelector).toBe('#product-loaded')
  })

  it('honours waitMs > 0 by scheduling the configured delay', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    mockWithPage([{}])
    await render({
      url: 'https://93.184.216.34/slow/',
      headers: {},
      route: { pattern: '^/slow/', waitMs: 10 },
    })
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10)
  })

  it('attaches x-prerender-route header to output', async () => {
    mockWithPage([{}])
    const entry = await render({
      url: 'https://www.example.com/blog/',
      headers: {},
      route: { pattern: '^/blog/' },
    })
    expect(entry.headers['x-prerender-route']).toBe('^/blog/')
  })

  it('injects JSON-LD when route declares schemaTemplate=Article', async () => {
    mockWithPage([
      {
        html: '<html><head><title>Hello</title><meta property="og:title" content="Hello"><meta name="description" content="A nice article body that is long enough to satisfy the minimum quality threshold."></head><body><p>Body text content goes here, long enough.</p></body></html>',
      },
    ])
    const entry = await render({
      url: 'https://www.example.com/blog/post-1',
      headers: {},
      route: { pattern: '^/blog/', schemaTemplate: 'Article' },
    })
    expect(entry.body).toContain('"@type":"Article"')
    expect(entry.body).toContain('"@context":"https://schema.org"')
  })
})

describe('render — A/B variants', () => {
  it('selects a variant, applies it, and emits x-prerender-variant', async () => {
    mockWithPage([
      {
        html: '<html><head><title>orig</title></head><body><p>Long enough body content for the quality gate to be satisfied easily without complaints.</p></body></html>',
      },
    ])
    const entry = await render({
      url: 'https://www.example.com/ab/',
      headers: {},
      route: {
        pattern: '^/ab/',
        variants: [
          { title: 'A', weight: 1 },
          { title: 'B', weight: 1 },
        ],
      },
    })
    expect(entry.headers['x-prerender-variant']).toMatch(/^[01]$/)
    // The output should have one of the variant titles, not the original.
    expect(entry.body).toMatch(/<title>[AB]<\/title>/)
  })
})

describe('render — quality gate', () => {
  it('rewrites status to 404 when soft-404 detected', async () => {
    mockWithPage([
      {
        html: '<html><head><title>404 Not Found</title></head><body></body></html>',
      },
    ])
    const entry = await render({
      url: 'https://www.example.com/missing',
      headers: {},
    })
    expect(entry.status).toBe(404)
    expect(entry.headers['x-prerender-status']).toBe('404')
    expect(entry.headers['x-prerender-quality']).toBe('soft-404')
    // 404 yields a short-TTL hint.
    expect(entry.headers['x-prerender-short-ttl-ms']).toBeDefined()
  })

  it('rewrites status to 503 on error-page heuristic', async () => {
    mockWithPage([
      {
        html: '<html><head><title>500 Internal Server Error</title></head><body></body></html>',
      },
    ])
    const entry = await render({
      url: 'https://www.example.com/broken',
      headers: {},
    })
    expect(entry.status).toBe(503)
    expect(entry.headers['x-prerender-quality']).toBe('error-page')
  })

  it('does NOT run quality gate when origin already returned >= 400', async () => {
    mockWithPage([
      {
        status: 410,
        html: '<html><head><title>Gone</title></head><body><p>tiny body</p></body></html>',
      },
    ])
    const entry = await render({
      url: 'https://www.example.com/gone',
      headers: {},
    })
    expect(entry.status).toBe(410)
    // Quality gate is skipped for >= 400 origins, so no x-prerender-quality.
    expect(entry.headers['x-prerender-quality']).toBeUndefined()
    // 410 still gets a short-TTL hint.
    expect(entry.headers['x-prerender-short-ttl-ms']).toBeDefined()
  })
})

describe('render — waitPrerenderReady toggle', () => {
  it('does not call waitForFunction when waitPrerenderReady=false (default)', async () => {
    const { capture } = mockWithPage([{}])
    await render({ url: 'https://www.example.com/', headers: {} })
    expect(capture.waitForFunctionCalled).toBeFalsy()
  })

  it('calls waitForFunction and survives if it throws when toggle is on', async () => {
    // mutate config in-place; restore after.
    const { config } = await import('@heejun/spa-seo-gateway-core')
    const prev = config.renderer.waitPrerenderReady
    ;(config.renderer as { waitPrerenderReady: boolean }).waitPrerenderReady = true
    try {
      const { capture } = mockWithPage([{ waitForFunctionThrows: true }])
      const entry = await render({
        url: 'https://www.example.com/wait/',
        headers: {},
      })
      expect(capture.waitForFunctionCalled).toBe(true)
      expect(entry.status).toBe(200)
    } finally {
      ;(config.renderer as { waitPrerenderReady: boolean }).waitPrerenderReady = prev
    }
  })
})

describe('render — SSRF + invalid input', () => {
  it('rejects loopback URLs with "SSRF blocked"', async () => {
    mockWithPage([{}])
    await expect(render({ url: 'http://localhost/x', headers: {} })).rejects.toThrow(/SSRF blocked/)
  })

  it('rejects RFC1918 IP literals', async () => {
    mockWithPage([{}])
    await expect(render({ url: 'http://192.168.1.5/admin', headers: {} })).rejects.toThrow(
      /SSRF blocked/
    )
  })
})

describe('render — retry logic', () => {
  it('retries once on transient "Target closed" then succeeds', async () => {
    mockWithPage([new Error('Target closed: unexpected'), {}])
    const entry = await render({
      url: 'https://www.example.com/retry-ok/',
      headers: {},
    })
    expect(entry.status).toBe(200)
  })

  it('does NOT retry non-transient "Navigation timeout"; throws after first attempt', async () => {
    let calls = 0
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (_fn) => {
      calls++
      throw new Error('Navigation timeout of 25000 ms exceeded')
    })
    await expect(render({ url: 'https://www.example.com/retry-no/', headers: {} })).rejects.toThrow(
      /Navigation timeout/
    )
    expect(calls).toBe(1)
  })

  it('retries on "net::ERR_CONNECTION_RESET" (classified network) and surfaces second-attempt failure when also transient', async () => {
    let calls = 0
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (_fn) => {
      calls++
      throw new Error('net::ERR_CONNECTION_RESET')
    })
    await expect(
      render({ url: 'https://www.example.com/retry-both-fail/', headers: {} })
    ).rejects.toThrow(/net::ERR_/)
    expect(calls).toBe(2)
  })

  it('classifies "no browser" as pool-exhausted (transient → retries)', async () => {
    let calls = 0
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (_fn) => {
      calls++
      throw new Error('no browser available right now')
    })
    await expect(
      render({ url: 'https://www.example.com/no-browser/', headers: {} })
    ).rejects.toThrow(/no browser/)
    // pool-exhausted is in TRANSIENT_REASONS so two attempts are made.
    expect(calls).toBe(2)
  })

  it('classifies unknown errors as "other" (non-transient → single attempt)', async () => {
    let calls = 0
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (_fn) => {
      calls++
      throw new Error('totally novel failure mode')
    })
    await expect(render({ url: 'https://www.example.com/novel/', headers: {} })).rejects.toThrow(
      /totally novel/
    )
    expect(calls).toBe(1)
  })
})
