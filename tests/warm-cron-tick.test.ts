/**
 * warm-cron-tick.test.ts — exercises the `tick` function (success, failure,
 * concurrency guard) by mocking `warmFromSitemap` and driving the timers
 * vitest-style.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type WarmReport = {
  sitemap: string
  found: number
  warmed: number
  skipped: number
  errors: number
  durationMs: number
}

const warmFromSitemapMock = vi.fn<(url: string, opts: unknown) => Promise<WarmReport>>()
const recordAuditMock = vi.fn()

vi.mock('../packages/core/src/prerender-warmer.js', () => ({
  warmFromSitemap: warmFromSitemapMock,
}))

vi.mock('../packages/core/src/audit.js', async () => {
  const actual = await vi.importActual<typeof import('../packages/core/src/audit.js')>(
    '../packages/core/src/audit.js'
  )
  return { ...actual, recordAudit: recordAuditMock }
})

type WarmCronModule = typeof import('../packages/core/src/warm-cron.js')
type ConfigModule = typeof import('../packages/core/src/config.js')

let warmCron: WarmCronModule
let configMod: ConfigModule
let savedWarmCron: ConfigModule['config']['warmCron']

beforeEach(async () => {
  vi.useFakeTimers()
  warmFromSitemapMock.mockReset()
  recordAuditMock.mockReset()

  warmCron = await import('../packages/core/src/warm-cron.js')
  configMod = await import('../packages/core/src/config.js')
  savedWarmCron = { ...configMod.config.warmCron }
  ;(configMod.config as { warmCron: ConfigModule['config']['warmCron'] }).warmCron = {
    enabled: true,
    sitemap: 'https://x.test/sitemap.xml',
    intervalMs: 30_000,
    max: 10,
    concurrency: 1,
  }
})

afterEach(() => {
  warmCron.stopWarmCron()
  ;(configMod.config as { warmCron: ConfigModule['config']['warmCron'] }).warmCron = savedWarmCron
  vi.useRealTimers()
})

function defaultReport(overrides: Partial<WarmReport> = {}): WarmReport {
  return {
    sitemap: 'https://x.test/sitemap.xml',
    found: 5,
    warmed: 4,
    skipped: 1,
    errors: 0,
    durationMs: 12,
    ...overrides,
  }
}

describe('warm-cron tick', () => {
  it('logs disabled message + early-returns when disabled', () => {
    ;(configMod.config as { warmCron: ConfigModule['config']['warmCron'] }).warmCron = {
      ...configMod.config.warmCron,
      enabled: false,
    }
    expect(() => warmCron.startWarmCron()).not.toThrow()
    expect(warmFromSitemapMock).not.toHaveBeenCalled()
  })

  it('successful tick calls warmFromSitemap with config opts and records ok audit', async () => {
    warmFromSitemapMock.mockResolvedValue(defaultReport())
    warmCron.startWarmCron()

    // Drive the initial 5_000ms setTimeout.
    await vi.advanceTimersByTimeAsync(5_000)

    expect(warmFromSitemapMock).toHaveBeenCalledTimes(1)
    expect(warmFromSitemapMock).toHaveBeenCalledWith('https://x.test/sitemap.xml', {
      max: 10,
      concurrency: 1,
    })
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'warm-cron',
        action: 'sitemap.warm',
        outcome: 'ok',
        target: 'https://x.test/sitemap.xml',
        meta: expect.objectContaining({ found: 5, warmed: 4, errors: 0 }),
      })
    )

    // Advance one interval; should trigger another tick.
    await vi.advanceTimersByTimeAsync(30_000)
    expect(warmFromSitemapMock).toHaveBeenCalledTimes(2)
  })

  it('failure tick records error audit with the error message', async () => {
    warmFromSitemapMock.mockRejectedValue(new Error('sitemap blew up'))
    warmCron.startWarmCron()

    await vi.advanceTimersByTimeAsync(5_000)

    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'warm-cron',
        outcome: 'error',
        meta: { error: 'sitemap blew up' },
      })
    )
  })

  it('concurrency guard prevents overlapping ticks', async () => {
    // First call: never resolves until we let it.
    let releaseFirst!: () => void
    const firstPromise = new Promise<WarmReport>((res) => {
      releaseFirst = () => res(defaultReport())
    })
    warmFromSitemapMock.mockReturnValueOnce(firstPromise)
    warmFromSitemapMock.mockResolvedValue(defaultReport())

    warmCron.startWarmCron()

    // Trigger initial tick — it starts the long-running warm call.
    await vi.advanceTimersByTimeAsync(5_000)
    expect(warmFromSitemapMock).toHaveBeenCalledTimes(1)

    // Advance interval while the first tick is still in-flight — running flag
    // should short-circuit the second tick.
    await vi.advanceTimersByTimeAsync(30_000)
    expect(warmFromSitemapMock).toHaveBeenCalledTimes(1)

    // Release the in-flight call so `running` goes false.
    releaseFirst()
    await firstPromise
    // Yield so the finally block resets `running`.
    await Promise.resolve()
    await Promise.resolve()

    // Now another interval tick should actually run.
    await vi.advanceTimersByTimeAsync(30_000)
    expect(warmFromSitemapMock).toHaveBeenCalledTimes(2)
  })

  it('tick is a no-op when sitemap becomes undefined between schedule + fire', async () => {
    warmFromSitemapMock.mockResolvedValue(defaultReport())
    warmCron.startWarmCron()

    // Yank the sitemap out from under the timer.
    ;(configMod.config as { warmCron: ConfigModule['config']['warmCron'] }).warmCron = {
      ...configMod.config.warmCron,
      sitemap: undefined,
    }
    await vi.advanceTimersByTimeAsync(5_000)

    expect(warmFromSitemapMock).not.toHaveBeenCalled()
  })

  it('stopWarmCron clears the interval so no further ticks fire', async () => {
    warmFromSitemapMock.mockResolvedValue(defaultReport())
    warmCron.startWarmCron()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(warmFromSitemapMock).toHaveBeenCalledTimes(1)

    warmCron.stopWarmCron()
    await vi.advanceTimersByTimeAsync(120_000)
    // Still just the one initial tick.
    expect(warmFromSitemapMock).toHaveBeenCalledTimes(1)
  })
})
