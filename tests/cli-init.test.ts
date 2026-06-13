/**
 * CLI `init` command — exercises every branch of the interactive flow by
 * mocking `@clack/prompts` and feeding a deterministic queue of responses.
 *
 * Each test:
 *   - chdir's into a fresh tmp dir so config/env writes are sandboxed
 *   - queues prompt return values via the `pq` (prompt-queue) helper
 *   - calls `runInit` and asserts on the written files + side-effects
 *
 * For cancellation tests we stub `process.exit` to throw a sentinel so we can
 * assert the exit code without actually exiting the test process.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clackPromptsPath = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createRequire } = require('node:module') as {
    createRequire: (id: string) => NodeJS.Require
  }
  const req = createRequire(`${process.cwd()}/packages/cli/src/index.js`)
  return req.resolve('@clack/prompts')
})

type Answer = { kind: 'value'; value: unknown } | { kind: 'cancel' }

const state = vi.hoisted(() => {
  const CANCEL = Symbol.for('clack:cancel')
  return {
    CANCEL,
    queue: [] as Array<{
      kind: 'value' | 'cancel'
      value?: unknown
      type?: string // for debugging
    }>,
    captured: [] as Array<{
      type: string
      message?: string
      result: unknown
    }>,
  }
})

vi.mock(clackPromptsPath, () => {
  function next(type: string, opts?: { message?: string }): unknown {
    const ans = state.queue.shift()
    if (!ans) {
      throw new Error(`prompt queue exhausted: ${type} (${opts?.message ?? ''})`)
    }
    const result = ans.kind === 'cancel' ? state.CANCEL : ans.value
    state.captured.push({ type, message: opts?.message, result })
    return result
  }
  return {
    intro: () => {},
    outro: () => {},
    note: () => {},
    cancel: () => {},
    spinner: () => ({ start: () => {}, stop: () => {}, message: () => {} }),
    confirm: async (opts: { message?: string }) => next('confirm', opts) as boolean | symbol,
    select: async (opts: { message?: string }) => next('select', opts) as unknown,
    text: async (opts: { message?: string }) => next('text', opts) as string | symbol,
    multiselect: async (opts: { message?: string }) =>
      next('multiselect', opts) as string[] | symbol,
    isCancel: (v: unknown) => v === state.CANCEL,
  }
})

// pq = "prompt queue" — chain helpers for readability.
const pq = {
  q(answers: Array<Answer | unknown>) {
    state.queue.length = 0
    for (const a of answers) {
      if (typeof a === 'object' && a !== null && 'kind' in a) {
        state.queue.push(a as Answer)
      } else {
        state.queue.push({ kind: 'value', value: a })
      }
    }
  },
  cancel(): Answer {
    return { kind: 'cancel' }
  },
  reset() {
    state.queue.length = 0
    state.captured.length = 0
  },
}

let originalCwd: string
let tmp: string

beforeEach(() => {
  pq.reset()
  originalCwd = process.cwd()
  tmp = mkdtempSync(`${tmpdir()}/spa-seo-init-`)
  process.chdir(tmp)
})

afterEach(() => {
  process.chdir(originalCwd)
  try {
    rmSync(tmp, { recursive: true, force: true })
  } catch {
    /* tmp cleanup best-effort */
  }
  vi.restoreAllMocks()
})

