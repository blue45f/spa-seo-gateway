/**
 * distributed-lock — redis-enabled paths.
 *
 * Mocks `@keyv/redis` so we can exercise every branch of `withDistributedLock`
 * without a real Redis instance.
 *
 * Why we resolve the path explicitly:
 *   Vitest 4's vi.mock matches modules by their final-resolved absolute path.
 *   `@keyv/redis` is imported from packages/core/src/distributed-lock.ts, which
 *   resolves via pnpm's deep .pnpm/ store. The bare specifier "@keyv/redis"
 *   alone does not intercept that resolution from inside nested workspace
 *   packages, so we resolve it as the core package would and pass that exact
 *   path to vi.mock.
 *
 * Why we use vi.resetModules() between tests:
 *   distributed-lock.ts keeps `redisClient` and `connecting` as module-private
 *   singletons. Resetting the module graph between tests gives each test a
 *   fresh client + a fresh ctor / get / set / del mock object.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const keyvRedisPath = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createRequire } = require('node:module') as {
    createRequire: (id: string) => NodeJS.Require
  }
  const req = createRequire(`${process.cwd()}/packages/core/src/index.js`)
  const p = req.resolve('@keyv/redis')
  // Vitest mocks the ESM form.
  return p.replace(/\.cjs$/, '.js')
})

type FakeClient = {
  set: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
}

const state = vi.hoisted(() => ({
  fake: null as null | {
    set: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    del: ReturnType<typeof vi.fn>
  },
  ctorShouldThrow: false,
}))

vi.mock(keyvRedisPath, () => {
  class KeyvRedis {
    on() {}
    constructor(_url: string) {
      if (state.ctorShouldThrow) throw new Error('keyv ctor boom')
    }
    async getClient() {
      return state.fake as unknown
    }
  }
  return { default: KeyvRedis }
})

function makeFake(): FakeClient {
  return {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  }
}

type CoreModule = typeof import('@heejun/spa-seo-gateway-core')

async function loadFreshCore(opts: {
  redisEnabled: boolean
  redisUrl?: string | undefined
}): Promise<CoreModule> {
  vi.resetModules()
  const mod = (await import('@heejun/spa-seo-gateway-core')) as CoreModule
  mod.config.cache.redis.enabled = opts.redisEnabled
  if ('redisUrl' in opts) {
    ;(mod.config.cache.redis as { url?: string }).url = opts.redisUrl
  }
  return mod
}

describe('withDistributedLock — redis-enabled paths', () => {
  beforeEach(() => {
    state.fake = makeFake()
    state.ctorShouldThrow = false
  })

  afterEach(() => {
    state.fake = null
    state.ctorShouldThrow = false
    vi.restoreAllMocks()
  })

  it('acquires the lock when SET NX returns OK and runs fn, then releases', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue('OK')
    fake.del.mockResolvedValue(1)

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    let calls = 0
    const v = await withDistributedLock('k1', async () => {
      calls++
      return 'value-1'
    })

    expect(v).toBe('value-1')
    expect(calls).toBe(1)
    expect(fake.set).toHaveBeenCalledTimes(1)
    const [k, _pid, opts] = fake.set.mock.calls[0]
    expect(k).toMatch(/lock:k1$/)
    expect(opts).toMatchObject({ NX: true, EX: 60 })
    expect(fake.del).toHaveBeenCalledTimes(1)
    expect(fake.del.mock.calls[0][0]).toMatch(/lock:k1$/)
  })

  it('acquires the lock when SET NX returns boolean true', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue(true)
    fake.del.mockResolvedValue(1)

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    const v = await withDistributedLock('k-bool', async () => 7)
    expect(v).toBe(7)
    expect(fake.del).toHaveBeenCalledTimes(1)
  })

  it('still releases the lock when fn throws', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue('OK')
    fake.del.mockResolvedValue(1)

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    await expect(
      withDistributedLock('k-throw', async () => {
        throw new Error('inside-fn')
      })
    ).rejects.toThrow(/inside-fn/)

    expect(fake.del).toHaveBeenCalledTimes(1)
  })

  it('swallows del errors via .catch()', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue('OK')
    fake.del.mockRejectedValue(new Error('del-broken'))

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    const v = await withDistributedLock('k-del-err', async () => 'ok')
    expect(v).toBe('ok')
    expect(fake.del).toHaveBeenCalledTimes(1)
  })

  it('lock not acquired — polls fallback and returns cached value', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue(null) // NX failed
    // Fallback returns undefined first, then a value (simulating cache fill).
    const fallback = vi
      .fn(async (): Promise<string | undefined> => undefined)
      .mockResolvedValueOnce(undefined as string | undefined)
      .mockResolvedValueOnce('from-cache' as string | undefined)
    fake.get.mockResolvedValue('held') // lock still held while polling

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    let fnCalls = 0
    const v = await withDistributedLock(
      'k-poll',
      async () => {
        fnCalls++
        return 'should-not-run'
      },
      { fallback }
    )

    expect(v).toBe('from-cache')
    expect(fnCalls).toBe(0)
    expect(fallback.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(fake.del).not.toHaveBeenCalled()
  })

  it('lock not acquired — exits poll loop when lock is released, then runs fn', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue(null)
    fake.get.mockResolvedValueOnce('held').mockResolvedValueOnce(null) // lock released
    const fallback = vi.fn().mockResolvedValue(undefined)

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    let fnCalls = 0
    const v = await withDistributedLock(
      'k-released',
      async () => {
        fnCalls++
        return 'after-release'
      },
      { fallback }
    )

    expect(v).toBe('after-release')
    expect(fnCalls).toBe(1)
  })

  it('lock not acquired — handles redis.get rejection during poll (uses .catch(null))', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue(null)
    fake.get.mockRejectedValue(new Error('get-broken'))
    const fallback = vi.fn().mockResolvedValue(undefined)

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    let fnCalls = 0
    const v = await withDistributedLock(
      'k-get-err',
      async () => {
        fnCalls++
        return 'fallthrough'
      },
      { fallback }
    )
    expect(v).toBe('fallthrough')
    expect(fnCalls).toBe(1)
  })

  it('no fallback provided — polls until lock release then runs fn', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue(null)
    fake.get.mockResolvedValueOnce('held').mockResolvedValueOnce(null)

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    let fnCalls = 0
    const v = await withDistributedLock('k-no-fb', async () => {
      fnCalls++
      return 'done'
    })
    expect(v).toBe('done')
    expect(fnCalls).toBe(1)
  })

  it('redis init failure — KeyvRedis ctor throws → fn runs as fallback', async () => {
    state.ctorShouldThrow = true

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://broken',
    })

    let fnCalls = 0
    const v = await withDistributedLock('k-init-fail', async () => {
      fnCalls++
      return 'noredis'
    })
    expect(v).toBe('noredis')
    expect(fnCalls).toBe(1)
  })

  it('redis.set throws — catch path falls back to fn', async () => {
    const fake = state.fake!
    fake.set.mockRejectedValue(new Error('set-broken'))

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    let fnCalls = 0
    const v = await withDistributedLock('k-set-err', async () => {
      fnCalls++
      return 'set-fallback'
    })
    expect(v).toBe('set-fallback')
    expect(fnCalls).toBe(1)
  })

  it('reuses cached redisClient across calls (set called twice on same fake)', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue('OK')
    fake.del.mockResolvedValue(1)

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    await withDistributedLock('k-a', async () => 1)
    await withDistributedLock('k-b', async () => 2)
    expect(fake.set).toHaveBeenCalledTimes(2)
    expect(fake.del).toHaveBeenCalledTimes(2)
  })

  it('concurrent calls during initial connect share the same in-flight `connecting` promise', async () => {
    const fake = state.fake!
    fake.set.mockResolvedValue('OK')
    fake.del.mockResolvedValue(1)

    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: 'redis://fake',
    })

    const [r1, r2, r3] = await Promise.all([
      withDistributedLock('p-1', async () => 1),
      withDistributedLock('p-2', async () => 2),
      withDistributedLock('p-3', async () => 3),
    ])
    expect([r1, r2, r3].sort()).toEqual([1, 2, 3])
  })

  it('redis disabled — fn runs directly (no client requested)', async () => {
    const fake = state.fake!
    const { withDistributedLock } = await loadFreshCore({ redisEnabled: false })

    const v = await withDistributedLock('off', async () => 'direct')
    expect(v).toBe('direct')
    expect(fake.set).not.toHaveBeenCalled()
  })

  it('redis enabled but url missing — fn runs directly', async () => {
    const fake = state.fake!
    const { withDistributedLock } = await loadFreshCore({
      redisEnabled: true,
      redisUrl: undefined,
    })
    const v = await withDistributedLock('nourl', async () => 'direct')
    expect(v).toBe('direct')
    expect(fake.set).not.toHaveBeenCalled()
  })
})
