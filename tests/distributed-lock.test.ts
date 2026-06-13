/**
 * distributed-lock: Redis 비활성 환경에서는 fetcher 를 그대로 실행한다.
 * Redis 활성/락 획득/대기 경로는 redis mock 이 없는 환경에서 검증이 어려워
 * 본 테스트는 단일 노드 fallback 만 다룬다.
 */
import { config, withDistributedLock } from '@heejun/spa-seo-gateway-core'
import { describe, expect, it } from 'vitest'

describe('withDistributedLock (no redis)', () => {
  it('executes fn directly when redis is disabled', async () => {
    expect(config.cache.redis.enabled).toBe(false)
    let called = 0
    const v = await withDistributedLock('key-a', async () => {
      called++
      return 42
    })
    expect(v).toBe(42)
    expect(called).toBe(1)
  })

  it('propagates fn errors', async () => {
    await expect(
      withDistributedLock('key-b', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow(/boom/)
  })

  it('supports concurrent calls without redis (no dedup, no error)', async () => {
    let i = 0
    const calls = await Promise.all([
      withDistributedLock('k', async () => ++i),
      withDistributedLock('k', async () => ++i),
      withDistributedLock('k', async () => ++i),
    ])
    expect(calls.sort()).toEqual([1, 2, 3])
  })
})
