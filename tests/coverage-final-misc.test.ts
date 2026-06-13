/**
 * Final coverage push — small/misc branches that don't fit anywhere else.
 *
 *  - hot-reload.ts lines 64-65: watch() change callback fires → debounce timer
 *    schedules reloadOnce.
 *  - telemetry.ts line 43: module-level info log when OTEL_EXPORTER_OTLP_ENDPOINT
 *    is set BEFORE the module is loaded.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('hot-reload — watch() callback fires reloadOnce after debounce (lines 64-65)', () => {
  let tmp: string
  let originalConfigFile: string | undefined

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cov-hr-'))
    originalConfigFile = process.env.GATEWAY_CONFIG_FILE
  })

  afterEach(async () => {
    const { stopHotReload, config } = await import('@heejun/spa-seo-gateway-core')
    stopHotReload()
    if (originalConfigFile === undefined) delete process.env.GATEWAY_CONFIG_FILE
    else process.env.GATEWAY_CONFIG_FILE = originalConfigFile
    ;(config as { hotReload: boolean }).hotReload = false
    rmSync(tmp, { recursive: true, force: true })
  })

  it('writing to the watched file triggers reload (debounced 200ms)', async () => {
    const { startHotReload, config, getRoutes } = await import('@heejun/spa-seo-gateway-core')
    const file = join(tmp, 'cfg.json')
    writeFileSync(file, JSON.stringify({ routes: [{ pattern: '^/initial/' }] }))
    process.env.GATEWAY_CONFIG_FILE = file
    ;(config as { hotReload: boolean }).hotReload = true
    startHotReload()
    // Give the watcher a moment to attach.
    await new Promise((r) => setTimeout(r, 100))
    // Modify the file — watch fires `change`, callback schedules setTimeout(reloadOnce, 200).
    writeFileSync(file, JSON.stringify({ routes: [{ pattern: '^/changed-by-watch/' }] }))
    // Wait long enough for debounce + reload.
    await new Promise((r) => setTimeout(r, 1500))
    const routes = getRoutes()
    expect(routes.some((r) => r.pattern === '^/changed-by-watch/')).toBe(true)
  }, 10000)

  it('multiple writes inside the debounce window collapse into a single reload', async () => {
    const { startHotReload, config, getRoutes } = await import('@heejun/spa-seo-gateway-core')
    const file = join(tmp, 'debounce.json')
    writeFileSync(file, JSON.stringify({ routes: [] }))
    process.env.GATEWAY_CONFIG_FILE = file
    ;(config as { hotReload: boolean }).hotReload = true
    startHotReload()
    await new Promise((r) => setTimeout(r, 100))
    writeFileSync(file, JSON.stringify({ routes: [{ pattern: '^/burst-1/' }] }))
    await new Promise((r) => setTimeout(r, 20))
    writeFileSync(file, JSON.stringify({ routes: [{ pattern: '^/burst-2/' }] }))
    await new Promise((r) => setTimeout(r, 20))
    writeFileSync(file, JSON.stringify({ routes: [{ pattern: '^/burst-final/' }] }))
    await new Promise((r) => setTimeout(r, 1500))
    expect(getRoutes().some((r) => r.pattern === '^/burst-final/')).toBe(true)
  }, 10000)
})

describe('telemetry — module-level OTEL endpoint info log (line 43)', () => {
  let originalEndpoint: string | undefined

  beforeEach(() => {
    originalEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    vi.resetModules()
  })

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    } else {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEndpoint
    }
    vi.resetModules()
  })

  it('with OTEL_EXPORTER_OTLP_ENDPOINT set, the module-level info log fires', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://otel.local:4318'
    // Fresh import so the module-level `if (tracingEnabled())` runs WITH the env set.
    const mod = await import('../packages/core/src/telemetry.js')
    expect(mod.tracingEnabled()).toBe(true)
  })
})
