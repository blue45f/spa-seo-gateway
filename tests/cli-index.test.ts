import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mocks must be hoisted; use vi.mock factories.  Sub-runners are turned into
// no-op spies so we can drive the main() switch in-process and observe which
// branch was taken.
const runInit = vi.fn(async (_args: string[]) => {})
const runDoctor = vi.fn(async () => {})
const runRender = vi.fn(async (_args: string[]) => {})

vi.mock('../packages/cli/src/init.js', () => ({ runInit }))
vi.mock('../packages/cli/src/doctor.js', () => ({ runDoctor }))
vi.mock('../packages/cli/src/render.js', () => ({ runRender }))

// We re-import index.ts repeatedly with a fresh module registry so that its
// top-level main() runs again under different argv values.  vi.resetModules()
// gives us that fresh registry.

const originalArgv = process.argv.slice()
const originalExitCode = process.exitCode

async function runIndexWith(argv: string[]): Promise<void> {
  process.argv = ['node', '/abs/path/index.ts', ...argv]
  process.exitCode = undefined
  vi.resetModules()
  await import('../packages/cli/src/index.js')
  // index.ts kicks off main() but doesn't await it; let the microtask queue
  // drain so that the awaited sub-runner / console.log has flushed.
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
}

describe('cli/index main() dispatcher', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    runInit.mockClear()
    runDoctor.mockClear()
    runRender.mockClear()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exitCode = originalExitCode
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('prints HELP when called with no args', async () => {
    await runIndexWith([])
    expect(logSpy).toHaveBeenCalled()
    const printed = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(printed).toMatch(/spa-seo-gateway/)
    expect(printed).toMatch(/USAGE/)
    expect(process.exitCode).toBeFalsy()
  })

  it('prints HELP for --help', async () => {
    await runIndexWith(['--help'])
    const printed = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(printed).toMatch(/USAGE/)
  })

  it('prints HELP for -h', async () => {
    await runIndexWith(['-h'])
    const printed = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(printed).toMatch(/USAGE/)
  })

  it('prints HELP for help', async () => {
    await runIndexWith(['help'])
    const printed = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(printed).toMatch(/USAGE/)
  })

  it('dispatches to runDoctor for the doctor command', async () => {
    await runIndexWith(['doctor'])
    expect(runDoctor).toHaveBeenCalledTimes(1)
  })

  it('dispatches to runInit for the init command (forwarding rest args)', async () => {
    await runIndexWith(['init', '--yes', '--force'])
    expect(runInit).toHaveBeenCalledTimes(1)
    expect(runInit).toHaveBeenCalledWith(['--yes', '--force'])
  })

  it('dispatches to runRender for the render command (forwarding rest args)', async () => {
    await runIndexWith(['render', 'https://example.com/', '--out', 'r.html'])
    expect(runRender).toHaveBeenCalledTimes(1)
    expect(runRender).toHaveBeenCalledWith(['https://example.com/', '--out', 'r.html'])
  })

  it('handles an unknown command with exitCode=2 and an error log', async () => {
    await runIndexWith(['totally-unknown-command'])
    expect(process.exitCode).toBe(2)
    const errOutput = errSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(errOutput).toMatch(/알 수 없는 명령/)
    // The HELP block is still printed after the error.
    const printed = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(printed).toMatch(/USAGE/)
  })

  it('routes a sub-runner rejection through the top-level catch (logs and exits)', async () => {
    // Force runDoctor to reject so the trailing `.catch()` fires.  We
    // intercept process.exit so the test process survives.
    runDoctor.mockImplementationOnce(async () => {
      throw new Error('boom')
    })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      // swallow — do not actually exit the test process
      return undefined as never
    }) as typeof process.exit)
    try {
      await runIndexWith(['doctor'])
      // Allow the .catch() microtask to run.
      await new Promise((r) => setImmediate(r))
      await new Promise((r) => setImmediate(r))
      const errOutput = errSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
      expect(errOutput).toMatch(/실패/)
      expect(exitSpy).toHaveBeenCalledWith(1)
    } finally {
      exitSpy.mockRestore()
    }
  })
})
