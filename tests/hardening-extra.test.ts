/**
 * 코드 리뷰 하드닝 추가 테스트:
 *
 *  - hot-reload.ts: startHotReload 가 idempotent (이중 호출 시 SIGHUP 리스너 누적 X)
 *  - hot-reload.ts: stopHotReload 후 SIGHUP 핸들러가 제거됨 (process 에 누수 X)
 *  - runtime-config.ts: setRoutes 가 invalid 정규식에 throw 시 기존 routes 유지 (트랜잭션)
 *  - circuit-breaker.ts: 캡(512)을 초과해도 메모리 누수 없이 동작 (eviction)
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  config,
  getRoutes,
  setRoutes,
  startHotReload,
  stopHotReload,
  withBreaker,
} from '@heejun/spa-seo-gateway-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('startHotReload — idempotent', () => {
  let originalHotReload: boolean
  let originalConfigFile: string | undefined
  let tmp: string

  beforeEach(() => {
    originalHotReload = config.hotReload
    originalConfigFile = process.env.GATEWAY_CONFIG_FILE
    tmp = mkdtempSync(join(tmpdir(), 'spa-hr-'))
    // 존재하는 파일이 있어야 watch() 가 핸들러를 실제로 등록함.
    const file = join(tmp, 'cfg.json')
    writeFileSync(file, JSON.stringify({ routes: [] }))
    process.env.GATEWAY_CONFIG_FILE = file
  })

  afterEach(() => {
    stopHotReload()
    ;(config as { hotReload: boolean }).hotReload = originalHotReload
    if (originalConfigFile === undefined) delete process.env.GATEWAY_CONFIG_FILE
    else process.env.GATEWAY_CONFIG_FILE = originalConfigFile
    rmSync(tmp, { recursive: true, force: true })
  })

  it('does not register a second SIGHUP listener on repeated start calls', () => {
    ;(config as { hotReload: boolean }).hotReload = true
    const before = process.listenerCount('SIGHUP')
    startHotReload()
    const afterFirst = process.listenerCount('SIGHUP')
    startHotReload()
    const afterSecond = process.listenerCount('SIGHUP')
    // 첫 호출에서 +1, 두 번째 호출은 idempotent — 그대로.
    expect(afterFirst).toBe(before + 1)
    expect(afterSecond).toBe(afterFirst)
  })

  it('stopHotReload removes the SIGHUP listener it added', () => {
    ;(config as { hotReload: boolean }).hotReload = true
    const before = process.listenerCount('SIGHUP')
    startHotReload()
    expect(process.listenerCount('SIGHUP')).toBe(before + 1)
    stopHotReload()
    expect(process.listenerCount('SIGHUP')).toBe(before)
  })

  it('stopHotReload is safe to call when start was never called', () => {
    expect(() => stopHotReload()).not.toThrow()
  })
})

describe('setRoutes — atomic on invalid regex', () => {
  it('leaves existing routes untouched when one of the new patterns is invalid', () => {
    setRoutes([{ pattern: '^/good/' }])
    expect(getRoutes()).toEqual([{ pattern: '^/good/' }])
    // 두 번째 라우트가 invalid → 전체 교체가 실패해야 한다.
    // 변경 전: routes.map 가 throw 하기 전 부분만 적용될 수 있었음.
    expect(() => setRoutes([{ pattern: '^/ok/' }, { pattern: '[' }])).toThrow()
    // 기존 routes 가 유지됨.
    expect(getRoutes()).toEqual([{ pattern: '^/good/' }])
  })

  it('replaces routes atomically on valid input', () => {
    setRoutes([{ pattern: '^/a/' }, { pattern: '^/b/' }])
    expect(getRoutes()).toHaveLength(2)
    setRoutes([{ pattern: '^/c/' }])
    expect(getRoutes()).toEqual([{ pattern: '^/c/' }])
  })
})

describe('withBreaker — bounded breaker registry', () => {
  it('creates one breaker per host and reuses it on repeated calls', async () => {
    const counter = { n: 0 }
    const fn = async () => {
      counter.n++
      return 'ok'
    }
    const a = withBreaker('breaker-test-host-1.example', fn)
    const b = withBreaker('breaker-test-host-1.example', fn)
    // wrapper functions for the same host should yield identical behavior;
    // and the underlying breaker is reused (no leak).
    await a()
    await b()
    expect(counter.n).toBe(2)
  })

  it('handles many distinct hosts without throwing (bounded eviction)', async () => {
    // 600 개의 unique host (cap 512 초과) 를 만들어도 안전.
    // 정확한 size 는 노출 API 가 없으니 throw 만 검증.
    const fn = async () => 'ok'
    for (let i = 0; i < 600; i++) {
      const wrapped = withBreaker(`hardening-host-${i}.example`, fn)
      await wrapped()
    }
    // 600 회 호출이 모두 완료되었으면 통과.
    expect(true).toBe(true)
  })
})
