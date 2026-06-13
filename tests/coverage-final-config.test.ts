/**
 * Final coverage push for packages/core/src/config.ts — covers the two
 * `process.exit(1)` failure branches at module-load time:
 *
 *   - lines 328-329: schema validation fails (ORIGIN_URL set to an invalid URL)
 *   - lines 335-336: GATEWAY_MODE=proxy without ORIGIN_URL
 *
 * Strategy: vi.resetModules + stub process.exit so the re-imported module
 * raises a controllable Error instead of killing the test process; the catch
 * branch in v8 still records the lines as executed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  originalEnv = { ...process.env }
  vi.resetModules()
})

afterEach(() => {
  process.env = originalEnv
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('config.ts — invalid schema triggers process.exit (lines 327-329)', () => {
  it('Schema fails when ORIGIN_URL is malformed → process.exit(1) is called', async () => {
    process.env.ORIGIN_URL = 'not-a-valid-url'
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      // throw to short-circuit the rest of module evaluation; coverage
      // tracker has already recorded lines 328-329 by this point.
      throw new Error('process.exit called')
    }) as never)

    await expect(import('../packages/core/src/config.js')).rejects.toThrow(/process\.exit called/)
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid configuration:'),
      expect.any(String)
    )
  })
})

describe('config.ts — mode=proxy without ORIGIN_URL triggers process.exit (lines 334-336)', () => {
  it('GATEWAY_MODE=proxy with no ORIGIN_URL → process.exit(1)', async () => {
    process.env.GATEWAY_MODE = 'proxy'
    delete process.env.ORIGIN_URL
    // ensure dotenv does not re-populate ORIGIN_URL by intercepting the file load
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('process.exit called')
    }) as never)

    await expect(import('../packages/core/src/config.js')).rejects.toThrow(/process\.exit called/)
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errSpy).toHaveBeenCalledWith('GATEWAY_MODE=proxy requires ORIGIN_URL')
  })
})

describe('config.ts — fromFile error path (line 297)', () => {
  it('malformed JSON in GATEWAY_CONFIG_FILE → process.exit(1)', async () => {
    // Use a real tmp dir for the bad config file so the module finds it.
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'cov-cfg-'))
    const badPath = join(dir, 'bad.json')
    writeFileSync(badPath, '{not valid json')
    process.env.GATEWAY_CONFIG_FILE = badPath

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('process.exit called')
    }) as never)
    try {
      await expect(import('../packages/core/src/config.js')).rejects.toThrow(/process\.exit called/)
      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(errSpy.mock.calls.some((c) => String(c[0]).startsWith('failed to read'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
