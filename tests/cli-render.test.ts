/**
 * cli-render.test.ts — exercises `runRender` end-to-end by mocking the core
 * package and the `@clack/prompts` UI shell.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RenderModule = typeof import('../packages/cli/src/render.js')

const browserStartMock = vi.fn()
const browserStopMock = vi.fn()
const renderMock = vi.fn()
const matchRouteMock = vi.fn()

vi.mock('@heejun/spa-seo-gateway-core', () => ({
  browserPool: {
    start: browserStartMock,
    stop: browserStopMock,
  },
  render: renderMock,
  matchRoute: matchRouteMock,
}))

vi.mock('@clack/prompts', () => {
  const spinner = () => ({ start: vi.fn(), stop: vi.fn() })
  return {
    spinner,
    intro: vi.fn(),
    outro: vi.fn(),
    note: vi.fn(),
  }
})

let render: RenderModule
let tmpDir: string
let exitCodeSnapshot: number | undefined
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleLogSpy: ReturnType<typeof vi.spyOn>
let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  browserStartMock.mockReset().mockResolvedValue(undefined)
  browserStopMock.mockReset().mockResolvedValue(undefined)
  renderMock.mockReset()
  matchRouteMock.mockReset()

  exitCodeSnapshot = process.exitCode as number | undefined
  process.exitCode = undefined
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  stdoutWriteSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true as unknown as boolean)

  tmpDir = mkdtempSync(join(tmpdir(), 'cli-render-test-'))
  render = await import('../packages/cli/src/render.js')
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
  consoleLogSpy.mockRestore()
  stdoutWriteSpy.mockRestore()
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
  process.exitCode = exitCodeSnapshot
})

function fakeEntry(overrides: Partial<{ body: string; headers: Record<string, string> }> = {}) {
  return {
    body: overrides.body ?? '<html><body>hello</body></html>',
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-prerender-viewport': 'desktop',
      ...(overrides.headers ?? {}),
    },
    createdAt: Date.now(),
  }
}

describe('runRender', () => {
  it('sets exitCode=2 and writes a helpful error when no URL is provided', async () => {
    await render.runRender([])
    expect(process.exitCode).toBe(2)
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(renderMock).not.toHaveBeenCalled()
    expect(browserStartMock).not.toHaveBeenCalled()
  })

  it('happy path: starts/stops the pool and renders the URL', async () => {
    matchRouteMock.mockReturnValue({ pattern: '/' })
    renderMock.mockResolvedValue(fakeEntry())

    await render.runRender(['https://e.com/'])

    expect(browserStartMock).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(renderMock.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://e.com/',
      route: { pattern: '/' },
    })
    expect(browserStopMock).toHaveBeenCalledTimes(1)
    expect(process.exitCode).toBeUndefined()
  })

  it('writes the body to --out when supplied', async () => {
    matchRouteMock.mockReturnValue(null)
    renderMock.mockResolvedValue(fakeEntry({ body: '<p>OUT</p>' }))

    const outPath = join(tmpDir, 'r.html')
    await render.runRender(['https://e.com/', '--out', outPath])

    expect(readFileSync(outPath, 'utf8')).toBe('<p>OUT</p>')
  })

  it('streams the body to stdout when --stdout is supplied', async () => {
    matchRouteMock.mockReturnValue(null)
    renderMock.mockResolvedValue(fakeEntry({ body: '<p>STREAM</p>' }))

    await render.runRender(['https://e.com/', '--stdout'])

    expect(stdoutWriteSpy).toHaveBeenCalledWith('<p>STREAM</p>')
  })

  it('uses the mobile UA when --mobile is passed', async () => {
    matchRouteMock.mockReturnValue(null)
    renderMock.mockResolvedValue(fakeEntry())

    await render.runRender(['https://e.com/', '--mobile'])

    const ua = (renderMock.mock.calls[0]?.[0] as { headers: Record<string, string> })?.headers?.[
      'user-agent'
    ]
    expect(ua).toMatch(/Mobile/)
    expect(ua).toMatch(/Googlebot/)
  })

  it('uses a custom UA when --ua is passed (overrides --mobile)', async () => {
    matchRouteMock.mockReturnValue(null)
    renderMock.mockResolvedValue(fakeEntry())

    await render.runRender(['https://e.com/', '--ua', 'MyAgent/2.0', '--mobile'])

    const ua = (renderMock.mock.calls[0]?.[0] as { headers: Record<string, string> })?.headers?.[
      'user-agent'
    ]
    expect(ua).toBe('MyAgent/2.0')
  })

  it('renders a long-UA path (>80 chars) and a quality header for the summary branch', async () => {
    matchRouteMock.mockReturnValue({ pattern: '/long' })
    renderMock.mockResolvedValue(fakeEntry({ headers: { 'x-prerender-quality': 'thin' } }))

    // Custom UA that's >80 chars so the slice/ellipsis branch fires.
    const longUa = 'X'.repeat(120)
    await render.runRender(['https://e.com/long', '--ua', longUa])

    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(process.exitCode).toBeUndefined()
  })

  it('sets exitCode=1 when render throws but still stops the pool', async () => {
    matchRouteMock.mockReturnValue(null)
    renderMock.mockRejectedValue(new Error('boom'))

    await render.runRender(['https://e.com/'])

    expect(process.exitCode).toBe(1)
    expect(browserStopMock).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
