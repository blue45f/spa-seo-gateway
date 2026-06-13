/**
 * hot-reload.ts: file-watch 기반 routes 자동 적용.
 *
 * 모듈 로딩 시점에 잡힌 config.hotReload 값은 변경할 수 없어 (env 의존),
 * 본 테스트는 startHotReload / stopHotReload 가 부작용 없이 동작하는지와
 * SIGHUP 트리거 시 reloadOnce 가 routes 를 갱신하는지를 검증.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { config, getRoutes, startHotReload, stopHotReload } from '@heejun/spa-seo-gateway-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let tmp: string
let originalConfigFile: string | undefined
let originalHotReload: boolean

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'spa-hr-'))
  originalConfigFile = process.env.GATEWAY_CONFIG_FILE
  originalHotReload = config.hotReload
})

afterEach(() => {
  stopHotReload()
  if (originalConfigFile === undefined) delete process.env.GATEWAY_CONFIG_FILE
  else process.env.GATEWAY_CONFIG_FILE = originalConfigFile
  ;(config as { hotReload: boolean }).hotReload = originalHotReload
  rmSync(tmp, { recursive: true, force: true })
})

describe('hot-reload', () => {
  it('returns silently when hotReload is disabled', () => {
    ;(config as { hotReload: boolean }).hotReload = false
    expect(() => startHotReload()).not.toThrow()
    expect(() => stopHotReload()).not.toThrow()
  })

  it('starts a watcher when hotReload is enabled and config file exists', () => {
    const file = join(tmp, 'cfg.json')
    writeFileSync(file, JSON.stringify({ routes: [{ pattern: '^/x/' }] }))
    process.env.GATEWAY_CONFIG_FILE = file
    ;(config as { hotReload: boolean }).hotReload = true
    expect(() => startHotReload()).not.toThrow()
  })

  it('starts even when config file does not exist (will start on creation)', () => {
    const file = join(tmp, 'absent.json')
    process.env.GATEWAY_CONFIG_FILE = file
    ;(config as { hotReload: boolean }).hotReload = true
    // existsSync false 경로 도달 (info log) 후 watch 시도 → 미존재 시 watch 가 throw 하면 warn.
    expect(() => startHotReload()).not.toThrow()
  })

  it('SIGHUP triggers a manual reload that applies routes from the file', async () => {
    const file = join(tmp, 'manual.json')
    writeFileSync(file, JSON.stringify({ routes: [{ pattern: '^/sighup/' }] }))
    process.env.GATEWAY_CONFIG_FILE = file
    ;(config as { hotReload: boolean }).hotReload = true
    startHotReload()
    process.kill(process.pid, 'SIGHUP')
    // setImmediate after handler
    await new Promise((r) => setTimeout(r, 50))
    const routes = getRoutes()
    expect(routes.some((r) => r.pattern === '^/sighup/')).toBe(true)
  })

  it('handles malformed JSON gracefully without crashing', async () => {
    const file = join(tmp, 'bad.json')
    writeFileSync(file, 'not json at all { }')
    process.env.GATEWAY_CONFIG_FILE = file
    ;(config as { hotReload: boolean }).hotReload = true
    startHotReload()
    expect(() => process.kill(process.pid, 'SIGHUP')).not.toThrow()
    await new Promise((r) => setTimeout(r, 50))
  })

  it('handles config without routes[] array', async () => {
    const file = join(tmp, 'no-routes.json')
    writeFileSync(file, JSON.stringify({ other: 'thing' }))
    process.env.GATEWAY_CONFIG_FILE = file
    ;(config as { hotReload: boolean }).hotReload = true
    startHotReload()
    expect(() => process.kill(process.pid, 'SIGHUP')).not.toThrow()
    await new Promise((r) => setTimeout(r, 50))
  })
})
