/**
 * cli-render-import-fail.test.ts — covers the catch branch where the dynamic
 * import of `@heejun/spa-seo-gateway-core` itself rejects. That branch calls
 * `process.exit(1)` so we stub it to throw a sentinel, then assert.
 *
 * Isolated in its own file because the failing-import mock is incompatible
 * with the happy-path mock used by cli-render.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@heejun/spa-seo-gateway-core', () => {
  throw new Error('module not installed')
})

vi.mock('@clack/prompts', () => {
  const spinner = () => ({ start: vi.fn(), stop: vi.fn() })
  return {
    spinner,
    intro: vi.fn(),
    outro: vi.fn(),
    note: vi.fn(),
  }
})

class ProcessExit extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`)
  }
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let exitSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new ProcessExit(code ?? 0)
  }) as never)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
  exitSpy.mockRestore()
})

describe('runRender — core import failure', () => {
  it('calls process.exit(1) when the core module fails to load', async () => {
    const { runRender } = await import('../packages/cli/src/render.js')
    await expect(runRender(['https://e.com/'])).rejects.toBeInstanceOf(ProcessExit)
    expect(exitSpy).toHaveBeenCalledWith(1)
    // Both console.error calls in the catch arm.
    expect(consoleErrorSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
