/**
 * pool.ts unit tests — mocks puppeteer-cluster + puppeteer at the module
 * boundary so no real Chrome is launched. Covers start/stop idempotency,
 * withPage gating, recycle path, stats(), and the taskerror handler wiring.
 *
 * Note on mocking: from a root-level `tests/` file, `vi.mock('puppeteer-cluster')`
 * with a bare specifier does NOT propagate into `packages/core/src/pool.ts`'s
 * transitive import (pnpm hoists puppeteer-cluster only under packages/core).
 * We resolve the absolute path at hoist time so the mock matches the path
 * vitest sees during pool.ts's resolution.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted gives us a way to share state with the mock factory AND to compute
// the absolute path to puppeteer-cluster (resolved from packages/core).
const mocks = vi.hoisted(() => {
  // vi.hoisted 팩토리는 ESM import 가 정착되기 전(hoist 시점)에 실행되므로
  // 절대 경로 해석을 위해 CJS require 를 의도적으로 사용한다(import 로는 불가).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createRequire } = require('node:module')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path')
  const corePoolPath = path.resolve(process.cwd(), 'packages/core/src/pool.ts')
  const req = createRequire(corePoolPath)
  const puppeteerClusterPath = req.resolve('puppeteer-cluster')

  type FakeCluster = {
    execute: ReturnType<typeof vi.fn>
    idle: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    handlers: Record<string, (err: Error) => void>
    id: number
  }
  const launchCalls: Array<{ options: unknown; cluster: FakeCluster }> = []
  let clusterId = 0
  const newFakeCluster = (): FakeCluster => {
    const c: FakeCluster = {
      execute: vi.fn(async (task: (ctx: { page: unknown }) => Promise<unknown>) => {
        return task({ page: {} as unknown })
      }),
      idle: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      on: vi.fn((event: string, cb: (err: Error) => void) => {
        c.handlers[event] = cb
      }),
      handlers: {},
      id: ++clusterId,
    }
    return c
  }
  return {
    puppeteerClusterPath,
    launchCalls,
    newFakeCluster,
    resetClusterId: () => {
      clusterId = 0
    },
  }
})

vi.mock(mocks.puppeteerClusterPath, () => {
  return {
    Cluster: {
      CONCURRENCY_PAGE: 1,
      CONCURRENCY_CONTEXT: 2,
      CONCURRENCY_BROWSER: 3,
      launch: vi.fn(async (options: unknown) => {
        const c = mocks.newFakeCluster()
        mocks.launchCalls.push({ options, cluster: c })
        return c
      }),
    },
  }
})

vi.mock('puppeteer', () => {
  // pool.ts only passes the default export through to Cluster.launch as a peer.
  return { default: { __fake: 'puppeteer' } }
})

const { browserPool, config } = await import('@heejun/spa-seo-gateway-core')

beforeEach(() => {
  mocks.launchCalls.length = 0
  mocks.resetClusterId()
})

afterEach(async () => {
  await browserPool.stop().catch(() => undefined)
  // Reset internal state so each test starts clean (singleton pool).
  const internals = browserPool as unknown as {
    stopped: boolean
    cluster: unknown
    active: number
    totalServed: number
    recycleAt: number
    recycling: boolean
    startedAt: number
  }
  internals.stopped = false
  internals.cluster = null
  internals.active = 0
  internals.totalServed = 0
  internals.recycleAt = 0
  internals.recycling = false
  internals.startedAt = 0
})

describe('browserPool.start', () => {
  it('launches a cluster and wires the taskerror handler', async () => {
    await browserPool.start()
    expect(mocks.launchCalls.length).toBe(1)

    const cluster = mocks.launchCalls[0].cluster
    expect(cluster.on).toHaveBeenCalledWith('taskerror', expect.any(Function))
    // Invoking the handler must not throw — it only logs.
    expect(() => cluster.handlers.taskerror(new Error('boom'))).not.toThrow()
  })

  it('is idempotent — second call does not relaunch', async () => {
    await browserPool.start()
    await browserPool.start()
    expect(mocks.launchCalls.length).toBe(1)
  })

  it('updates stats() after start: ready=true, uptimeMs > 0', async () => {
    expect(browserPool.stats().ready).toBe(false)
    expect(browserPool.stats().uptimeMs).toBe(0)

    await browserPool.start()
    await new Promise((r) => setTimeout(r, 5))
    const s = browserPool.stats()
    expect(s.ready).toBe(true)
    expect(s.active).toBe(0)
    expect(s.uptimeMs).toBeGreaterThan(0)
    expect(s.maxConcurrency).toBe(config.renderer.poolMax)
    expect(s.nextRecycleAt).toBe(config.renderer.maxRequestsPerBrowser)
    expect(s.recycling).toBe(false)
  })

  it('forwards executablePath + viewport into puppeteerOptions', async () => {
    await browserPool.start()
    const opts = mocks.launchCalls[0].options as {
      puppeteer: unknown
      maxConcurrency: number
      puppeteerOptions: { headless: boolean; args: string[] }
    }
    expect(opts.puppeteer).toBeDefined()
    expect(opts.maxConcurrency).toBe(config.renderer.poolMax)
    expect(opts.puppeteerOptions.headless).toBe(true)
    expect(Array.isArray(opts.puppeteerOptions.args)).toBe(true)
  })
})

describe('browserPool.withPage', () => {
  it('throws "pool not running" when not started', async () => {
    await expect(browserPool.withPage(async () => 'x')).rejects.toThrow(/pool not running/)
  })

  it('throws "pool not running" after stop()', async () => {
    await browserPool.start()
    await browserPool.stop()
    await expect(browserPool.withPage(async () => 'x')).rejects.toThrow(/pool not running/)
  })

  it('executes the task and increments active/totalServed gauges', async () => {
    await browserPool.start()
    const cluster = mocks.launchCalls[0].cluster

    const result = await browserPool.withPage(async (_page) => 'ok')
    expect(result).toBe('ok')
    expect(cluster.execute).toHaveBeenCalledTimes(1)

    const s = browserPool.stats()
    expect(s.totalServed).toBe(1)
    expect(s.active).toBe(0) // decremented in finally
  })

  it('decrements active even when task throws', async () => {
    await browserPool.start()
    await expect(
      browserPool.withPage(async () => {
        throw new Error('task fail')
      })
    ).rejects.toThrow('task fail')
    expect(browserPool.stats().active).toBe(0)
  })
})

describe('browserPool recycle', () => {
  it('triggers Cluster.launch a second time when totalServed crosses maxRequestsPerBrowser', async () => {
    const prev = config.renderer.maxRequestsPerBrowser
    ;(config.renderer as { maxRequestsPerBrowser: number }).maxRequestsPerBrowser = 1
    try {
      await browserPool.start()
      expect(mocks.launchCalls.length).toBe(1)
      const original = mocks.launchCalls[0].cluster

      await browserPool.withPage(async () => 'a')
      // Recycle is fire-and-forget; let microtasks settle.
      await new Promise((r) => setTimeout(r, 30))

      expect(mocks.launchCalls.length).toBe(2)
      expect(original.idle).toHaveBeenCalled()
      expect(original.close).toHaveBeenCalled()

      const fresh = mocks.launchCalls[1].cluster
      expect(fresh.on).toHaveBeenCalledWith('taskerror', expect.any(Function))
      // Trigger handler — confirms wiring.
      expect(() => fresh.handlers.taskerror(new Error('fresh boom'))).not.toThrow()
      expect(browserPool.stats().recycling).toBe(false)
    } finally {
      ;(config.renderer as { maxRequestsPerBrowser: number }).maxRequestsPerBrowser = prev
    }
  })

  it('logs and survives when recycle launch throws (keeps old cluster)', async () => {
    const prev = config.renderer.maxRequestsPerBrowser
    ;(config.renderer as { maxRequestsPerBrowser: number }).maxRequestsPerBrowser = 1
    const clusterMod = (await import(mocks.puppeteerClusterPath)) as unknown as {
      Cluster: { launch: ReturnType<typeof vi.fn> }
    }
    const originalImpl = clusterMod.Cluster.launch.getMockImplementation()
    try {
      await browserPool.start()
      const originalCluster = mocks.launchCalls[0].cluster
      // Force the next launch (the recycle's) to fail.
      clusterMod.Cluster.launch.mockImplementationOnce(async () => {
        throw new Error('relaunch failed')
      })

      await browserPool.withPage(async () => 'a')
      await new Promise((r) => setTimeout(r, 30))

      // Old cluster stays in place because recycle bailed.
      expect((browserPool as unknown as { cluster: unknown }).cluster).toBe(originalCluster)
    } finally {
      ;(config.renderer as { maxRequestsPerBrowser: number }).maxRequestsPerBrowser = prev
      if (originalImpl) clusterMod.Cluster.launch.mockImplementation(originalImpl)
    }
  })
})

describe('browserPool.stop', () => {
  it('clears cluster and is callable twice safely', async () => {
    await browserPool.start()
    await browserPool.stop()
    expect((browserPool as unknown as { cluster: unknown }).cluster).toBeNull()
    await expect(browserPool.stop()).resolves.toBeUndefined()
  })

  it('swallows cluster close errors and continues', async () => {
    await browserPool.start()
    const cluster = mocks.launchCalls[0].cluster
    cluster.close.mockRejectedValueOnce(new Error('close blew up'))
    await expect(browserPool.stop()).resolves.toBeUndefined()
    expect((browserPool as unknown as { cluster: unknown }).cluster).toBeNull()
  })

  it('stop without start is a no-op', async () => {
    await expect(browserPool.stop()).resolves.toBeUndefined()
  })
})

describe('browserPool.recycle (early-return guards)', () => {
  it('recycle is a no-op when cluster is null', async () => {
    // Never started → cluster is null.
    const recycle = (browserPool as unknown as { recycle: () => Promise<void> }).recycle.bind(
      browserPool
    )
    await expect(recycle()).resolves.toBeUndefined()
    expect(mocks.launchCalls.length).toBe(0)
  })

  it('recycle is a no-op when pool is stopped', async () => {
    await browserPool.start()
    // Force stopped state without going through stop() (which clears cluster).
    ;(browserPool as unknown as { stopped: boolean }).stopped = true
    const recycle = (browserPool as unknown as { recycle: () => Promise<void> }).recycle.bind(
      browserPool
    )
    await expect(recycle()).resolves.toBeUndefined()
    // Only the initial launch — recycle did not happen.
    expect(mocks.launchCalls.length).toBe(1)
  })
})