async function loadRunInit() {
  // Use a fresh module so picocolors / clack imports are re-resolved against
  // our mock state every time.
  vi.resetModules()
  const mod = await import('../packages/cli/src/init.js')
  return mod.runInit
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

describe('cli/init', () => {
  it('render-only mode — writes config + .env with auto-generated admin token', async () => {
    pq.q([
      'render-only',
      'https://www.example.com',
      '', // empty admin token → auto-generate
      86_400_000, // ttl: 24h
      false, // no redis
      ['image', 'media', 'font'],
      true, // hot reload
    ])

    const runInit = await loadRunInit()
    await runInit([])

    const configPath = resolve(tmp, 'seo-gateway.config.json')
    const envPath = resolve(tmp, '.env')
    expect(existsSync(configPath)).toBe(true)
    expect(existsSync(envPath)).toBe(true)

    const cfg = readJson(configPath)
    expect(cfg.mode).toBe('render-only')
    expect(cfg.originUrl).toBe('https://www.example.com')
    expect(cfg.hotReload).toBe(true)
    expect((cfg.cache as { memory: { ttlMs: number } }).memory.ttlMs).toBe(86_400_000)
    expect((cfg.cache as Record<string, unknown>).redis).toBeUndefined()
    expect((cfg.renderer as { blockResourceTypes: string[] }).blockResourceTypes).toEqual([
      'image',
      'media',
      'font',
    ])

    const env = readFileSync(envPath, 'utf8')
    expect(env).toMatch(/ADMIN_TOKEN=seogw_[A-Za-z0-9_-]+/)
    expect(env).not.toMatch(/REDIS_CACHE_ENABLED/)
    expect(env).toMatch(/LOG_PRETTY=true/)
  })

  it('proxy mode — also prompts for originUrl', async () => {
    pq.q([
      'proxy',
      'https://api.example.com',
      'my-explicit-token',
      3_600_000, // 1h
      false, // no redis
      [] as string[],
      false, // hot reload off
    ])

    const runInit = await loadRunInit()
    await runInit([])

    const cfg = readJson(resolve(tmp, 'seo-gateway.config.json'))
    expect(cfg.mode).toBe('proxy')
    expect(cfg.originUrl).toBe('https://api.example.com')
    expect(cfg.hotReload).toBe(false)
    expect((cfg.renderer as { blockResourceTypes: string[] }).blockResourceTypes).toEqual([])

    const env = readFileSync(resolve(tmp, '.env'), 'utf8')
    expect(env).toMatch(/ADMIN_TOKEN=my-explicit-token/)
  })

  it('cms mode — skips originUrl prompt entirely', async () => {
    pq.q([
      'cms',
      // no originUrl
      '',
      600_000,
      false,
      ['image'],
      true,
    ])

    const runInit = await loadRunInit()
    await runInit([])

    const cfg = readJson(resolve(tmp, 'seo-gateway.config.json'))
    expect(cfg.mode).toBe('cms')
    expect(cfg.originUrl).toBeUndefined()
  })

  it('saas mode — skips originUrl prompt entirely', async () => {
    pq.q(['saas', '', 21_600_000, false, ['font'], true])

    const runInit = await loadRunInit()
    await runInit([])

    const cfg = readJson(resolve(tmp, 'seo-gateway.config.json'))
    expect(cfg.mode).toBe('saas')
    expect(cfg.originUrl).toBeUndefined()
  })

  it('useRedis=true — adds redis to config and REDIS_CACHE_ENABLED to env', async () => {
    pq.q([
      'render-only',
      'https://r.example.com',
      '',
      604_800_000, // 7d
      true, // use redis
      'redis://prod-redis:6379',
      ['image'],
      true,
    ])

    const runInit = await loadRunInit()
    await runInit([])

    const cfg = readJson(resolve(tmp, 'seo-gateway.config.json'))
    expect((cfg.cache as { redis: { enabled: boolean; url: string } }).redis).toEqual({
      enabled: true,
      url: 'redis://prod-redis:6379',
    })

    const env = readFileSync(resolve(tmp, '.env'), 'utf8')
    expect(env).toMatch(/REDIS_CACHE_ENABLED=true/)
  })

  it('existing .env is preserved — only config is written', async () => {
    writeFileSync(resolve(tmp, '.env'), 'EXISTING=hello\n', 'utf8')

    pq.q(['render-only', 'https://x.example.com', 'tok', 600_000, false, ['image'], true])

    const runInit = await loadRunInit()
    await runInit([])

    const env = readFileSync(resolve(tmp, '.env'), 'utf8')
    expect(env).toBe('EXISTING=hello\n')
  })

  it('config exists + user confirms overwrite — config gets rewritten', async () => {
    writeFileSync(
      resolve(tmp, 'seo-gateway.config.json'),
      '{"mode":"render-only","old":"yes"}\n',
      'utf8'
    )

    pq.q([
      true, // overwrite? yes
      'render-only',
      'https://new.example.com',
      'tok',
      600_000,
      false,
      ['image'],
      true,
    ])

    const runInit = await loadRunInit()
    await runInit([])

    const cfg = readJson(resolve(tmp, 'seo-gateway.config.json'))
    expect(cfg.originUrl).toBe('https://new.example.com')
    expect((cfg as Record<string, unknown>).old).toBeUndefined()
  })

  it('config exists + user declines overwrite — bails out early, file untouched', async () => {
    const original = '{"mode":"render-only","keep":"this"}\n'
    writeFileSync(resolve(tmp, 'seo-gateway.config.json'), original, 'utf8')

    pq.q([false]) // overwrite? no

    const runInit = await loadRunInit()
    await runInit([])

    const cfg = readFileSync(resolve(tmp, 'seo-gateway.config.json'), 'utf8')
    expect(cfg).toBe(original)
  })

  it('config exists + user cancels overwrite prompt — bails out early', async () => {
    const original = '{"mode":"render-only","keep":"this"}\n'
    writeFileSync(resolve(tmp, 'seo-gateway.config.json'), original, 'utf8')

    pq.q([pq.cancel()])

    const runInit = await loadRunInit()
    await runInit([])

    const cfg = readFileSync(resolve(tmp, 'seo-gateway.config.json'), 'utf8')
    expect(cfg).toBe(original)
  })

  // ── cancellation at each prompt step ────────────────────────────────────

  function expectExitOnCancel(prompts: Array<Answer | unknown>) {
    pq.q(prompts)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit__${code ?? 0}`)
    }) as never)
    return exitSpy
  }

  it('cancel at mode select → process.exit(0)', async () => {
    const exitSpy = expectExitOnCancel([pq.cancel()])

    const runInit = await loadRunInit()
    await expect(runInit([])).rejects.toThrow(/__exit__0/)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('cancel at originUrl text → process.exit(0)', async () => {
    const exitSpy = expectExitOnCancel(['render-only', pq.cancel()])

    const runInit = await loadRunInit()
    await expect(runInit([])).rejects.toThrow(/__exit__0/)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('cancel at adminToken text → process.exit(0)', async () => {
    const exitSpy = expectExitOnCancel(['render-only', 'https://a.example.com', pq.cancel()])

    const runInit = await loadRunInit()
    await expect(runInit([])).rejects.toThrow(/__exit__0/)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('cancel at ttl select → process.exit(0)', async () => {
    const exitSpy = expectExitOnCancel(['render-only', 'https://a.example.com', 'tok', pq.cancel()])

    const runInit = await loadRunInit()
    await expect(runInit([])).rejects.toThrow(/__exit__0/)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('cancel at useRedis confirm → process.exit(0)', async () => {
    const exitSpy = expectExitOnCancel([
      'render-only',
      'https://a.example.com',
      'tok',
      600_000,
      pq.cancel(),
    ])

    const runInit = await loadRunInit()
    await expect(runInit([])).rejects.toThrow(/__exit__0/)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('cancel at redisUrl text → process.exit(0)', async () => {
    const exitSpy = expectExitOnCancel([
      'render-only',
      'https://a.example.com',
      'tok',
      600_000,
      true, // useRedis
      pq.cancel(),
    ])

    const runInit = await loadRunInit()
    await expect(runInit([])).rejects.toThrow(/__exit__0/)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('cancel at multiselect → process.exit(0)', async () => {
    const exitSpy = expectExitOnCancel([
      'render-only',
      'https://a.example.com',
      'tok',
      600_000,
      false,
      pq.cancel(),
    ])

    const runInit = await loadRunInit()
    await expect(runInit([])).rejects.toThrow(/__exit__0/)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('cancel at hotReload confirm → process.exit(0)', async () => {
    const exitSpy = expectExitOnCancel([
      'render-only',
      'https://a.example.com',
      'tok',
      600_000,
      false,
      ['image'],
      pq.cancel(),
    ])

    const runInit = await loadRunInit()
    await expect(runInit([])).rejects.toThrow(/__exit__0/)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})

// ── originUrl validator unit (using a fresh mock that captures opts) ───────
describe('cli/init — originUrl validator', () => {
  it('validates url input', async () => {
    let capturedValidate: ((v: string) => string | undefined) | undefined
    state.queue.length = 0
    state.captured.length = 0

    // Override the text mock for this test by pushing custom answers but
    // intercepting the originUrl prompt's `validate` option via a side
    // channel: we'll temporarily replace the queue logic.
    const originalCwd2 = process.cwd()
    const tmp2 = mkdtempSync(`${tmpdir()}/spa-seo-init-`)
    process.chdir(tmp2)

    try {
      // Use vi.doMock at the same path to override and capture validate.
      vi.resetModules()
      vi.doMock(clackPromptsPath, () => {
        return {
          intro: () => {},
          outro: () => {},
          note: () => {},
          cancel: () => {},
          spinner: () => ({ start: () => {}, stop: () => {}, message: () => {} }),
          confirm: async () => false,
          select: async (opts: { options: Array<{ value: unknown }> }) => opts.options[0].value,
          text: async (opts: {
            message?: string
            validate?: (v: string) => string | undefined
          }) => {
            if (opts.message === 'SPA 의 origin URL?') {
              capturedValidate = opts.validate
              return 'https://valid.example.com'
            }
            return ''
          },
          multiselect: async () => [],
          isCancel: () => false,
        }
      })

      const { runInit } = await import('../packages/cli/src/init.js')
      await runInit([])

      expect(capturedValidate).toBeDefined()
      expect(capturedValidate!('')).toBe('필수입니다')
      expect(capturedValidate!('not-a-url')).toBe('유효한 URL 이 아닙니다')
      expect(capturedValidate!('https://ok.example.com')).toBeUndefined()
    } finally {
      vi.doUnmock(clackPromptsPath)
      process.chdir(originalCwd2)
      try {
        rmSync(tmp2, { recursive: true, force: true })
      } catch {
        /* tmp cleanup best-effort */
      }
    }
  })
})
