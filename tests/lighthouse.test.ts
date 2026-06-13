/**
 * lighthouse.ts: 동적 import 로 lighthouse / chrome-launcher 를 가져온다.
 * 둘 다 devDep 에도 없으므로 실제 호출은 명시적 에러로 빠진다 — 그 분기 + 캐시 초기화만 검증.
 */
import { clearLighthouseCache, runLighthouse } from '@heejun/spa-seo-gateway-core'
import { describe, expect, it } from 'vitest'

describe('runLighthouse without lighthouse installed', () => {
  it('throws a helpful install message when lighthouse is missing', async () => {
    // lighthouse / chrome-launcher 는 미설치 — dynamic import 가 실패해야 한다.
    await expect(runLighthouse('https://example.com/', { useCache: false })).rejects.toThrow(
      /lighthouse 가 설치/
    )
  })

  it('clearLighthouseCache is a no-op that does not throw', () => {
    expect(() => clearLighthouseCache()).not.toThrow()
  })
})
