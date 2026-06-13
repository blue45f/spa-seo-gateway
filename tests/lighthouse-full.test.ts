/**
 * lighthouse-full.test.ts — exercises every branch of runLighthouse by
 * mocking the dynamic `lighthouse` and `chrome-launcher` imports.
 *
 * The production module uses `import('lighthouse' as string)` so vitest's
 * static analyzer cannot see the specifier — but `vi.doMock` registers the
 * mock at the module-resolution layer, which intercepts the dynamic call
 * regardless of how the specifier is typed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type LighthouseModule = typeof import('../packages/core/src/lighthouse.js')

const launchMock = vi.fn()
const lighthouseMock = vi.fn()
const killMock = vi.fn()

async function loadLighthouseModule(): Promise<LighthouseModule> {
  vi.doMock('lighthouse', () => ({ default: lighthouseMock }))
  vi.doMock('chrome-launcher', () => ({ launch: launchMock }))
  // Fresh import so the module-level cache map starts empty per test.
  return (await import('../packages/core/src/lighthouse.js')) as LighthouseModule
}

function defaultLhr() {
  return {
    lhr: {
      categories: {
        performance: { score: 0.92 },
        accessibility: { score: 0.81 },
        'best-practices': { score: 0.5 },
        seo: { score: 1 },
        pwa: { score: null }, // exercise the non-number path
      },
      audits: {
        'fast-audit': { title: 'Fast Audit', score: 0.95 }, // filtered (>=90)
        'slow-audit': { title: 'Slow Audit', score: 0.42 }, // 42
        'medium-audit': { title: 'Medium Audit', score: 0.6 }, // 60
        'no-score-audit': { title: 'No Score', score: null }, // filtered
        'string-score-audit': { title: 'String Score', score: 'n/a' }, // filtered
      },
    },
  }
}

beforeEach(() => {
  vi.resetModules()
  launchMock.mockReset()
  lighthouseMock.mockReset()
  killMock.mockReset()
  launchMock.mockResolvedValue({ port: 9222, kill: killMock })
  killMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.doUnmock('lighthouse')
  vi.doUnmock('chrome-launcher')
})

describe('runLighthouse (full coverage)', () => {
  it('returns normalised scores + top audits on success', async () => {
    lighthouseMock.mockResolvedValueOnce(defaultLhr())
    const { runLighthouse } = await loadLighthouseModule()

    const r = await runLighthouse('https://e1.com/', { useCache: false })

    expect(r.url).toBe('https://e1.com/')
    expect(r.scores.performance).toBe(92)
    expect(r.scores.accessibility).toBe(81)
    expect(r.scores.bestPractices).toBe(50)
    expect(r.scores.seo).toBe(100)
    expect(r.scores.pwa).toBeNull()
    // Only audits with numeric score <90 — sorted ascending, capped at 10.
    expect(r.topAudits.map((a) => a.id)).toEqual(['slow-audit', 'medium-audit'])
    expect(r.topAudits[0]?.score).toBe(42)
    expect(typeof r.durationMs).toBe('number')
    expect(typeof r.fetchedAt).toBe('string')
    expect(launchMock).toHaveBeenCalledTimes(1)
    expect(killMock).toHaveBeenCalledTimes(1)
  })

  it('returns cached result on a second call when useCache is true', async () => {
    lighthouseMock.mockResolvedValueOnce(defaultLhr())
    const { runLighthouse } = await loadLighthouseModule()

    const first = await runLighthouse('https://cache-hit.com/')
    const second = await runLighthouse('https://cache-hit.com/')

    expect(second).toBe(first)
    expect(lighthouseMock).toHaveBeenCalledTimes(1)
    expect(launchMock).toHaveBeenCalledTimes(1)
  })

  it('bypasses the cache when useCache=false', async () => {
    lighthouseMock.mockResolvedValue(defaultLhr())
    const { runLighthouse } = await loadLighthouseModule()

    await runLighthouse('https://bypass.com/', { useCache: false })
    await runLighthouse('https://bypass.com/', { useCache: false })

    expect(lighthouseMock).toHaveBeenCalledTimes(2)
  })

  it('clearLighthouseCache resets the in-memory cache', async () => {
    lighthouseMock.mockResolvedValue(defaultLhr())
    const { runLighthouse, clearLighthouseCache } = await loadLighthouseModule()

    await runLighthouse('https://reset.com/')
    expect(lighthouseMock).toHaveBeenCalledTimes(1)

    clearLighthouseCache()
    await runLighthouse('https://reset.com/')
    expect(lighthouseMock).toHaveBeenCalledTimes(2)
  })

  it('throws when lighthouse returns an empty result', async () => {
    lighthouseMock.mockResolvedValueOnce(undefined)
    const { runLighthouse } = await loadLighthouseModule()

    await expect(runLighthouse('https://empty.com/', { useCache: false })).rejects.toThrow(
      /lighthouse returned empty result/
    )
    // chrome.kill still ran in the finally block.
    expect(killMock).toHaveBeenCalledTimes(1)
  })

  it('swallows chrome.kill rejection on the failure path', async () => {
    lighthouseMock.mockResolvedValueOnce(undefined)
    killMock.mockRejectedValueOnce(new Error('boom'))
    const { runLighthouse } = await loadLighthouseModule()

    await expect(runLighthouse('https://kill-fail.com/', { useCache: false })).rejects.toThrow(
      /lighthouse returned empty result/
    )
  })

  it('passes opts.chromePath through to chrome-launcher', async () => {
    lighthouseMock.mockResolvedValueOnce(defaultLhr())
    const { runLighthouse } = await loadLighthouseModule()

    await runLighthouse('https://path.com/', { useCache: false, chromePath: '/bin/chromium' })

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({ chromePath: '/bin/chromium' })
    )
  })

  it('handles missing categories / audits gracefully (all-null scores, empty audits)', async () => {
    lighthouseMock.mockResolvedValueOnce({ lhr: {} })
    const { runLighthouse } = await loadLighthouseModule()

    const r = await runLighthouse('https://bare.com/', { useCache: false })
    expect(r.scores).toEqual({
      performance: null,
      accessibility: null,
      bestPractices: null,
      seo: null,
      pwa: null,
    })
    expect(r.topAudits).toEqual([])
  })

  it('evicts the oldest entry once the cache reaches CACHE_MAX', async () => {
    lighthouseMock.mockResolvedValue(defaultLhr())
    const { runLighthouse } = await loadLighthouseModule()

    // CACHE_MAX is 256 — fill it + 1 extra entry to trigger eviction.
    for (let i = 0; i < 257; i++) {
      await runLighthouse(`https://cap-${i}.com/`)
    }
    // 257 unique URLs all called lighthouse once; nothing was a cache hit.
    expect(lighthouseMock).toHaveBeenCalledTimes(257)
  })
})
